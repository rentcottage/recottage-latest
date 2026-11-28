import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PropertyImageSlider from './PropertyImageSlider';
import { applyPromoDiscount } from '../../lib/promos';
import { offerLabel, formatPercent, type CardOffer } from '../../lib/hostOffers';
import { localizePlace, locationEyebrow } from '../../lib/locationNormalizer';
import { amenityLabel, cardAmenityOrder, AMENITY_ICON, AMENITY_ICON_FALLBACK } from '../../lib/amenityLabels';
import { useT } from '../../i18n';

/** ₾ amounts: whole numbers stay whole, fractional show 2 decimals. */
function formatGel(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** How many amenity icons a card shows before "+N". */
const CARD_AMENITY_ICONS = 3;

interface PropertyCardProps {
  id: string;
  title: string;
  location: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  /** Still accepted from callers that spread a listing; not shown on the card. */
  host?: string;
  amenities: string[];
  maxGuests?: number;
  bedrooms?: number;
  isRealListing?: boolean;
  coverPosition?: 'top' | 'center' | 'bottom';
  /**
   * Discount percent of the active promo covering this listing's location,
   * or null when none applies. Shown as a struck-through price + badge so the
   * card agrees with what checkout actually charges.
   */
  promoPercent?: number | null;
  /**
   * The host's own deal on this listing — "2+1" free nights or "−10%" off —
   * or null when none is live. Its own badge: a host offer is not the admin's
   * location promo, so it never replaces or merges with that one.
   */
  offerNights?: CardOffer | null;
}

/**
 * Listing card, photo-first: 4:3 photo, location label, name, a facts row
 * (rating only once real reviews exist · guests · bedrooms), three amenity
 * icons, and a cream footer pinned to the bottom with the price and "View".
 * The card fills its grid cell (h-full + flex-col), so every card in a row
 * ends level with no empty gap above the footer.
 */
export default function PropertyCard({
  id,
  title,
  location,
  price,
  rating,
  reviews,
  image,
  images,
  amenities,
  maxGuests,
  bedrooms,
  isRealListing,
  coverPosition,
  promoPercent,
  offerNights,
}: PropertyCardProps) {
  const { t, plural, lang } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleCardClick = () => {
    const currentParams = new URLSearchParams();
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const guests = searchParams.get('guests');
    if (checkIn) currentParams.set('checkIn', checkIn);
    if (checkOut) currentParams.set('checkOut', checkOut);
    if (guests) currentParams.set('guests', guests);
    const queryString = currentParams.toString();
    navigate(queryString ? `/property/${id}?${queryString}` : `/property/${id}`);
  };

  const photoList = images && images.length > 0 ? images : [image];

  // Listing data is stored in one canonical form (English places, English
  // amenity values) — it is the label that follows the reader's language.
  const eyebrow = locationEyebrow(localizePlace(location, lang));

  const ordered = cardAmenityOrder(amenities);
  const shownAmenities = ordered.slice(0, CARD_AMENITY_ICONS);
  const extraAmenities = ordered.length - shownAmenities.length;

  // "★ 4.9 (12) · 4 guests · 2 bedrooms". `rating` is a hardcoded 5.0 in the
  // data layer until real reviews exist, so it only shows when reviews > 0.
  const facts: { key: string; node: ReactNode }[] = [];
  if (reviews > 0) {
    facts.push({
      key: 'rating',
      node: (
        <span className="inline-flex items-center gap-0.5 font-semibold text-ink" translate="no">
          <i aria-hidden="true" className="ri-star-fill text-[11px] text-red-500" />
          {rating}
          <span className="font-normal text-soft">({reviews})</span>
        </span>
      ),
    });
  }
  if (maxGuests && maxGuests > 0) facts.push({ key: 'guests', node: plural('search.cardGuests', maxGuests) });
  if (bedrooms && bedrooms > 0) facts.push({ key: 'bedrooms', node: plural('search.cardBedrooms', bedrooms) });

  const shownPrice = promoPercent ? formatGel(applyPromoDiscount(price, promoPercent)) : String(price);

  return (
    <article
      className="@container group h-full flex flex-col bg-white rounded-card overflow-hidden cursor-pointer shadow-card transition-[translate,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      onClick={handleCardClick}
    >
      {/* Photo — 4:3; verified badge top-left, heart top-right */}
      <div className="relative">
        <PropertyImageSlider
          images={photoList}
          title={title}
          isRealListing={isRealListing}
          coverPosition={coverPosition}
          onFavoriteClick={(e) => e.stopPropagation()}
        />
        {/* Capped short of the heart: the Georgian label is long enough to run
            under it on a narrow card. */}
        {isRealListing && (
          <span className="absolute top-2 left-2 md:top-2.5 md:left-2.5 z-20 inline-flex items-center gap-1 max-w-[calc(100%-3rem)] bg-white/80 backdrop-blur-md text-ink text-[10px] md:text-[10.5px] font-semibold px-2 py-[3px] rounded-full pointer-events-none shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
            <i aria-hidden="true" className="ri-verified-badge-fill text-[11px] leading-none flex-shrink-0" />
            <span className="truncate">{t('search.badgeVerified')}</span>
          </span>
        )}
        {/* Bottom-left: the only free corner. */}
        {offerNights && (
          <span className="absolute bottom-2.5 left-2.5 z-20 inline-flex items-center gap-1 bg-gradient-to-br from-emerald-600 to-teal-500 text-white text-[12px] font-extrabold px-2.5 py-1 rounded-full pointer-events-none shadow-lg">
            <i className={`${offerNights.offer_type === 'discount' ? 'ri-percent-fill' : 'ri-gift-fill'} text-[12px] leading-none`} />
            <span className="notranslate" translate="no">{offerLabel(offerNights)}</span>
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 pt-3 pb-3 md:px-4 md:pt-3.5 flex flex-col gap-1.5 flex-1">
        {eyebrow && (
          <p className="text-[10px] md:text-[10.5px] font-semibold uppercase tracking-[0.14em] text-soft truncate leading-tight">
            {eyebrow}
          </p>
        )}

        <h3
          className="font-bold text-ink text-[15px] md:text-[16.5px] leading-snug notranslate line-clamp-2"
          translate="no"
          title={title}
        >
          {title}
        </h3>

        {facts.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2.5 @[230px]:gap-x-1.5 gap-y-0.5 text-xs md:text-[13px] text-soft leading-snug">
            {facts.map((f, i) => (
              <span key={f.key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                {/* Narrow (2-up phone) cards wrap: no dot, so a line never starts with "·". */}
                {i > 0 && <span aria-hidden="true" className="hidden @[230px]:inline text-line">·</span>}
                {f.node}
              </span>
            ))}
          </p>
        )}

        {shownAmenities.length > 0 && (
          <ul className="flex items-center gap-1.5 mt-1" aria-label={t('search.amenitiesTitle')}>
            {shownAmenities.map((a) => {
              const label = amenityLabel(a, t);
              return (
                <li
                  key={a}
                  title={label}
                  className="w-7 h-7 rounded-full border border-line flex items-center justify-center text-gray-600"
                >
                  <i aria-hidden="true" className={`${AMENITY_ICON[a] ?? AMENITY_ICON_FALLBACK} text-[14px] leading-none`} />
                  <span className="sr-only">{label}</span>
                </li>
              );
            })}
            {extraAmenities > 0 && (
              <li
                className="text-xs text-soft font-medium pl-0.5"
                title={ordered.slice(CARD_AMENITY_ICONS).map((a) => amenityLabel(a, t)).join(', ')}
              >
                <span aria-hidden="true">+{extraAmenities}</span>
                <span className="sr-only">{t('search.cardMoreAmenities', { count: extraAmenities })}</span>
              </li>
            )}
          </ul>
        )}

        {/* What the deal gets you, in words — the corner badge alone ("2+1")
            does not tell a first-time guest what to expect. */}
        {offerNights && (
          <p className="text-[11.5px] md:text-xs text-emerald-700 font-semibold truncate">
            {offerNights.offer_type === 'discount'
              ? t('search.offerDiscountLine', { percent: formatPercent(offerNights.discount_percent) })
              : t('search.offerStayPay', {
                  total: Number(offerNights.buy_nights) + Number(offerNights.free_nights),
                  paid: Number(offerNights.buy_nights),
                })}
          </p>
        )}
      </div>

      {/* Cream footer, pinned to the bottom: the card is h-full flex-col and
          the body takes flex-1, so every card in a row ends level. */}
      <div className="mt-auto bg-cream border-t border-cream-line px-3 md:px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1 flex-wrap min-w-0">
          <span className="text-[17px] md:text-[19px] font-extrabold text-ink whitespace-nowrap leading-none" translate="no">
            ₾{shownPrice}
          </span>
          {promoPercent ? (
            <span className="text-xs text-soft line-through whitespace-nowrap" translate="no">₾{price}</span>
          ) : null}
          <span className="text-xs text-soft whitespace-nowrap">{t('search.perNight')}</span>
          {promoPercent ? (
            <span className="inline-flex items-center bg-green-600 text-white text-[10.5px] font-bold px-1.5 py-0.5 rounded-full notranslate" translate="no">
              −{promoPercent}%
            </span>
          ) : null}
        </div>
        {/* A real button for keyboard users; the click bubbles to the card. On
            narrow 2-up phone cards it shrinks to a round arrow. */}
        <button
          type="button"
          aria-label={`${t('search.cardView')} — ${title}`}
          className="flex-shrink-0 inline-flex items-center justify-center gap-1 h-8 min-w-8 px-2 @[230px]:px-3.5 rounded-full bg-ink text-white text-xs font-bold hover:bg-black transition-colors cursor-pointer"
        >
          <span className="hidden @[230px]:inline">{t('search.cardView')}</span>
          <i aria-hidden="true" className="ri-arrow-right-line text-[14px] leading-none" />
        </button>
      </div>
    </article>
  );
}
