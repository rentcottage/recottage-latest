import { useRef, useState, useEffect, useCallback } from 'react';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useT } from '@/i18n';
import { offerLabel, offerWindowParts, stayInWindow, type WidgetOffer } from '@/lib/hostOffers';

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
  bookingErrorCode?: 'phone_required' | null;
  paymentMethod: 'pay_now' | 'pay_at_property';
  onPaymentMethodChange: (v: 'pay_now' | 'pay_at_property') => void;
  onBook: () => void;
  isDateRangeBlocked: (start: string, end: string) => boolean;
  getICalConflictPlatforms: (start: string, end: string) => string[];
  currentPricePerNight: number;
  calculateNights: () => number;
  getTotalPrice: () => number;
  /** Active location promo — adds a discount line to the price breakdown. */
  activePromo?: { title: string; discount_percent: number } | null;
  /** The host's own offer for this stay — "2+1" nights or "−10%" — for the badge. */
  activeOffer?: WidgetOffer | null;
  /** Nights the offer makes free — 0 for a discount offer, or when it doesn't win. */
  offerFreeNights?: number;
  /** The offer is the discount actually being charged (not just advertised). */
  offerApplied?: boolean;
  /** The chosen dates earn the offer — false while it is only being advertised. */
  offerEarned?: boolean;
  onCaptchaVerify: (token: string) => void;
  onCaptchaExpire: () => void;
  captchaToken: string;
  /** When true, the logged-in user is an approved travel agency. */
  corporateMode?: boolean;
  /** Client name override used for agency bookings (the host sees this as the guest). */
  corporateClientName?: string;
  onCorporateClientNameChange?: (v: string) => void;
}

