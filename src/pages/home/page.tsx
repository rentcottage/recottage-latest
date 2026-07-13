import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import SearchBar from '../../components/feature/SearchBar';
import PropertyCard from '../../components/feature/PropertyCard';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';
import { useApprovedProperties } from '../../hooks/useApprovedProperties';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { fetchActivePromos, type Promo } from '../../lib/promos';

type SeasonKey = 'winter' | 'spring' | 'summer' | 'autumn';

interface SeasonContent {
  label: string;
  img: string;
  title: string;
  sub: string;
  badges: string[];
}

// Seasonal hero content (ported from the mockup script). Source stays English —
// Google Translate localizes it at runtime like the rest of the app.
const SEASONS: Record<SeasonKey, SeasonContent> = {
  winter: {
    label: 'Winter',
    img: '/redesign/season-winter.jpg',
    title: 'Winter in the mountains awaits',
    sub: 'Warm cottages in Gudauri and Bakuriani — close to the slopes, with a fireplace and jacuzzi',
    badges: ['🎿 Close to the slopes', '♨️ Jacuzzi in the snow', '🔥 Fireplace & warmth'],
  },
  spring: {
    label: 'Spring',
    img: '/redesign/season-spring.jpg',
    title: 'Spring — get ahead of the season',
    sub: 'Blossoming valleys and peaceful cottages — book early at the best price',
    badges: ['🌸 Blossoming nature', '💰 Early-bird prices', '🏞 Peaceful season'],
  },
  summer: {
    label: 'Summer',
    img: '/redesign/season-summer.jpg',
    title: 'Escape the city heat',
    sub: 'Cool mountain air in Racha, Svaneti and Borjomi — a yard, a grill and the sound of the river',
    badges: ['⛰ Cool mountain air', '🍖 Grill & yard', '🏞 By the river'],
  },
  autumn: {
    label: 'Autumn',
    img: '/redesign/season-autumn.jpg',
    title: 'Harvest season in Kakheti',
    sub: 'Winery cottages in the vineyards — tastings, golden autumn and a Georgian feast',
    badges: ['🍷 Winery cottages', '🍇 Harvest & tastings', '🍂 Golden autumn'],
  },
};

const SEASON_ORDER: SeasonKey[] = ['winter', 'spring', 'summer', 'autumn'];

