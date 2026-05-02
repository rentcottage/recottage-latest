import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Header from '../../components/feature/Header';
import SEO from '../../components/feature/SEO';

const BOG_VERIFY_URL = 'https://fkjkyzpunatzkovqxyzp.supabase.co/functions/v1/bog-payment?action=verify';

type VerifyStatus = 'loading' | 'confirmed' | 'pending' | 'failed';

interface BookingDetails {
  id: string;
  property_title: string;
  property_location?: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  payment_status: string;
  status: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function calcNights(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn + 'T00:00:00');
  const b = new Date(checkOut + 'T00:00:00');
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('booking_id');
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('loading');
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [pollCount, setPollCount] = useState(0);

  // Fetch booking display data from DB (only for UI — never for auth decision)
  const fetchBookingDisplay = useCallback(async (id: string): Promise<BookingDetails | null> => {
    const { data } = await supabase
      .from('bookings')
      .select('id, property_title, property_location, check_in, check_out, guests, total_price, payment_status, status')
      .eq('id', id)
      .maybeSingle();
    return data as BookingDetails | null;
  }, []);

  const verify = useCallback(async () => {
    if (!bookingId) {
      setVerifyStatus('failed');
      return;
    }

    try {
      // ── SECURITY: Edge function is the ONLY source of truth for pay_now bookings.
      // It always calls BOG API live — we never trust DB status alone here.
      const res = await fetch(`${BOG_VERIFY_URL}&booking_id=${encodeURIComponent(bookingId)}`);

      if (!res.ok) {
        // Edge function error — stay in pending, retry
        setVerifyStatus('pending');
        return;
      }

      const json = await res.json() as {
        paymentStatus: string;
        bookingStatus: string;
        verified: boolean;
        source?: string;
        warning?: string;
      };

      const ps = json.paymentStatus;

      if (ps === 'paid' || json.verified) {
        // Verified paid by BOG API — safe to show success
        const b = await fetchBookingDisplay(bookingId);
        setBooking(b);
        setVerifyStatus('confirmed');
        return;
      }

      if (ps === 'payment_failed' || ps === 'canceled') {
        setVerifyStatus('failed');
        return;
      }

      // pay_at_property or pending — still waiting
      // For pay_at_property (source = db_pay_at_property), trust DB status
      if (json.source === 'db_pay_at_property') {
        const bs = json.bookingStatus;
        if (bs === 'confirmed' || bs === 'pending_host_approval') {
          const b = await fetchBookingDisplay(bookingId);
          setBooking(b);
          setVerifyStatus('confirmed');
        } else {
          setVerifyStatus('pending');
        }
        return;
      }

      // BOG is still processing — keep polling
      setVerifyStatus('pending');
    } catch {
      // Network error — retry
      setVerifyStatus('pending');
    }
  }, [bookingId, fetchBookingDisplay]);

  // Initial verify
  useEffect(() => {
    verify();
  }, [verify]);

  // Poll every 3 seconds if still pending (BOG callback may be slightly delayed)
  useEffect(() => {
    if (verifyStatus !== 'pending') return;
    if (pollCount >= 10) return; // ~30 seconds total polling

    const timer = setTimeout(() => {
      setPollCount((c) => c + 1);
      verify();
    }, 3000);

    return () => clearTimeout(timer);
  }, [verifyStatus, pollCount, verify]);

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <SEO
          title="Payment Successful — RentCottage.Ge"
          description="Your cottage booking payment was successful. View your booking confirmation."
          noIndex={true}
          canonical="/payment/success"
        />
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-gray-500 text-sm">No booking information found.</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 bg-red-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-red-600 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO
        title="Payment Successful — RentCottage.Ge"
        description="Your cottage booking payment was successful. View your booking confirmation."
        noIndex={true}
        canonical="/payment/success"
      />
      <Header />

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">

