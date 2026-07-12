import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Booking } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import ChangeDatesModal from './ChangeDatesModal';
import WriteReviewModal from './WriteReviewModal';

const BOOKING_HANDLER_URL = 'https://fkjkyzpunatzkovqxyzp.supabase.co/functions/v1/booking-handler';

interface HostContact {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

/**
 * PRIVACY RULE: Customer may only see host contact details (name, email, phone)
 * starting 1 day before the check-in date.
 */
function canSeeHostDetails(checkIn: string): boolean {
  const revealDate = new Date(checkIn);
  revealDate.setDate(revealDate.getDate() - 1);
  const revealDateStr = revealDate.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  return today >= revealDateStr;
}

interface BookingCardProps {
  booking: Booking;
  onRefresh: () => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-700';
    case 'pending':
    case 'pending_host_approval': return 'bg-amber-100 text-amber-800';
    case 'pending_payment': return 'bg-gray-100 text-gray-600';
    case 'cancelled': return 'bg-red-100 text-red-700';
    case 'cancelled_by_host': return 'bg-red-100 text-red-800';
    case 'rejected': return 'bg-red-100 text-red-700';
    case 'completed': return 'bg-gray-100 text-gray-700';
    case 'refund_pending': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    confirmed: 'Confirmed',
    pending: 'Pending Review',
    pending_host_approval: 'Awaiting Host Approval',
    pending_payment: 'Pending Payment',
    cancelled: 'Cancelled',
    cancelled_by_host: 'Cancelled by Host',
    rejected: 'Not Approved',
    completed: 'Completed',
    payment_failed: 'Payment Failed',
    refund_pending: 'Refund Pending',
  };
  return labels[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BookingCard({ booking, onRefresh }: BookingCardProps) {
  const { user } = useAuth();
  const [showChangeDates, setShowChangeDates] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [hostContact, setHostContact] = useState<HostContact | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const isCancelled = booking.status === 'cancelled' || booking.status === 'cancelled_by_host' || booking.status === 'rejected';
  const isPastCheckIn = booking.check_in <= today;
  const canModify = !isCancelled && !isPastCheckIn;
  const isCompleted = booking.status === 'completed';
  const showHostDetails = canSeeHostDetails(booking.check_in);

  const hasPendingDateChange = booking.date_change_status === 'pending';
  const hasRejectedDateChange = booking.date_change_status === 'rejected';

  // Check if user has already reviewed this property
  useEffect(() => {
    if (!isCompleted || !booking.property_id || !user?.email) return;
    supabase
      .from('reviews')
      .select('id')
      .eq('property_id', booking.property_id)
      .eq('guest_email', user.email)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setHasReviewed(true);
      });
  }, [isCompleted, booking.property_id, user?.email]);

