import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import CinematicHero from '../../components/feature/CinematicHero';
import PropertyCard from '../../components/feature/PropertyCard';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';
import { useApprovedProperties } from '../../hooks/useApprovedProperties';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { fetchActivePromos, type Promo } from '../../lib/promos';
import { useT } from '../../i18n';

export default function HomePage() {
  const { t } = useT();
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
      <Header overlay />

      {/* Cinematic hero — outside→inside window reveal (landing-redesign) */}
      <CinematicHero />

      {/* Popular destinations — region cards */}
      <section className="py-12 md:py-16 px-4 md:px-6 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6 md:mb-7">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">{t('home.popularDestinations')}</h2>
            <p className="text-soft mt-1">{t('home.popularSub')}</p>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="text-red-500 font-bold text-sm hover:text-red-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t('home.allRegions')}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-[18px]">
          {[
            { name: 'Adjara', nameKey: 'home.regionAdjara', tagKey: 'home.regionAdjaraTag', img: '/redesign/region-adjara.jpg' },
            { name: 'Racha', nameKey: 'home.regionRacha', tagKey: 'home.regionRachaTag', img: '/redesign/region-racha.jpg' },
            { name: 'Kakheti', nameKey: 'home.regionKakheti', tagKey: 'home.regionKakhetiTag', img: '/redesign/region-kakheti.jpg' },
            { name: 'Kazbegi', nameKey: 'home.regionKazbegi', tagKey: 'home.regionKazbegiTag', img: '/redesign/region-kazbegi.jpg' },
          ].map((region) => (
            <button
              key={region.name}
              onClick={() => navigate(`/search?location=${encodeURIComponent(region.name)}`)}
              className="group relative rounded-card overflow-hidden h-44 md:h-52 flex items-end text-left p-4 shadow-card hover:-translate-y-1 transition-transform duration-200 cursor-pointer"
              style={{ backgroundImage: `url('${region.img}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <span className="relative z-10 text-white">
                <span className="block text-lg md:text-[19px] font-extrabold">{t(region.nameKey)}</span>
                <span className="block text-xs md:text-[13px] opacity-90">{t(region.tagKey)}</span>
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
            <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">{t('home.featured')}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p className="text-soft">{t('home.featuredSub')}</p>
              {dbLoading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-3 h-3 flex items-center justify-center animate-spin">
                    <i className="ri-loader-4-line"></i>
                  </span>
                  {t('home.loadingLive')}
                </span>
              ) : (totalCount ?? dbProperties.length) > 0 ? (
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
                  {t('home.liveListings', { count: totalCount ?? dbProperties.length })}
                </span>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="text-red-500 font-bold text-sm hover:text-red-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t('home.viewAll')}
          </button>
        </div>

        {dbLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400">
              <span className="w-5 h-5 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line text-xl"></i>
              </span>
              <span className="text-sm">{t('home.loadingListings')}</span>
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
            <h3 className="text-base font-semibold text-gray-700 mb-1">{t('home.noListings')}</h3>
            <p className="text-sm text-gray-400">{t('home.noListingsSub')}</p>
          </div>
        )}
      </section>

      {/* Trust band — why choose us (4 static items, mockup) */}
      <section className="bg-[#222222] text-white py-14 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center tracking-tight">{t('home.why')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-[26px] mt-8 md:mt-[34px]">
            {[
              { icon: '🛡️', titleKey: 'home.whyVerifiedTitle', descKey: 'home.whyVerifiedDesc' },
              { icon: '💳', titleKey: 'home.whySecureTitle', descKey: 'home.whySecureDesc' },
              { icon: '💬', titleKey: 'home.whySupportTitle', descKey: 'home.whySupportDesc' },
              { icon: '↩️', titleKey: 'home.whyFlexibleTitle', descKey: 'home.whyFlexibleDesc' },
            ].map((item) => (
              <div key={item.titleKey} className="text-left">
                <div className="text-3xl leading-none" aria-hidden="true">{item.icon}</div>
                <h3 className="text-[16.5px] font-bold mt-2.5 mb-1.5">{t(item.titleKey)}</h3>
                <p className="text-[13.5px] opacity-85 leading-relaxed">{t(item.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 md:py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="mb-8 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">{t('home.howTitle')}</h2>
          <p className="text-soft mt-1">{t('home.howSub')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {[
            { n: 1, titleKey: 'home.step1Title', descKey: 'home.step1Desc' },
            { n: 2, titleKey: 'home.step2Title', descKey: 'home.step2Desc' },
            { n: 3, titleKey: 'home.step3Title', descKey: 'home.step3Desc' },
          ].map((step) => (
            <div key={step.n} className="bg-white border border-line rounded-card p-6 md:p-7">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 font-extrabold text-lg flex items-center justify-center mb-3.5">
                {step.n}
              </div>
              <h3 className="text-[17px] font-bold text-ink mb-1.5">{t(step.titleKey)}</h3>
              <p className="text-sm text-soft leading-relaxed">{t(step.descKey)}</p>
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
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-3">{t('home.hostCtaTitle')}</h2>
          <p className="max-w-xl mx-auto opacity-95 mb-6">
            {t('home.hostCtaSub')}
          </p>
          <button
            onClick={() => navigate('/become-host')}
            className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl px-6 py-3 cursor-pointer transition-colors whitespace-nowrap"
          >
            {t('home.hostCtaButton')}
          </button>
        </div>
      </section>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />
    </div>
  );
}