          {/* LOADING / PENDING (still polling) */}
          {(verifyStatus === 'loading' || (verifyStatus === 'pending' && pollCount < 10)) && (
            <div className="text-center">
              <div className="w-20 h-20 flex items-center justify-center rounded-full bg-amber-50 border-2 border-amber-200 mx-auto mb-6 animate-pulse">
                <i className="ri-loader-4-line text-3xl text-amber-500 animate-spin"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                {verifyStatus === 'loading' ? 'Verifying payment...' : 'Processing payment...'}
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                We&apos;re confirming your payment with Bank of Georgia. This usually takes a few seconds.
              </p>
              <div className="mt-6 flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-amber-400"
                    style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STILL PENDING after max polls (~30s) */}
          {verifyStatus === 'pending' && pollCount >= 10 && (
            <div className="text-center">
              <div className="w-20 h-20 flex items-center justify-center rounded-full bg-amber-50 border-2 border-amber-200 mx-auto mb-6">
                <i className="ri-time-line text-3xl text-amber-500"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment being processed</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Your payment is being verified by Bank of Georgia. This can sometimes take a minute.
                You&apos;ll receive a confirmation email once it&apos;s complete.
              </p>
              {booking && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left mb-6">
                  <p className="text-xs text-amber-700 font-medium mb-1">Booking reference</p>
                  <p className="text-sm font-bold text-gray-900 notranslate" translate="no">{booking.property_title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{booking.id}</p>
                </div>
              )}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate('/profile')}
                  className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-gray-700 transition-colors"
                >
                  View My Bookings
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full border border-gray-200 text-gray-600 py-3 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-colors"
                >
                  Return to Home
                </button>
              </div>
            </div>
          )}

          {/* CONFIRMED — only shown after BOG API verified payment */}
          {verifyStatus === 'confirmed' && (
            <div>
              <div className="text-center mb-8">
                <div className="w-20 h-20 flex items-center justify-center rounded-full bg-green-50 border-2 border-green-200 mx-auto mb-6">
                  <i className="ri-check-line text-4xl text-green-500"></i>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
                <p className="text-gray-500 text-sm">
                  Your booking is confirmed. A confirmation email has been sent to you.
                </p>
              </div>

              {booking && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden mb-6">
                  <div className="bg-green-500 px-5 py-3">
                    <p className="text-white text-xs font-semibold uppercase tracking-wider">Booking Confirmed</p>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Cottage</p>
                      <p className="text-sm font-bold text-gray-900 notranslate" translate="no">{booking.property_title}</p>
                      {booking.property_location && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <i className="ri-map-pin-line"></i>
                          {booking.property_location}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Check-in</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDate(booking.check_in)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Check-out</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDate(booking.check_out)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Duration</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {calcNights(booking.check_in, booking.check_out)} nights
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Guests</p>
                        <p className="text-sm font-semibold text-gray-900">{booking.guests}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-xs text-gray-400">Total paid</p>
                      <p className="text-lg font-bold text-gray-900">&#x20BE;{booking.total_price}</p>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-0.5">Booking ID</p>
                      <p className="text-xs font-mono text-gray-600 break-all">{booking.id}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate('/profile')}
                  className="w-full bg-red-500 text-white py-3 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-red-600 transition-colors"
                >
                  View My Bookings
                </button>
                <button
                  onClick={() => navigate('/search')}
                  className="w-full border border-gray-200 text-gray-700 py-3 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-colors"
                >
                  Browse More Cottages
                </button>
              </div>
            </div>
          )}

          {/* FAILED */}
          {verifyStatus === 'failed' && (
            <div className="text-center">
              <div className="w-20 h-20 flex items-center justify-center rounded-full bg-red-50 border-2 border-red-200 mx-auto mb-6">
                <i className="ri-close-line text-4xl text-red-500"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment could not be verified</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Bank of Georgia did not confirm a successful payment. No charges were made.
                If you believe this is an error, please contact our support team with your booking reference.
              </p>
              <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6 text-left">
                <p className="text-xs text-red-600 font-medium mb-0.5">Reference</p>
                <p className="text-xs font-mono text-gray-600 break-all">{bookingId}</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate(-1 as never)}
                  className="w-full bg-red-500 text-white py-3 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-red-600 transition-colors"
                >
                  Try Booking Again
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full border border-gray-200 text-gray-600 py-3 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-colors"
                >
                  Return to Home
                </button>
              </div>
              <p className="mt-6 text-xs text-gray-400">
                Need help?{' '}
                <a href="mailto:info.rentcottage@gmail.com" className="text-red-500 hover:underline">
                  Contact support
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