  // Fetch host contact details — only when it's time to reveal them
  useEffect(() => {
    if (!booking.property_id || !showHostDetails || isCancelled) return;
    supabase
      .from('property_applications')
      .select('host_first_name, host_last_name, host_email, host_phone')
      .eq('id', booking.property_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setHostContact({
            firstName: data.host_first_name ?? '',
            lastName: data.host_last_name ?? '',
            email: data.host_email ?? '',
            phone: data.host_phone ?? undefined,
          });
        }
      });
  }, [booking.property_id, showHostDetails, isCancelled]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleCancel = async () => {
    setCancelling(true);

    try {
      // Get current user session to retrieve email
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const userEmail = session?.user?.email ?? booking.user_email;

      const res = await fetch(BOOKING_HANDLER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({
          action: 'cancel',
          bookingId: booking.id,
          userEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error ?? 'Could not cancel booking. Please try again.', 'error');
      } else {
        showToast('Booking cancelled. A confirmation email has been sent to you.', 'success');
        setShowCancelConfirm(false);
        onRefresh();
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <div className="border border-line rounded-card p-4 relative bg-white shadow-card">
        {/* Toast */}
        {toast && (
          <div
            className={`absolute top-3 right-3 z-10 px-3 py-2 rounded-lg text-sm font-medium ${
              toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {toast.msg}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Booking Info */}
          <div className="flex-1 min-w-0">
            {booking.property_id ? (
              <Link
                to={`/property/${booking.property_id}`}
                className="font-bold text-ink hover:text-red-500 hover:underline underline-offset-2 transition-colors cursor-pointer inline-flex items-center gap-1 group notranslate"
                translate="no"
              >
                {booking.property_title}
                <i className="ri-external-link-line text-xs opacity-0 group-hover:opacity-60 transition-opacity"></i>
              </Link>
            ) : (
              <h4 className="font-medium text-gray-900 notranslate" translate="no">{booking.property_title}</h4>
            )}
            {booking.property_location && (
              <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                <i className="ri-map-pin-line"></i>{booking.property_location}
              </p>
            )}
            <p className="text-gray-600 text-sm mt-1.5 flex items-center gap-1.5">
              <i className="ri-calendar-line text-gray-400 text-xs"></i>
              {booking.check_in} &rarr; {booking.check_out}
              &nbsp;&middot;&nbsp;
              {booking.guests} guest{booking.guests !== 1 ? 's' : ''}
            </p>
            {booking.total_price && (
              <p className="text-gray-500 text-xs mt-1">Total: &#8382;{booking.total_price}</p>
            )}
            {/* Payment method badge */}
            <div className="mt-2">
              {booking.payment_method === 'pay_at_property' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  <i className="ri-home-heart-line text-xs"></i>
                  Pay at Property
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  <i className="ri-bank-card-line text-xs"></i>
                  {booking.payment_status === 'paid' ? 'Paid Online' : 'Online Payment'}
                </span>
              )}
            </div>
            {/* Host contact — visible 1 day before check-in */}
            {!isCancelled && (
              <div className="mt-3">
                {showHostDetails && hostContact ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-1.5">
                      <i className="ri-user-star-line text-green-600"></i>
                      Host Contact Details
                      <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                        <i className="ri-eye-line text-[10px]"></i>
                        Visible
                      </span>
                    </p>
                    <div className="space-y-1.5">
                      {(hostContact.firstName || hostContact.lastName) && (
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                            <i className="ri-user-line text-green-600 text-xs"></i>
                          </div>
                          <span className="text-xs text-gray-700 font-medium">
                            {`${hostContact.firstName} ${hostContact.lastName}`.trim()}
                          </span>
                        </div>
                      )}
                      {hostContact.email && (
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                            <i className="ri-mail-line text-green-600 text-xs"></i>
                          </div>
                          <a href={`mailto:${hostContact.email}`} className="text-xs text-green-700 hover:underline">
                            {hostContact.email}
                          </a>
                        </div>
                      )}
                      {hostContact.phone && (
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                            <i className="ri-phone-line text-green-600 text-xs"></i>
                          </div>
                          <a href={`tel:${hostContact.phone}`} className="text-xs text-green-700 hover:underline">
                            {hostContact.phone}
                          </a>
                        </div>
                      )}
                    </div>
                    {hostContact.email && (
                      <div className="mt-3 pt-2.5 border-t border-green-200">
                        <a
                          href={`mailto:${hostContact.email}?subject=${encodeURIComponent(`Booking #${booking.id.slice(0, 8).toUpperCase()} – ${booking.property_title}`)}&body=${encodeURIComponent(`Hi ${hostContact.firstName || 'there'},\n\nI have a booking at ${booking.property_title} (Check-in: ${booking.check_in}, Check-out: ${booking.check_out}).\n\nI wanted to reach out regarding my upcoming stay.\n\nBest regards`)}`}
                          className="inline-flex items-center gap-2 w-full justify-center px-3 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-mail-send-line text-sm"></i>
                          Message Host
                        </a>
                      </div>
                    )}
                  </div>
                ) : !showHostDetails ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2">
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className="ri-lock-line text-gray-400 text-xs"></i>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Host contact details are private</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Host contact information will be revealed <strong>1 day before check-in</strong> ({(() => {
                          const d = new Date(booking.check_in);
                          d.setDate(d.getDate() - 1);
                          return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        })()}).
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {isPastCheckIn && !isCancelled && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <i className="ri-lock-line"></i>
                Changes locked after check-in
              </p>
            )}
          </div>

          {/* Right side: status + actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
              {getStatusLabel(booking.status)}
            </span>

            {/* Write a Review — completed bookings */}
            {isCompleted && booking.property_id && (
              <div className="mt-1">
                {hasReviewed ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <i className="ri-checkbox-circle-line text-xs"></i>
                    Reviewed
                  </span>
                ) : (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-star-line text-amber-500"></i>
                    Write a Review
                  </button>
                )}
              </div>
            )}

            {canModify && (
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => setShowChangeDates(true)}
                  disabled={hasPendingDateChange}
                  className={`text-xs font-medium border rounded-md px-3 py-1.5 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    hasPendingDateChange
                      ? 'text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                      : 'text-gray-600 hover:text-gray-900 border-gray-200 hover:border-gray-300 cursor-pointer'
                  }`}
                >
                  <i className="ri-calendar-2-line"></i>
                  {hasPendingDateChange ? 'Change Pending' : 'Change Dates'}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-md px-3 py-1.5 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <i className="ri-close-circle-line"></i>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cancel Confirmation inline */}
        {showCancelConfirm && (
          <div className="mt-3 pt-3 border-t border-red-100 bg-red-50 rounded-lg p-3">
            <p className="text-sm text-gray-700 mb-3">
              Are you sure you want to cancel this booking? A confirmation email will be sent to you. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-xs font-semibold bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-md px-4 py-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                {cancelling ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                    Cancelling...
                  </>
                ) : (
                  <>
                    <i className="ri-check-line"></i>
                    Yes, Cancel Booking
                  </>
                )}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="text-xs font-medium text-gray-600 border border-gray-200 rounded-md px-4 py-2 hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
              >
                Keep Booking
              </button>
            </div>
          </div>
        )}

        {/* Date change status banners */}
        {hasPendingDateChange && booking.requested_check_in && booking.requested_check_out && (
          <div className="mt-3 pt-3 border-t border-amber-100 bg-amber-50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-time-line text-amber-500 text-xs"></i>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-700">Date change pending approval</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Requested: <strong>{booking.requested_check_in} → {booking.requested_check_out}</strong>
                  {booking.requested_total_price && <span className="ml-1">· ₾{booking.requested_total_price}</span>}
                </p>
                <p className="text-xs text-amber-500 mt-0.5">Your original dates remain active until the host responds.</p>
              </div>
            </div>
          </div>
        )}

        {hasRejectedDateChange && (
          <div className="mt-3 pt-3 border-t border-red-100 bg-red-50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-close-circle-line text-red-400 text-xs"></i>
              </div>
              <div>
                <p className="text-xs font-semibold text-red-600">Date change request was not approved</p>
                <p className="text-xs text-red-400 mt-0.5">Your original booking dates remain unchanged. You may submit a new request.</p>
              </div>
            </div>
          </div>
        )}

        {/* Cancelled by host — explanation banner */}
        {booking.status === 'cancelled_by_host' && (
          <div className="mt-3 border-t border-red-100 pt-3">
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-information-line text-red-500 text-sm"></i>
              </div>
              <div>
                <p className="text-xs font-semibold text-red-700">This booking was cancelled by the host</p>
                <p className="text-xs text-red-500 mt-1 leading-relaxed">
                  The host cancelled this confirmed booking. You should have received an email with details.
                  {(booking.payment_status === 'refund_pending' || booking.payment_status === 'paid') && (
                    <span> Since you paid online, a <strong>refund will be processed</strong> within 5–10 business days.</span>
                  )}
                </p>
                <a
                  href="/search"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                >
                  <i className="ri-search-line text-xs"></i>
                  Browse other cottages
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Rejected — explanation banner */}
        {booking.status === 'rejected' && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="flex items-start gap-2.5 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-close-circle-line text-gray-400 text-sm"></i>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600">Booking request was not approved</p>
                {(booking as Booking & { rejection_note?: string | null }).rejection_note ? (
                  <div className="mt-1.5 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                    <p className="text-xs font-semibold text-red-600 mb-0.5 flex items-center gap-1">
                      <i className="ri-chat-1-line text-xs"></i>
                      Reason from host
                    </p>
                    <p className="text-xs text-red-500 leading-relaxed">
                      {(booking as Booking & { rejection_note?: string | null }).rejection_note}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    The host was unable to accommodate this booking request. Feel free to explore other available cottages.
                  </p>
                )}
                <a
                  href="/search"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <i className="ri-search-line text-xs"></i>
                  Browse other cottages
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Awaiting host approval — info banner */}
        {booking.status === 'pending_host_approval' && (
          <div className="mt-3 border-t border-amber-100 pt-3">
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-time-line text-amber-500 text-sm"></i>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-700">Awaiting host approval</p>
                <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                  Your booking request has been submitted. The host will review it and you will receive an email once a decision is made.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showReviewModal && booking.property_id && (
        <WriteReviewModal
          propertyId={booking.property_id}
          propertyTitle={booking.property_title}
          bookingId={booking.id}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setHasReviewed(true);
            setToast({ msg: 'Review submitted! Thank you for your feedback.', type: 'success' });
            setTimeout(() => setToast(null), 3500);
          }}
        />
      )}

      {showChangeDates && (
        <ChangeDatesModal
          booking={booking}
          onClose={() => setShowChangeDates(false)}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}
    </>
  );
}
