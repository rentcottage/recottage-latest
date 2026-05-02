import { useState, useEffect } from 'react';
import type { Booking } from '../../../lib/supabase';
import { supabase } from '../../../lib/supabase';

const BOOKING_HANDLER_URL = 'https://fkjkyzpunatzkovqxyzp.supabase.co/functions/v1/booking-handler';

interface ChangeDatesModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function ChangeDatesModal({ booking, onClose, onSuccess }: ChangeDatesModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [checkIn, setCheckIn] = useState(booking.check_in);
  const [checkOut, setCheckOut] = useState(booking.check_out);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const nights = checkIn && checkOut && checkOut > checkIn ? daysBetween(checkIn, checkOut) : 0;
  const newTotal = booking.price_per_night && nights > 0
    ? Math.round(booking.price_per_night * nights)
    : null;

  useEffect(() => {
    if (checkOut && checkIn && checkOut <= checkIn) {
      const next = new Date(checkIn);
      next.setDate(next.getDate() + 1);
      setCheckOut(next.toISOString().split('T')[0]);
    }
  }, [checkIn]);

  const handleSave = async () => {
    setError('');
    if (!checkIn || !checkOut) { setError('Please select both dates.'); return; }
    if (checkOut <= checkIn) { setError('Check-out must be after check-in.'); return; }
    if (checkIn < today) { setError('Check-in date cannot be in the past.'); return; }

    setSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData?.session?.user?.email ?? booking.user_email;

      const res = await fetch(BOOKING_HANDLER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-dates',
          bookingId: booking.id,
          userEmail,
          checkIn,
          checkOut,
          totalPrice: newTotal,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to submit request. Please try again.');
        return;
      }

      setSubmitted(true);
      onSuccess();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl w-full max-w-md">
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-7 h-7 flex items-center justify-center">
                <i className="ri-time-line text-amber-500 text-2xl"></i>
              </div>
            </div>
            <h3 className="font-semibold text-gray-900 text-base mb-2">Request Submitted!</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-1">
              Your date change request for <strong className="text-gray-700 notranslate" translate="no">{booking.property_title}</strong> is now pending admin approval.
            </p>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              You'll receive a confirmation email once the host approves or rejects your request. Your original dates remain active in the meantime.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 mb-6 text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Requested check-in</span>
                <span className="font-medium text-gray-700">{checkIn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Requested check-out</span>
                <span className="font-medium text-gray-700">{checkOut}</span>
              </div>
              {newTotal !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-400">New total</span>
                  <span className="font-medium text-gray-700">₾{newTotal}</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-base">Request Date Change</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer rounded-full hover:bg-gray-100 transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <span className="font-medium text-gray-800 notranslate" translate="no">{booking.property_title}</span>
            {booking.property_location && (
              <span className="ml-2 text-gray-400">· {booking.property_location}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">New Check-in</label>
              <input
                type="date"
                value={checkIn}
                min={today}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">New Check-out</label>
              <input
                type="date"
                value={checkOut}
                min={checkIn || today}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent cursor-pointer"
              />
            </div>
          </div>

          {nights > 0 && (
            <div className="flex items-center justify-between text-sm bg-red-50 rounded-lg px-4 py-3">
              <span className="text-gray-600">{nights} night{nights !== 1 ? 's' : ''}</span>
              {newTotal !== null ? (
                <span className="font-semibold text-gray-900">New total: ₾{newTotal}</span>
              ) : (
                booking.total_price && (
                  <span className="text-gray-500">Original total: ₾{booking.total_price}</span>
                )
              )}
            </div>
          )}

          <div className="flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2.5">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-information-line"></i>
            </div>
            <span>This will submit a request — your dates won't change until the host approves it. You'll receive an email with the decision.</span>
          </div>

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>{error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || nights < 1}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                Submitting...
              </>
            ) : (
              <>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-send-plane-line"></i>
                </div>
                Request Date Change
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