function seasonByMonth(m: number): SeasonKey {
  if (m === 11 || m <= 2) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

export default function HomePage() {
  // Seasonal hero — auto-selects by current month, switchable via the pills.
  const [season, setSeason] = useState<SeasonKey>(() => seasonByMonth(new Date().getMonth()));
  const [heroFading, setHeroFading] = useState(false);
  const selectSeason = (key: SeasonKey) => {
    if (key === season) return;
    setHeroFading(true);
    const img = new Image();
    img.onload = img.onerror = () => {
      setSeason(key);
      setHeroFading(false);
    };
    img.src = SEASONS[key].img;
  };

  const [promos, setPromos] = useState<Promo[]>([]);

  // Offers & Promos — dormant until FEATURE_FLAGS.ENABLE_PROMOS is flipped on.
  // No active promos → the section renders nothing at all.
  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_PROMOS) return;
    let cancelled = false;
    fetchActivePromos().then((p) => { if (!cancelled) setPromos(p); });
    return () => { cancelled = true; };
  }, []);

  const navigate = useNavigate();

  const handlePromoClick = (promo: Promo) => {
    const searchParams = new URLSearchParams();
    searchParams.set('location', promo.location);
    navigate(`/search?${searchParams.toString()}`);
  };

  const { dbProperties, loading: dbLoading, totalCount } = useApprovedProperties();

  // Featured cottages: newest first, then 5 random from the rest.
  // Memoized on the fetched list so re-renders (e.g. season switch) don't reshuffle.
  const featuredProperties = useMemo(() => {
    if (dbProperties.length === 0) return [];
    const [newest, ...rest] = dbProperties;
    if (rest.length === 0) return [newest];
    // Fisher-Yates shuffle on the rest, then take up to 5
    const shuffled = [...rest];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return [newest, ...shuffled.slice(0, 5)];
  }, [dbProperties]);

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'RentCottage.Ge',
      url: siteUrl,
      description: 'Find and book unique Georgian cottage rentals across Georgia — Tbilisi, Batumi, Kakheti and more.',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteUrl}/search?location={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'RentCottage.Ge',
      url: siteUrl,
      logo: `${siteUrl}/vite.svg`,
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'info.rentcottage@gmail.com',
        contactType: 'customer service',
      },
      sameAs: [
        'https://www.facebook.com/profile.php?id=61583084123461',
        'https://www.instagram.com/rentcottage.ge/',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': siteUrl,
      name: 'RentCottage.Ge',
      description: 'Georgian cottage rental platform connecting travelers with unique traditional homes and mountain retreats across Georgia.',
      url: siteUrl,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Tbilisi',
        addressCountry: 'GE',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 41.6938,
        longitude: 44.8015,
      },
      priceRange: '₾₾',
      telephone: '+995 32 123 4567',
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '18:00',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="RentCottage.Ge — Find & Book Georgian Cottage"
        description="Find and book unique Georgian cottage rentals across Tbilisi, Batumi, Kakheti and Gudauri. Verified cottages, mountain retreats and traditional Georgian homes. Book your perfect Georgian getaway today."
        keywords="Georgian cottage rental, Georgia vacation rental, rent cottage Georgia, Tbilisi accommodation, Kakheti cottage"
        canonical="/"
        jsonLd={jsonLd}
        ogImage="https://rentcottage.ge/og-image.png"
      />
      <Header />

      {/* Hero Section — seasonal (auto-selects by month, switchable). Search bar
          floats below, overlapping the hero's bottom edge — matches the mockup. */}
      <section
        className="relative w-full min-h-[60vh] md:min-h-[62vh] flex flex-col justify-center items-center text-center px-4 pt-28 pb-28 md:pt-32 md:pb-40 transition-[background-image] duration-500"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url('${SEASONS[season].img}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Season switcher pills */}
        <div className="absolute top-4 right-4 z-20 flex gap-1.5 bg-black/35 border border-white/25 rounded-full p-1.5">
          {SEASON_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={`${key} season`}
              onClick={() => selectSeason(key)}
              className={`text-xs md:text-[13px] font-bold px-3 py-1.5 rounded-full cursor-pointer transition-opacity ${
                season === key ? 'bg-red-500 text-white opacity-100' : 'text-white opacity-75 hover:opacity-100'
              }`}
            >
              {SEASONS[key].label}
            </button>
          ))}
        </div>

        {/* Hero content */}
        <div className="relative z-10 w-full flex flex-col items-center text-center px-4">
          <h1
            className={`text-3xl md:text-5xl font-extrabold text-white mb-3 md:mb-5 leading-tight tracking-tight drop-shadow-md max-w-3xl transition-opacity duration-300 ${
              heroFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {SEASONS[season].title}
          </h1>
          <p
            className={`text-base md:text-lg text-white/95 mb-5 md:mb-7 max-w-xl leading-relaxed transition-opacity duration-300 ${
              heroFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {SEASONS[season].sub}
          </p>
          <div
            className={`flex flex-wrap justify-center gap-2.5 md:gap-3 transition-opacity duration-300 ${
              heroFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {SEASONS[season].badges.map((badge, i) => (
              <span
                key={i}
                className="bg-white/15 border border-white/30 text-white text-xs md:text-[13.5px] font-semibold px-3.5 py-1.5 rounded-full"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Floating search card — overlaps the hero's bottom edge (mockup) */}
      <div className="relative z-20 w-full max-w-[940px] mx-auto px-4 -mt-12 md:-mt-14">
        <SearchBar />
      </div>

      {/* Popular destinations — region cards */}
      <section className="py-12 md:py-16 px-4 md:px-6 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6 md:mb-7">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">Popular destinations</h2>
            <p className="text-soft mt-1">Pick a region and discover its best cottages</p>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="text-red-500 font-bold text-sm hover:text-red-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            All regions →
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-[18px]">
          {[
            { name: 'Gudauri', tag: 'Winter ski hub', img: '/redesign/region-gudauri.jpg' },
            { name: 'Bakuriani', tag: 'Family favorite', img: '/redesign/region-bakuriani.jpg' },
            { name: 'Kakheti', tag: 'Wine country', img: '/redesign/region-kakheti.jpg' },
            { name: 'Kazbegi', tag: 'Mountain views', img: '/redesign/region-kazbegi.jpg' },
          ].map((region) => (
            <button
              key={region.name}
              onClick={() => navigate(`/search?location=${encodeURIComponent(region.name)}`)}
              className="group relative rounded-card overflow-hidden h-44 md:h-52 flex items-end text-left p-4 shadow-card hover:-translate-y-1 transition-transform duration-200 cursor-pointer"
              style={{ backgroundImage: `url('${region.img}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <span className="relative z-10 text-white">
                <span className="block text-lg md:text-[19px] font-extrabold">{region.name}</span>
                <span className="block text-xs md:text-[13px] opacity-90">{region.tag}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured cottages (+ dormant promos, flag-gated) */}
      <section className="pt-0 pb-12 md:pb-16 px-4 md:px-6 max-w-6xl mx-auto">
        {/* Offers & Promos — hidden entirely when there are no active promos */}
        {FEATURE_FLAGS.ENABLE_PROMOS && promos.length > 0 && (
          <div className="mb-8 md:mb-12">
            <div className="mb-4 md:mb-6">
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">Offers &amp; Promos</h2>
              <p className="text-gray-600 text-sm md:text-base">Limited-time discounts — applied automatically at checkout</p>
            </div>
            <div className="space-y-3 md:space-y-4">
              {promos.map((promo) => (
                <button
                  key={promo.id}
                  type="button"
                  onClick={() => handlePromoClick(promo)}
                  className="w-full text-left bg-gradient-to-r from-red-500 to-amber-500 rounded-2xl p-4 md:p-6 flex items-center gap-4 md:gap-6 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center border border-white/30">
                    <span className="text-white font-extrabold text-lg md:text-2xl leading-none">−{promo.discount_percent}%</span>
                    <span className="text-white/80 text-[10px] md:text-xs font-semibold uppercase tracking-wide mt-0.5">off</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm md:text-lg leading-snug mb-1 truncate">{promo.title}</h3>
                    {promo.description && (
                      <p className="text-white/80 text-xs md:text-sm leading-snug mb-1.5 line-clamp-1">{promo.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                      <span className="inline-flex items-center gap-1 bg-white/25 text-white text-[11px] md:text-xs font-semibold px-2 py-0.5 rounded-full">
                        <i className="ri-map-pin-line text-xs"></i>{promo.location}
                      </span>
                      {promo.ends_at && (
                        <span className="inline-flex items-center gap-1 text-white/80 text-[11px] md:text-xs font-medium">
                          <i className="ri-time-line text-xs"></i>
                          until {new Date(promo.ends_at + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-white/80">
                    <i className="ri-arrow-right-line text-xl"></i>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Featured Properties */}
        <div id="property-listings" className="flex items-end justify-between gap-4 flex-wrap mb-6 md:mb-7">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">Featured cottages</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p className="text-soft">Top-rated cottages this week</p>
              {dbLoading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-3 h-3 flex items-center justify-center animate-spin">
                    <i className="ri-loader-4-line"></i>
                  </span>
                  Loading live listings…
                </span>
              ) : (totalCount ?? dbProperties.length) > 0 ? (
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
                  {totalCount ?? dbProperties.length} live listing{(totalCount ?? dbProperties.length) !== 1 ? 's' : ''} from real hosts
                </span>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="text-red-500 font-bold text-sm hover:text-red-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            View all →
          </button>
        </div>

        {dbLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400">
              <span className="w-5 h-5 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line text-xl"></i>
              </span>
              <span className="text-sm">Loading listings…</span>
            </div>
          </div>
        ) : featuredProperties.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            {featuredProperties.map((property) => (
              <PropertyCard key={property.id} {...property} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <i className="ri-home-2-line text-2xl text-gray-400"></i>
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">No cottages available yet</h3>
            <p className="text-sm text-gray-400">Listings coming soon — check back shortly.</p>
          </div>
        )}
      </section>

      {/* Trust band — why choose us (4 static items, mockup) */}
      <section className="bg-[#222222] text-white py-14 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center tracking-tight">Why RentCottage.Ge?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-[26px] mt-8 md:mt-[34px]">
            {[
              { icon: '🛡️', title: 'Verified cottages', desc: 'We personally check every listing — the photos match reality' },
              { icon: '💳', title: 'Secure payment', desc: 'Pay by card or in installments. Funds are released to the host after check-in' },
              { icon: '💬', title: 'Support in Georgian', desc: 'Our team answers calls and chats every day, 9:00–23:00' },
              { icon: '↩️', title: 'Flexible cancellation', desc: 'Free cancellation up to 48 hours before check-in — a full refund' },
            ].map((item) => (
              <div key={item.title} className="text-left">
                <div className="text-3xl leading-none" aria-hidden="true">{item.icon}</div>
                <h3 className="text-[16.5px] font-bold mt-2.5 mb-1.5">{item.title}</h3>
                <p className="text-[13.5px] opacity-85 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 md:py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="mb-8 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">How it works</h2>
          <p className="text-soft mt-1">Book in just 3 steps</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {[
            { n: 1, title: 'Search', desc: 'Pick a region, dates and guests — filter by jacuzzi, fireplace or pool' },
            { n: 2, title: 'Book', desc: 'Request to book or message the host. Payment is safe and secure' },
            { n: 3, title: 'Relax', desc: 'Get check-in details and enjoy your stay. We\u2019re here if you need us' },
          ].map((step) => (
            <div key={step.n} className="bg-white border border-line rounded-card p-6 md:p-7">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 font-extrabold text-lg flex items-center justify-center mb-3.5">
                {step.n}
              </div>
              <h3 className="text-[17px] font-bold text-ink mb-1.5">{step.title}</h3>
              <p className="text-sm text-soft leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Guest reviews */}
      <section className="pb-14 md:pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="mb-8 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">What guests say</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {[
            { text: 'The cottage was exactly like the photos. The host was very attentive and booking took just minutes.', who: 'Nino K. · Gudauri, January 2026' },
            { text: 'We stayed in Bakuriani with the family. No surprises on price — you pay exactly what\u2019s listed. We\u2019ll be back.', who: 'Giorgi M. · Bakuriani, February 2026' },
            { text: 'Rented a winery cottage in Kakheti with friends. Tastings, views, calm — a perfect ten!', who: 'Tamar B. · Sighnaghi, October 2025' },
          ].map((review, i) => (
            <div key={i} className="bg-white rounded-card shadow-card p-6">
              <div className="text-red-500 tracking-[2px] mb-2.5" translate="no" aria-hidden="true">★★★★★</div>
              <p className="text-[14.5px] text-ink leading-relaxed">“{review.text}”</p>
              <p className="mt-3.5 text-[13.5px] font-bold text-soft">{review.who}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Host CTA */}
      <section className="pb-14 md:pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div
          className="relative rounded-[20px] overflow-hidden text-center text-white px-6 py-14 md:px-10 md:py-16"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,.6)), url('/redesign/host-cta.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-3">Have a cottage? Earn more</h2>
          <p className="max-w-xl mx-auto opacity-95 mb-6">
            List your cottage for free, get bookings directly, and pay a commission only on successful stays
          </p>
          <button
            onClick={() => navigate('/become-host')}
            className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl px-6 py-3 cursor-pointer transition-colors whitespace-nowrap"
          >
            List your cottage for free
          </button>
        </div>
      </section>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />
    </div>
  );
}