/** ₾ amounts: whole numbers stay whole, fractional show 2 decimals. */
function formatGel(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
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
  bookingErrorCode?: 'phone_required' | null;
  paymentMethod: BookingWidgetProps['paymentMethod'];
  onPaymentMethodChange: (v: 'pay_now' | 'pay_at_property') => void;
  onBook: () => void;
  isDateRangeBlocked: (start: string, end: string) => boolean;
  getICalConflictPlatforms: (start: string, end: string) => string[];
  currentPricePerNight: number;
  calculateNights: () => number;
  getTotalPrice: () => number;
  activePromo?: { title: string; discount_percent: number } | null;
  activeOffer?: WidgetOffer | null;
  offerFreeNights?: number;
  offerApplied?: boolean;
  offerEarned?: boolean;
  onCaptchaVerify: (token: string) => void;
  onCaptchaExpire: () => void;
  captchaToken: string;
  captchaRef: React.RefObject<HCaptchaLib | null>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  plural: (key: string, count: number, vars?: Record<string, string | number>) => string;
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
  bookingErrorCode,
  paymentMethod,
  onPaymentMethodChange,
  onBook,
  isDateRangeBlocked,
  getICalConflictPlatforms,
  currentPricePerNight,
  calculateNights,
  getTotalPrice,
  activePromo,
  activeOffer,
  offerFreeNights = 0,
  offerApplied = false,
  offerEarned = false,
  onCaptchaVerify,
  onCaptchaExpire,
  captchaToken,
  captchaRef,
  t,
  plural,
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

  const bookBtnLabel = t('property.booking.bookBtn');
  const submittingLabel =
    paymentMethod === 'pay_at_property'
      ? t('property.booking.submittingBooking')
      : t('property.booking.redirectingToBog');

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
                {t('property.booking.bookOnBehalf')}
              </p>
              <p className="text-emerald-700 text-[11px] leading-snug">
                {t('property.booking.commissionNote')}
              </p>
              <div className="mt-2.5">
                <label className="block text-[11px] font-semibold text-emerald-900 mb-1">{t('property.booking.clientNameLabel')}</label>
                <input
                  type="text"
                  value={corporateClientName ?? ''}
                  onChange={(e) => onCorporateClientNameChange?.(e.target.value)}
                  placeholder={t('property.booking.clientNamePlaceholder')}
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
              <p className="text-green-800 font-medium text-sm">{t('property.booking.requestSentTitle')}</p>
              <p className="text-green-700 text-xs mt-0.5">
                {paymentMethod === 'pay_at_property'
                  ? t('property.booking.requestSentPayAtProperty')
                  : t('property.booking.requestSentPayNow')}
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
            <p className="text-yellow-800 font-medium text-sm">{t('property.booking.loginRequired')}</p>
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
                {bookingErrorCode === 'phone_required' ? t('property.booking.phoneNumberRequiredTitle') : t('property.booking.bookingFailedTitle')}
              </p>
              <p className="text-red-700 text-xs mt-0.5 leading-relaxed">
                {bookingError || t('property.booking.unexpectedError')}
              </p>
              {bookingErrorCode === 'phone_required' && (
                <a
                  href="/profile"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-red-600 hover:text-red-700 underline underline-offset-2"
                >
                  <i className="ri-user-line text-xs"></i>
                  {t('property.booking.goToProfile')}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dates + guests — grouped bordered box (mockup .fields) */}
      <div className="border-[1.5px] border-line rounded-xl overflow-hidden mb-4">
        <div className="grid grid-cols-2">
          <div className="p-3 border-b border-r border-line">
            <label className="block text-[10.5px] font-bold uppercase tracking-wide text-ink mb-0.5">{t('property.booking.checkIn')}</label>
            <input
              type="date"
              name="checkInDate"
              value={checkIn}
              onChange={(e) => onCheckInChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-transparent outline-none text-sm text-ink"
            />
          </div>
          <div className="p-3 border-b border-line">
            <label className="block text-[10.5px] font-bold uppercase tracking-wide text-ink mb-0.5">{t('property.booking.checkOut')}</label>
            <input
              type="date"
              name="checkOutDate"
              value={checkOut}
              onChange={(e) => onCheckOutChange(e.target.value)}
              min={checkIn || new Date().toISOString().split('T')[0]}
              className="w-full bg-transparent outline-none text-sm text-ink"
            />
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <label className="block text-[10.5px] font-bold uppercase tracking-wide text-ink">{t('property.booking.guests')}</label>
            {property.maxGuests && (
              <span className="text-[11px] text-soft">{t('property.booking.maxGuests', { count: property.maxGuests })}</span>
            )}
          </div>
          <select
            name="numberOfGuests"
            value={guests}
            onChange={(e) => onGuestsChange(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-ink mt-0.5 pr-6"
          >
            {Array.from({ length: property.maxGuests ?? 20 }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>
                {plural('property.booking.guestOption', num)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Blocked dates warning */}
      {checkIn && checkOut && isBlocked && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-3 mb-4">
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="ri-error-warning-line text-amber-500 text-sm"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">{t('property.booking.datesBookedTitle')}</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              {conflictPlatforms.length > 0 ? (
                t('property.booking.unavailableAirbnbBooking', {
                  platforms: [
                    hasAirbnb && t('property.booking.platformAirbnb'),
                    hasBookingCom && t('property.booking.platformBookingCom'),
                    hasOtherExternal && t('property.booking.platformExternal'),
                    isManualBlock && t('property.booking.platformHostBlock'),
                  ]
                    .filter(Boolean)
                    .join(' & '),
                })
              ) : (
                t('property.booking.unavailableGeneric')
              )}
              {' '}{t('property.booking.chooseDifferentDates')}
            </p>
            {conflictPlatforms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {hasAirbnb && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                    <i className="ri-home-4-line text-xs"></i>{t('property.booking.platformAirbnb')}
                  </span>
                )}
                {hasBookingCom && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-medium">
                    <i className="ri-global-line text-xs"></i>{t('property.booking.platformBookingCom')}
                  </span>
                )}
                {hasOtherExternal && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                    <i className="ri-calendar-close-line text-xs"></i>{t('property.booking.badgeExternal')}
                  </span>
                )}
                {isManualBlock && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">
                    <i className="ri-lock-line text-xs"></i>{t('property.booking.badgeHostBlocked')}
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
          <p className="text-xs text-gray-500 mb-1.5 font-medium">{t('property.booking.unavailablePeriods')}</p>
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
              <p className="text-xs text-gray-400">{t('property.booking.morePeriods', { count: blockedRanges.length - 3 })}</p>
            )}
          </div>
        </div>
      )}


      {/* Payment Method */}
      {(() => {
        const accepted = (property?.accepted_payment_methods as 'online_only' | 'pay_at_property_only' | 'both') || 'both';
        const showOnline = FEATURE_FLAGS.ENABLE_PAY_NOW && (accepted === 'online_only' || accepted === 'both');
        const showAtProperty = accepted === 'pay_at_property_only' || accepted === 'both';
        const optionCount = (showOnline ? 1 : 0) + (showAtProperty ? 1 : 0);
        return (
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-700 mb-2">{t('property.booking.paymentMethodLabel')}</label>
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
                  <span className={`text-xs font-semibold ${paymentMethod === 'pay_now' ? 'text-red-600' : 'text-gray-600'}`}>{t('property.booking.payNow')}</span>
                  <span className={`text-xs leading-tight text-center ${paymentMethod === 'pay_now' ? 'text-red-400' : 'text-gray-400'}`}>{t('property.booking.payNowSub')}</span>
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
                  <span className={`text-xs font-semibold ${paymentMethod === 'pay_at_property' ? 'text-red-600' : 'text-gray-600'}`}>{t('property.booking.payAtProperty')}</span>
                  <span className={`text-xs leading-tight text-center ${paymentMethod === 'pay_at_property' ? 'text-red-400' : 'text-gray-400'}`}>{t('property.booking.payAtPropertySub')}</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* An offer is advertised but these dates don't earn it — say so, rather
          than leaving the guest to wonder why the badge changed nothing. */}
      {activeOffer && nights > 0 && !offerEarned && (() => {
        // Two quite different reasons an offer doesn't apply, and a guest can
        // only act on the one that's actually true: their dates are outside
        // the offer's window, or their stay is shorter than one full cycle
        // (a 2+1 needs 3 nights before a night can be free). Saying both at
        // once — as this notice used to — reads as "something is wrong" and
        // leaves the guest guessing which lever to pull.
        const outsideWindow = !stayInWindow(activeOffer, checkIn, checkOut);
        const cycle = activeOffer.offer_type === 'free_nights'
          ? Number(activeOffer.buy_nights) + Number(activeOffer.free_nights)
          : 0;
        const win = offerWindowParts(activeOffer);
        let message: string;
        if (outsideWindow && win) {
          message = win.kind === 'between'
            ? t('property.booking.offerMissWindowBetween', { from: win.from!, to: win.to! })
            : win.kind === 'from'
            ? t('property.booking.offerMissWindowFrom', { date: win.date! })
            : t('property.booking.offerMissWindowUntil', { date: win.date! });
        } else if (cycle > 0 && nights < cycle) {
          message = plural('property.booking.offerMissTooShort', cycle);
        } else {
          message = t('property.booking.offerNotEarned');
        }
        return (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <i className="ri-information-line flex-shrink-0 mt-0.5"></i>
            <span>{message}</span>
          </p>
        );
      })()}

      {/* Price breakdown */}
      {checkIn && checkOut && nights > 0 && (
        <div className="border-t border-gray-200 pt-4 mb-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">
              {t('property.booking.nightsLine', { price: currentPricePerNight, nights })}
            </span>
            {/* Value spans are notranslate: Google Translate wraps text nodes in
                <font> tags which blocks React from updating them (e.g. when the
                promo loads async and the total changes). Numbers need no translation. */}
            <span className="text-gray-900 notranslate" translate="no">₾{formatGel(currentPricePerNight * nights)}</span>
          </div>
          {activePromo && (
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1.5 text-green-600 font-medium min-w-0">
                <i className="ri-price-tag-3-line text-sm flex-shrink-0"></i>
                <span className="truncate">{t('property.booking.promoLabel')} <span className="notranslate" translate="no">−{activePromo.discount_percent}%</span></span>
              </span>
              <span className="text-green-600 font-medium whitespace-nowrap notranslate" translate="no">
                −₾{formatGel(currentPricePerNight * nights - getTotalPrice())}
              </span>
            </div>
          )}
          {/* Host free-night offer. Mutually exclusive with the promo line —
              the page passes only the discount that actually won. */}
          {offerApplied && activeOffer && (
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1.5 text-green-600 font-medium min-w-0">
                <i className={`${activeOffer.offer_type === 'discount' ? 'ri-percent-line' : 'ri-gift-line'} text-sm flex-shrink-0`}></i>
                <span className="truncate">
                  {activeOffer.offer_type === 'discount'
                    ? t('property.booking.offerDiscountLabel')
                    : t('property.booking.offerLabel', { count: offerFreeNights })}{' '}
                  <span className="notranslate" translate="no">({offerLabel(activeOffer)})</span>
                </span>
              </span>
              <span className="text-green-600 font-medium whitespace-nowrap notranslate" translate="no">
                −₾{formatGel(currentPricePerNight * nights - getTotalPrice())}
              </span>
            </div>
          )}
          {/* Service fee — always ₾0 (matches the reference's itemized breakdown). */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">{t('property.booking.serviceFee')}</span>
            <span className="text-gray-900 notranslate" translate="no">₾0</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
            <span className="text-gray-900">{t('property.booking.total')}</span>
            <span className="text-gray-900 notranslate" translate="no">₾{formatGel(getTotalPrice())}</span>
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
        className={`notranslate w-full py-3.5 rounded-xl font-bold text-base cursor-pointer whitespace-nowrap transition-colors ${
          isSubmitting || !captchaToken
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-red-500 hover:bg-red-600 text-white'
        }`}
        translate="no"
      >
        {isSubmitting ? submittingLabel : bookBtnLabel}
      </button>

      {/* Reassurance note (from the reference). Only for pay-at-property — a
          pay-now booking redirects to the bank and charges immediately, so
          "you pay nothing now" would be inaccurate there. */}
      {paymentMethod === 'pay_at_property' && (
        <p className="text-center text-[12.5px] text-gray-500 mt-3">
          {t('property.booking.payNothingNow')}
        </p>
      )}

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
            ? t('property.booking.payAtArrivalNote')
            : t('property.booking.securePaymentNote')}
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
  bookingErrorCode,
  paymentMethod,
  onPaymentMethodChange,
  onBook,
  isDateRangeBlocked,
  getICalConflictPlatforms,
  currentPricePerNight,
  calculateNights,
  getTotalPrice,
  activePromo,
  activeOffer,
  offerFreeNights = 0,
  offerApplied = false,
  offerEarned = false,
  onCaptchaVerify,
  onCaptchaExpire,
  captchaToken,
  corporateMode,
  corporateClientName,
  onCorporateClientNameChange,
}: BookingWidgetProps) {
  const captchaRef = useRef<HCaptchaLib>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { t, plural } = useT();

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
    bookingErrorCode,
    paymentMethod,
    onPaymentMethodChange,
    onBook,
    isDateRangeBlocked,
    getICalConflictPlatforms,
    currentPricePerNight,
    calculateNights,
    getTotalPrice,
    activePromo,
    activeOffer,
    offerFreeNights,
    offerApplied,
    offerEarned,
    onCaptchaVerify,
    onCaptchaExpire,
    captchaToken,
    captchaRef,
    t,
    plural,
    corporateMode,
    corporateClientName,
    onCorporateClientNameChange,
  };

  // "Reserve" sticky bar label
  const reserveLabel = t('property.booking.bookBtn');

  const handleOpenSheet = useCallback(() => setSheetOpen(true), []);
  const handleCloseSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <>
      {/* ── Desktop: sticky sidebar card (lg+) ─────────────────── */}
      <div className="hidden lg:block">
        <div className="bg-white border border-line rounded-card shadow-card p-6 sticky top-24">
          <div className="flex items-baseline justify-between gap-3 mb-5">
            <div className="min-w-0">
              <span className="text-[26px] font-extrabold text-ink" translate="no">₾{currentPricePerNight}</span>
              <span className="text-soft text-sm ml-1">{t('property.booking.perNight')}</span>
              {pricingType === 'per_guest' && (
                <p className="text-gray-700 mt-0.5 font-medium text-sm">{t('property.booking.priceVariesByGuests')}</p>
              )}
              {/* Promo badge — visible before dates are picked, so the guest knows
                  a discount is running; the breakdown below shows the actual saving. */}
              {activePromo && (
                <p className="mt-1.5 inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                  <i className="ri-price-tag-3-line"></i>
                  <span className="notranslate" translate="no">−{activePromo.discount_percent}%</span>
                  <span className="truncate">{t('property.booking.promoActive')}</span>
                </p>
              )}
              {/* Offer badge — visible before dates are picked, so the guest
                  knows a free night is on the table. */}
              {activeOffer && (() => {
                const win = offerWindowParts(activeOffer);
                return (
                  <span className="block mt-1.5">
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-1 rounded-full max-w-full">
                      <i className={activeOffer.offer_type === 'discount' ? 'ri-percent-line' : 'ri-gift-line'}></i>
                      {/* "2+1, 1 night free" — the label carries the shape, the
                          text says what the guest actually gets. */}
                      <span className="notranslate" translate="no">
                        {offerLabel(activeOffer)}{activeOffer.offer_type === 'discount' ? '' : ','}
                      </span>
                      <span className="truncate">
                        {activeOffer.offer_type === 'discount'
                          ? t('property.booking.offerDiscountActive')
                          : plural('property.booking.offerNightsFree', Number(activeOffer.free_nights))}
                      </span>
                    </span>
                    {/* When the deal only runs for part of the calendar, say so
                        right here — a guest must not have to guess their dates. */}
                    {(win || activeOffer.offer_type === 'free_nights') && (
                      <span className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11.5px] text-gray-500">
                        {win && (
                          <span className="flex items-center gap-1">
                            <i className="ri-calendar-line"></i>
                            <span className="notranslate" translate="no">
                              {win.kind === 'between'
                                ? t('property.booking.offerWindowBetween', { from: win.from!, to: win.to! })
                                : win.kind === 'from'
                                ? t('property.booking.offerWindowFrom', { date: win.date! })
                                : t('property.booking.offerWindowUntil', { date: win.date! })}
                            </span>
                          </span>
                        )}
                        {/* The shape "2+1" alone never says how long you must
                            stay to earn the free night. Say it plainly. */}
                        {activeOffer.offer_type === 'free_nights' && (
                          <span className="flex items-center gap-1">
                            <i className="ri-moon-line"></i>
                            <span className="notranslate" translate="no">
                              {plural('property.booking.offerMinNights',
                                Number(activeOffer.buy_nights) + Number(activeOffer.free_nights))}
                            </span>
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center text-sm font-bold flex-shrink-0 whitespace-nowrap">
              <i className="ri-star-fill text-red-500 mr-1"></i>
              <span translate="no">{property.rating}</span>
              <span className="text-soft ml-1 font-semibold" translate="no">({property.reviews})</span>
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
              <span className="text-xs text-gray-500">{t('property.booking.perNight')}</span>
            </div>
            {checkIn && checkOut && nights > 0 ? (
              <p className="text-xs text-gray-500 truncate">
                <span className="notranslate" translate="no">₾{formatGel(getTotalPrice())}</span> {t('property.booking.total').toLowerCase()} · {plural('property.booking.nightsTotal', nights)}
                {activePromo && (
                  <span className="text-green-600 font-semibold notranslate" translate="no"> · −{activePromo.discount_percent}%</span>
                )}
                {offerApplied && activeOffer && (
                  <span className="text-green-600 font-semibold notranslate" translate="no"> · {offerLabel(activeOffer)}</span>
                )}
              </p>
            ) : (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 flex items-center justify-center">
                  <i className="ri-star-fill text-yellow-400 text-xs"></i>
                </div>
                <span className="text-xs text-gray-500">
                  {property.rating} {t('property.detail.reviewsCount', { count: property.reviews })}
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
              <span className="text-gray-500 text-sm ml-1">{t('property.booking.perNight')}</span>
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
