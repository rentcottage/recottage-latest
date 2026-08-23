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

  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_PROMOS) return;
    let cancelled = false;
    fetchActivePromos().then((p) => { if (!cancelled) setPromos(p); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_HOST_OFFERS) return;
    let cancelled = false;
    fetchOfferedProperties().then((byProperty) => {
      if (!cancelled) setHasOffers(Object.keys(byProperty).length > 0);
    });
    return () => { cancelled = true; };
  }, []);

  const showPromos = FEATURE_FLAGS.ENABLE_PROMOS && promos.length > 0;
  const showOffers = FEATURE_FLAGS.ENABLE_HOST_OFFERS && hasOffers;
  if (!showPromos && !showOffers) return null;

  // Two promos at most — the hero must not turn into a promo list. Each pill is
  // only as wide as its own text, centred under the chips; the offers pill
  // takes its place at the end of the same row.
  return (
    <div className="flex flex-wrap justify-center gap-2.5 mt-4">
      {showPromos && promos.slice(0, 2).map((promo) => (
        <button
          key={promo.id}
          type="button"
          onClick={() => navigate(`/search?location=${encodeURIComponent(promo.location)}`)}
          title={promo.ends_at
            ? `${promo.title} — ${t('home.offerUntil', { date: new Date(promo.ends_at + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) })}`
            : promo.title}
          className="max-w-full inline-flex items-center gap-2.5 bg-gradient-to-r from-red-500 to-amber-500 rounded-full pl-2.5 pr-4 py-2 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <span className="flex-shrink-0 bg-white/25 border border-white/30 text-white font-extrabold text-[15px] rounded-full px-2.5 py-1 notranslate" translate="no">
            −{promo.discount_percent}%
          </span>
          <span className="text-white font-bold text-[15px] leading-snug truncate min-w-0">
            {promo.title}
          </span>
          <i className="ri-arrow-right-line text-white/85 text-lg flex-shrink-0"></i>
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
          className="max-w-full inline-flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full pl-2.5 pr-4 py-2 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <span className="flex-shrink-0 bg-white/25 border border-white/30 text-white rounded-full w-8 h-8 flex items-center justify-center">
            <i className="ri-gift-line text-[17px]"></i>
          </span>
          <span className="text-white font-bold text-[15px] leading-snug truncate min-w-0">
            {t('home.offersTitle')}
          </span>
          <i className="ri-arrow-right-line text-white/85 text-lg flex-shrink-0"></i>
        </button>
      )}
    </div>
  );
}
