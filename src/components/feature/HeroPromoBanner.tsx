import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { fetchActivePromos, type Promo } from '../../lib/promos';
import { fetchOfferedProperties } from '../../lib/hostOffers';
import { useT } from '../../i18n';

/**
 * The hero's deal row — the first thing a guest sees, directly under the
 * search bar and the amenity chips, before any scrolling.
 *
 * Carries two kinds of deal side by side:
 *   • the admin's location promos ("−15% Batumi") → /search?location=…
 *   • one "Stay longer, pay less" pill, present whenever ANY host has a live
 *     free-night offer → /search?offers=1
 *
 * Compact by design: it sits over the hero photo, so it carries no section
 * heading and renders nothing at all when neither kind of deal is live. With
 * only promos live it looks exactly as it did before the offers pill existed.
 */
export default function HeroPromoBanner() {
  const { t } = useT();
  const navigate = useNavigate();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [hasOffers, setHasOffers] = useState(false);
  // Both deal sources are fetched, so the row can only be drawn once they have
  // settled. Tracked so the mobile layout can hold the slot meanwhile.
  const [promosReady, setPromosReady] = useState(!FEATURE_FLAGS.ENABLE_PROMOS);
  const [offersReady, setOffersReady] = useState(!FEATURE_FLAGS.ENABLE_HOST_OFFERS);

  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_PROMOS) return;
    let cancelled = false;
    fetchActivePromos()
      .then((p) => { if (!cancelled) setPromos(p); })
      .finally(() => { if (!cancelled) setPromosReady(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_HOST_OFFERS) return;
    let cancelled = false;
    fetchOfferedProperties()
      .then((byProperty) => {
        if (!cancelled) setHasOffers(Object.keys(byProperty).length > 0);
      })
      .finally(() => { if (!cancelled) setOffersReady(true); });
    return () => { cancelled = true; };
  }, []);

  const showPromos = FEATURE_FLAGS.ENABLE_PROMOS && promos.length > 0;
  const showOffers = FEATURE_FLAGS.ENABLE_HOST_OFFERS && hasOffers;

  // The hero stage is vertically centred, so a pill that arrives after the
  // fetches would shove the headline and the search card upward a second or two
  // after the page settles. On phones — where that jump is most obvious and the
  // row is a single pill — hold the pill's exact height until the deals are
  // known, then fade it in. Desktop keeps its existing behaviour.
  if (!promosReady || !offersReady) {
    return (
      <div className="flex justify-center mt-4 sm:hidden" aria-hidden="true">
        <span className="invisible inline-flex items-center gap-2 rounded-full pl-2 pr-3 py-1.5">
          <span className="border text-xs font-extrabold rounded-full px-2 py-0.5">−00%</span>
          <span className="text-[11px] font-bold leading-snug">&nbsp;</span>
        </span>
      </div>
    );
  }

  if (!showPromos && !showOffers) return null;

  // Two promos at most — the hero must not turn into a promo list. Each pill is
  // only as wide as its own text, centred under the chips; the offers pill
  // takes its place at the end of the same row.
  return (
    <div className="rc-promo-row flex flex-wrap justify-center gap-2 sm:gap-2.5 mt-4">
      {showPromos && promos.slice(0, 2).map((promo) => (
        <button
          key={promo.id}
          type="button"
          onClick={() => navigate(`/search?location=${encodeURIComponent(promo.location)}`)}
          title={promo.ends_at
            ? `${promo.title} — ${t('home.offerUntil', { date: new Date(promo.ends_at + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) })}`
            : promo.title}
          className="max-w-full inline-flex items-center gap-2 sm:gap-2.5 bg-gradient-to-r from-red-500 to-amber-500 rounded-full pl-2 pr-3 py-1.5 sm:pl-2.5 sm:pr-4 sm:py-2 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <span className="flex-shrink-0 bg-white/25 border border-white/30 text-white font-extrabold text-xs sm:text-[15px] rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 notranslate" translate="no">
            −{promo.discount_percent}%
          </span>
          <span className="text-white font-bold text-[11px] sm:text-[15px] leading-snug truncate min-w-0">
            {promo.title}
          </span>
          <i className="ri-arrow-right-line text-white/85 text-lg flex-shrink-0 hidden sm:inline-block"></i>
        </button>
      ))}

      {/* Free-night offers. Deliberately a different colour from the promo
          pills — a free night is not a percentage off, and the two never
          stack, so they must not read as one deal. */}
      {showOffers && (
        <button
          type="button"
          onClick={() => navigate('/search?offers=1')}
          title={t('home.offersSub')}
          className="max-w-full inline-flex items-center gap-2 sm:gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full pl-2 pr-3 py-1.5 sm:pl-2.5 sm:pr-4 sm:py-2 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <span className="flex-shrink-0 bg-white/25 border border-white/30 text-white rounded-full w-[22px] h-[22px] sm:w-8 sm:h-8 flex items-center justify-center">
            <i className="ri-gift-line text-[13px] sm:text-[17px]"></i>
          </span>
          <span className="text-white font-bold text-[11px] sm:text-[15px] leading-snug truncate min-w-0">
            {t('home.offersTitle')}
          </span>
          <i className="ri-arrow-right-line text-white/85 text-lg flex-shrink-0 hidden sm:inline-block"></i>
        </button>
      )}
    </div>
  );
}
