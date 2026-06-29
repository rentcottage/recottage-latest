import { useRef, useState, useEffect, useCallback } from 'react';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

const HCAPTCHA_SITE_KEY = '7c3ed03a-c4f2-4bd4-8bda-e8a291bc5ede';

interface BlockedRange {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
}

interface ICalBlockedRange {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  platform: string | null;
  summary: string | null;
}

interface BookingWidgetProps {
  property: {
    id: string;
    title: string;
    location: string;
    price: number;
    rating: number;
    reviews: number;
    maxGuests?: number;
    accepted_payment_methods?: 'online_only' | 'pay_at_property_only' | 'both';
  };
  pricingType: 'fixed' | 'per_guest';
  guestPricingTiers: Array<{ min_guests: number; max_guests: number; price_per_night: number }>;
  blockedRanges: BlockedRange[];
  icalBlockedRanges: ICalBlockedRange[];
  checkIn: string;
  checkOut: string;
  guests: string;
  onCheckInChange: (v: string) => void;
  onCheckOutChange: (v: string) => void;
  onGuestsChange: (v: string) => void;
  isSubmitting: boolean;
  submitStatus: 'idle' | 'success' | 'error' | 'unauthenticated';
  bookingError: string;
  paymentMethod: 'pay_now' | 'pay_at_property';
  onPaymentMethodChange: (v: 'pay_now' | 'pay_at_property') => void;
  onBook: () => void;
  isDateRangeBlocked: (start: string, end: string) => boolean;
  getICalConflictPlatforms: (start: string, end: string) => string[];
  currentPricePerNight: number;
  calculateNights: () => number;
  getTotalPrice: () => number;
  onCaptchaVerify: (token: string) => void;
  onCaptchaExpire: () => void;
  captchaToken: string;
  /** When true, the logged-in user is an approved travel agency. */
  corporateMode?: boolean;
  /** Client name override used for agency bookings (the host sees this as the guest). */
  corporateClientName?: string;
  onCorporateClientNameChange?: (v: string) => void;
}

/** Detect the active Google Translate language from the cookie */
function detectGoogleTranslateLang(): string {
  try {
    const cookies = document.cookie.split('; ');
    const gt = cookies.find((c) => c.startsWith('googtrans='));
    if (gt) {
      const parts = gt.split('=')[1].split('/');
      return parts[parts.length - 1] ?? 'en';
    }
  } catch {
    // ignore
  }
  return 'en';
}

// ─── Booking Form ─────────────────────────────────────────────────────────────
// Defined OUTSIDE BookingWidget so React never remounts it on parent re-renders.
interface BookingFormProps {
  property: BookingWidgetProps['property'];
  pricingType: BookingWidgetProps['pricingType'];
  blockedRanges: BlockedRange[];
  icalBlockedRanges: ICalBlockedRange[];
  checkIn: string;
  checkOut: string;
  guests: string;
  onCheckInChange: (v: string) => void;
  onCheckOutChange: (v: string) => void;
  onGuestsChange: (v: string) => void;
  isSubmitting: boolean;
  submitStatus: BookingWidgetProps['submitStatus'];
  bookingError: string;
  paymentMethod: BookingWidgetProps['paymentMethod'];
  onPaymentMethodChange: (v: 'pay_now' | 'pay_at_property') => void;
  onBook: () => void;
  isDateRangeBlocked: (start: string, end: string) => boolean;
  getICalConflictPlatforms: (start: string, end: string) => string[];
  currentPricePerNight: number;
  calculateNights: () => number;
  getTotalPrice: () => number;
  onCaptchaVerify: (token: string) => void;
  onCaptchaExpire: () => void;
  captchaToken: string;
  captchaRef: React.RefObject<HCaptchaLib | null>;
  /** 'ka' for Georgian, 'en' for English, etc. */
  lang: string;
  corporateMode?: boolean;
  corporateClientName?: string;
  onCorporateClientNameChange?: (v: string) => void;
}

