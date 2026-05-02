import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import SEO from '../../components/feature/SEO';

const BOG_FN_BASE = 'https://fkjkyzpunatzkovqxyzp.supabase.co/functions/v1/bog-payment';

export default function PaymentFailedPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('booking_id');
  const [statusUpdated, setStatusUpdated] = useState(false);

  // ── Fallback: ensure booking is marked as failed/cancelled in DB ──────
  // BOG async callback can arrive after the user is already here.
  // mark-failed is a safe idempotent endpoint — it won't downgrade a paid booking.
  useEffect(() => {
    if (!bookingId) return;

    const markFailed = async () => {
      try {
        const res = await fetch(
          `${BOG_FN_BASE}?action=mark-failed&booking_id=${encodeURIComponent(bookingId)}`
        );
        if (!res.ok) return;

        const json = await res.json();

        // Edge case: BOG says payment is actually successful — redirect to success page
        if (json.actualStatus === 'paid') {
          navigate(`/payment/success?booking_id=${encodeURIComponent(bookingId)}`, { replace: true });
          return;
        }

        setStatusUpdated(true);
      } catch {
        // Non-fatal — page still shows correctly
      }
    };

    markFailed();
  }, [bookingId, navigate]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO
        title="Payment Failed — RentCottage.Ge"
        description="Your payment could not be completed. No charges have been made. Please try again."
        noIndex={true}
        canonical="/payment/failed"
      />
      <Header />

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          {/* Icon */}
          <div className="w-20 h-20 flex items-center justify-center rounded-full bg-red-50 border-2 border-red-200 mx-auto mb-6">
            <i className="ri-close-circle-line text-4xl text-red-500"></i>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment Failed or Cancelled</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            Your payment was not completed. No charges have been made to your account.
            You can try again or choose a different payment method.
          </p>

          {/* Reason hints */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 text-left mb-8">
            <p className="text-sm font-semibold text-gray-700 mb-3">Common reasons for failure:</p>
            <ul className="space-y-2">
              {[
                'Insufficient funds on card',
                'Card declined by the bank',
                'Payment session timed out',
                'Transaction cancelled by you',
                '3D Secure authentication failed',
              ].map((reason, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-information-line text-gray-400 text-xs"></i>
                  </div>
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {bookingId && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6 text-left">
              <p className="text-xs text-red-600 font-medium mb-0.5">Reference</p>
              <p className="text-xs font-mono text-gray-600 break-all">{bookingId}</p>
              {statusUpdated && (
                <p className="text-xs text-gray-400 mt-1">Booking status updated.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate(-1 as never)}
              className="w-full bg-red-500 text-white py-3 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-red-600 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/search')}
              className="w-full border border-gray-200 text-gray-700 py-3 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-colors"
            >
              Browse Cottages
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            Need help?{' '}
            <a href="mailto:info.rentcottage@gmail.com" className="text-red-500 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
