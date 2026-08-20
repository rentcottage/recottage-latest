import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { fetchActivePromos, type Promo } from '../../lib/promos';
import { useT } from '../../i18n';

/**
 * Active offers, shown inside the hero directly under the search bar and the
 * amenity chips — the first thing a guest sees, before any scrolling.
 *
 * Compact by design: it sits over the hero photo, so it carries no section
 * heading and renders nothing at all when no promo is active.
 */
export default function HeroPromoBanner() {
  const { t } = useT();
  const navigate = useNavigate();
  const [promos, setPromos] = useState<Promo[]>([]);

  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_PROMOS) return;
    let cancelled = false;
    fetchActivePromos().then((p) => { if (!cancelled) setPromos(p); });
    return () => { cancelled = true; };
  }, []);

  if (!FEATURE_FLAGS.ENABLE_PROMOS || promos.length === 0) return null;

  // Two at most — the hero must not turn into a promo list. Each pill is only
  // as wide as its own text, centred under the chips.
  return (
    <div className="flex flex-wrap justify-center gap-2.5 mt-4">
      {promos.slice(0, 2).map((promo) => (
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
    </div>
  );
}