function BookingForm({
  property,
  blockedRanges,
  checkIn,
  checkOut,
  guests,
  onCheckInChange,
  onCheckOutChange,
  onGuestsChange,
  isSubmitting,
  submitStatus,
  bookingError,
  paymentMethod,
  onPaymentMethodChange,
  onBook,
  isDateRangeBlocked,
  getICalConflictPlatforms,
  currentPricePerNight,
  calculateNights,
  getTotalPrice,
  onCaptchaVerify,
  onCaptchaExpire,
  captchaToken,
  captchaRef,
  lang,
  corporateMode,
  corporateClientName,
  onCorporateClientNameChange,
}: BookingFormProps) {
  const nights = calculateNights();
  const isBlocked = checkIn && checkOut ? isDateRangeBlocked(checkIn, checkOut) : false;
  const conflictPlatforms = checkIn && checkOut ? getICalConflictPlatforms(checkIn, checkOut) : [];
  const isManualBlock = blockedRanges.some((r) => !(checkOut < r.start_date || checkIn > r.end_date));
  const hasAirbnb = conflictPlatforms.some((p) => p.toLowerCase().includes('airbnb'));
  const hasBookingCom = conflictPlatforms.some((p) => p.toLowerCase().includes('booking'));
  const hasOtherExternal = conflictPlatforms.some(
    (p) => !p.toLowerCase().includes('airbnb') && !p.toLowerCase().includes('booking'),
  );

  // Button label: always use the correct Georgian word, never rely on Google Translate
  const bookBtnLabel = lang === 'ka' ? 'დაჯავშნე' : 'Book';
  const submittingLabel =
    paymentMethod === 'pay_at_property'
      ? lang === 'ka' ? 'იგზავნება...' : 'Submitting booking...'
      : lang === 'ka' ? 'გადამისამართება...' : 'Redirecting to Bank of Georgia...';

  return (
    <form data-readdy-form id="cottage-booking">
      {corporateMode && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 mb-4">
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 mt-0.5 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <i className="ri-briefcase-line text-base"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-emerald-900 font-semibold text-xs leading-tight mb-0.5">
                Booking on behalf of your client
              </p>
              <p className="text-emerald-700 text-[11px] leading-snug">
                5% commission will be credited to your agency dashboard.
              </p>
              <div className="mt-2.5">
                <label className="block text-[11px] font-semibold text-emerald-900 mb-1">Client name (optional)</label>
                <input
                  type="text"
                  value={corporateClientName ?? ''}
                  onChange={(e) => onCorporateClientNameChange?.(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full px-2.5 py-1.5 text-xs border border-emerald-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status messages */}
      {submitStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-green-500"></i>
            </div>
            <div>
              <p className="text-green-800 font-medium text-sm">Booking request sent!</p>
              <p className="text-green-700 text-xs mt-0.5">
                {paymentMethod === 'pay_at_property'
                  ? "You'll pay at the property. The host will review your request shortly."
                  : 'The host will respond shortly.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {submitStatus === 'unauthenticated' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-lock-line text-yellow-500"></i>
            </div>
            <p className="text-yellow-800 font-medium text-sm">Please log in to request a booking.</p>
          </div>
        </div>
      )}

      {submitStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-error-warning-line text-red-500"></i>
            </div>
            <div>
              <p className="text-red-800 font-medium text-sm">
                {bookingError?.includes('phone number') ? 'Phone number required' : 'Booking failed'}
              </p>
              <p className="text-red-700 text-xs mt-0.5 leading-relaxed">
                {bookingError || 'An unexpected error occurred. Please try again.'}
              </p>
              {bookingError?.includes('phone number') && (
                <a
                  href="/profile"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-red-600 hover:text-red-700 underline underline-offset-2"
                >
                  <i className="ri-user-line text-xs"></i>
                  Go to My Profile
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Check-in</label>
          <input
            type="date"
            name="checkInDate"
            value={checkIn}
            onChange={(e) => onCheckInChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Check-out</label>
          <input
            type="date"
            name="checkOutDate"
            value={checkOut}
            onChange={(e) => onCheckOutChange(e.target.value)}
            min={checkIn || new Date().toISOString().split('T')[0]}
            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Blocked dates warning */}
      {checkIn && checkOut && isBlocked && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-3 mb-4">
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="ri-error-warning-line text-amber-500 text-sm"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">These dates are already booked</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              {conflictPlatforms.length > 0 ? (
                <>
                  Unavailable due to bookings on{' '}
                  {[
                    hasAirbnb && 'Airbnb',
                    hasBookingCom && 'Booking.com',
                    hasOtherExternal && 'an external platform',
                    isManualBlock && 'host block',
                  ]
                    .filter(Boolean)
                    .join(' and ')}
                  .
                </>
              ) : (
                'The host has blocked part of your selected period.'
              )}
              {' '}Please choose different dates.
            </p>
            {conflictPlatforms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {hasAirbnb && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                    <i className="ri-home-4-line text-xs"></i>Airbnb
                  </span>
                )}
                {hasBookingCom && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-medium">
                    <i className="ri-global-line text-xs"></i>Booking.com
                  </span>
                )}
                {hasOtherExternal && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                    <i className="ri-calendar-close-line text-xs"></i>External
                  </span>
                )}
                {isManualBlock && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">
                    <i className="ri-lock-line text-xs"></i>Host blocked
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unavailable periods */}
      {blockedRanges.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1.5 font-medium">Unavailable periods:</p>
          <div className="space-y-1">
            {blockedRanges.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-2 h-2 flex items-center justify-center">
                  <i className="ri-close-line text-red-400"></i>
                </div>
                <span>
                  {new Date(r.start_date + 'T00:00:00').toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  })}
                  {' — '}
                  {new Date(r.end_date + 'T00:00:00').toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            ))}
            {blockedRanges.length > 3 && (
              <p className="text-xs text-gray-400">+{blockedRanges.length - 3} more unavailable periods</p>
            )}
          </div>
        </div>
      )}

      {/* Guests */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-gray-700">Guests</label>
          {property.maxGuests && (
            <span className="text-xs text-gray-400">Max {property.maxGuests} guests</span>
          )}
        </div>
        <select
          name="numberOfGuests"
          value={guests}
          onChange={(e) => onGuestsChange(e.target.value)}
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm pr-8"
        >
          {Array.from({ length: property.maxGuests ?? 20 }, (_, i) => i + 1).map((num) => (
            <option key={num} value={num}>
              {num} guest{num > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Payment Method */}
      {(() => {
        const accepted = (property?.accepted_payment_methods as 'online_only' | 'pay_at_property_only' | 'both') || 'both';
        const showOnline = FEATURE_FLAGS.ENABLE_PAY_NOW && (accepted === 'online_only' || accepted === 'both');
        const showAtProperty = accepted === 'pay_at_property_only' || accepted === 'both';
        const optionCount = (showOnline ? 1 : 0) + (showAtProperty ? 1 : 0);
        return (
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-700 mb-2">Payment Method</label>
            <div className={`grid gap-2 ${optionCount === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {showOnline && (
                <button
                  type="button"
                  onClick={() => onPaymentMethodChange('pay_now')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    paymentMethod === 'pay_now'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 flex items-center justify-center ${paymentMethod === 'pay_now' ? 'text-red-500' : 'text-gray-400'}`}>
                    <i className="ri-bank-card-line text-base"></i>
                  </div>
                  <span className={`text-xs font-semibold ${paymentMethod === 'pay_now' ? 'text-red-600' : 'text-gray-600'}`}>Pay Now</span>
                  <span className={`text-xs leading-tight text-center ${paymentMethod === 'pay_now' ? 'text-red-400' : 'text-gray-400'}`}>Online payment</span>
                </button>
              )}
              {showAtProperty && (
                <button
                  type="button"
                  onClick={() => onPaymentMethodChange('pay_at_property')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    paymentMethod === 'pay_at_property'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 flex items-center justify-center ${paymentMethod === 'pay_at_property' ? 'text-red-500' : 'text-gray-400'}`}>
                    <i className="ri-home-heart-line text-base"></i>
                  </div>
                  <span className={`text-xs font-semibold ${paymentMethod === 'pay_at_property' ? 'text-red-600' : 'text-gray-600'}`}>Pay at Property</span>
                  <span className={`text-xs leading-tight text-center ${paymentMethod === 'pay_at_property' ? 'text-red-400' : 'text-gray-400'}`}>Pay on arrival</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Price breakdown */}
      {checkIn && checkOut && nights > 0 && (
        <div className="border-t border-gray-200 pt-4 mb-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">
              ₾{currentPricePerNight} × {nights} nights
            </span>
            <span className="text-gray-900">₾{currentPricePerNight * nights}</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">₾{getTotalPrice()}</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <div className="w-3.5 h-3.5 flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-green-500 text-xs"></i>
            </div>
            <span className="text-xs text-gray-400">All fees included · No hidden charges</span>
          </div>
        </div>
      )}

      {/* CAPTCHA */}
      <div className="flex justify-center mb-4">
        <HCaptchaLib
          ref={captchaRef}
          sitekey={HCAPTCHA_SITE_KEY}
          onVerify={onCaptchaVerify}
          onExpire={onCaptchaExpire}
          onError={onCaptchaExpire}
          theme="light"
        />
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={onBook}
        disabled={isSubmitting || !captchaToken}
        className={`notranslate w-full py-3 rounded-lg font-medium cursor-pointer whitespace-nowrap transition-colors ${
          isSubmitting || !captchaToken
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-red-500 hover:bg-red-600 text-white'
        }`}
        translate="no"
      >
        {isSubmitting ? submittingLabel : bookBtnLabel}
      </button>

      <div className="flex items-center justify-center gap-2 mt-3">
        <div className="w-4 h-4 flex items-center justify-center">
          <i
            className={`${
              paymentMethod === 'pay_at_property' ? 'ri-home-heart-line' : 'ri-bank-card-line'
            } text-gray-400 text-sm`}
          ></i>
        </div>
        <p className="text-xs text-gray-400 text-center">
          {paymentMethod === 'pay_at_property'
            ? 'You will pay cash or card when you arrive'
            : 'Secure payment via Bank of Georgia'}
        </p>
      </div>
    </form>
  );
}

// ─── BookingWidget ─────────────────────────────────────────────────────────────
export default function BookingWidget({
  property,
  pricingType,
  blockedRanges,
  icalBlockedRanges,
  checkIn,
  checkOut,
  guests,
  onCheckInChange,
  onCheckOutChange,
  onGuestsChange,
  isSubmitting,
  submitStatus,
  bookingError,
  paymentMethod,
  onPaymentMethodChange,
  onBook,
  isDateRangeBlocked,
  getICalConflictPlatforms,
  currentPricePerNight,
  calculateNights,
  getTotalPrice,
  onCaptchaVerify,
  onCaptchaExpire,
  captchaToken,
  corporateMode,
  corporateClientName,
  onCorporateClientNameChange,
}: BookingWidgetProps) {
  const captchaRef = useRef<HCaptchaLib>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lang, setLang] = useState<string>('en');

  // Detect Google Translate language on mount and whenever the cookie might change
  useEffect(() => {
    const detect = () => setLang(detectGoogleTranslateLang());
    detect();
    // Re-detect after a short delay (Google Translate sets cookie asynchronously)
    const timer = setInterval(detect, 1500);
    return () => clearInterval(timer);
  }, []);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen]);

  const nights = calculateNights();

  // Shared props for BookingForm — memoised to avoid unnecessary re-renders
  const formProps: BookingFormProps = {
    property,
    pricingType,
    blockedRanges,
    icalBlockedRanges,
    checkIn,
    checkOut,
    guests,
    onCheckInChange,
    onCheckOutChange,
    onGuestsChange,
    isSubmitting,
    submitStatus,
    bookingError,
    paymentMethod,
    onPaymentMethodChange,
    onBook,
    isDateRangeBlocked,
    getICalConflictPlatforms,
    currentPricePerNight,
    calculateNights,
    getTotalPrice,
    onCaptchaVerify,
    onCaptchaExpire,
    captchaToken,
    captchaRef,
    lang,
    corporateMode,
    corporateClientName,
    onCorporateClientNameChange,
  };

  // "Reserve" sticky bar label
  const reserveLabel = lang === 'ka' ? 'დაჯავშნე' : 'Book';

  const handleOpenSheet = useCallback(() => setSheetOpen(true), []);
  const handleCloseSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <>
      {/* ── Desktop: sticky sidebar card (lg+) ─────────────────── */}
      <div className="hidden lg:block">
        <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-24">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-2xl font-bold text-gray-900">₾{currentPricePerNight}</span>
              <span className="text-gray-600 ml-1">/ night</span>
              {pricingType === 'per_guest' && (
                <p className="text-gray-700 mt-0.5 font-medium text-sm">Price varies by guest count</p>
              )}
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 flex items-center justify-center mr-1">
                <i className="ri-star-fill text-yellow-400"></i>
              </div>
              <span className="font-medium">{property.rating}</span>
              <span className="text-gray-600 ml-1 text-sm">({property.reviews})</span>
            </div>
          </div>
          <BookingForm {...formProps} />
        </div>
      </div>

      {/* ── Mobile: sticky bottom bar + slide-up sheet ─────────── */}
      <div className="lg:hidden">
        {/* Sticky bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">₾{currentPricePerNight}</span>
              <span className="text-xs text-gray-500">/ night</span>
            </div>
            {checkIn && checkOut && nights > 0 ? (
              <p className="text-xs text-gray-500 truncate">
                ₾{getTotalPrice()} total · {nights} night{nights !== 1 ? 's' : ''}
              </p>
            ) : (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 flex items-center justify-center">
                  <i className="ri-star-fill text-yellow-400 text-xs"></i>
                </div>
                <span className="text-xs text-gray-500">
                  {property.rating} ({property.reviews} reviews)
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleOpenSheet}
            className="notranslate flex-shrink-0 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            translate="no"
          >
            {reserveLabel}
          </button>
        </div>

        {/* Bottom sheet backdrop */}
        {sheetOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={handleCloseSheet}
          />
        )}

        {/* Bottom sheet panel */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl transition-transform duration-300 ease-out ${
            sheetOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ maxHeight: '92vh' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Sheet header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div>
              <span className="text-lg font-bold text-gray-900">₾{currentPricePerNight}</span>
              <span className="text-gray-500 text-sm ml-1">/ night</span>
            </div>
            <button
              onClick={handleCloseSheet}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full cursor-pointer"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>

          {/* Scrollable form content */}
          <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(92vh - 100px)' }}>
            <BookingForm {...formProps} />
            {/* Extra bottom padding so content clears the safe area */}
            <div className="h-6" />
          </div>
        </div>
      </div>
    </>
  );
}
