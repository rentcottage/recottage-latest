import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import SearchBar from '../../components/feature/SearchBar';
import PropertyCard from '../../components/feature/PropertyCard';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';
import { useApprovedProperties } from '../../hooks/useApprovedProperties';
import { supabase } from '../../lib/supabase';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { fetchActivePromos, type Promo } from '../../lib/promos';
import { optimizedImageUrl, IMG_CARD } from '../../lib/imageUrl';
import { useTranslation, translateVocab } from '../../lib/i18n';

interface HomeExperience {
  id: string;
  title: string;
  description: string;
  price_per_person: number;
  currency_symbol: string;
  image_url: string | null;
  status: 'active' | 'coming_soon' | 'archived';
}

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
  const { t } = useTranslation();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedHelpTopic, setSelectedHelpTopic] = useState<string>('');

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

  const [showCookingModal, setShowCookingModal] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isWineTastingModalOpen, setIsWineTastingModalOpen] = useState(false);
  const [isWineTastingBookingOpen, setIsWineTastingBookingOpen] = useState(false);

  const [experiences, setExperiences] = useState<HomeExperience[]>([]);
  const [experiencesLoading, setExperiencesLoading] = useState(true);
  const [promos, setPromos] = useState<Promo[]>([]);

  // Offers & Promos — dormant until FEATURE_FLAGS.ENABLE_PROMOS is flipped on.
  // No active promos → the section renders nothing at all.
  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_PROMOS) return;
    let cancelled = false;
    fetchActivePromos().then((p) => { if (!cancelled) setPromos(p); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('experiences')
        .select('id,title,description,price_per_person,currency_symbol,image_url,status')
        .neq('status', 'archived')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (cancelled) return;
      setExperiences((data ?? []) as HomeExperience[]);
      setExperiencesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const navigate = useNavigate();

  const scrollToListings = () => {
    const listingsSection = document.getElementById('property-listings');
    if (listingsSection) {
      listingsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToExperiences = () => {
    const experiencesSection = document.getElementById('experiences-section');
    if (experiencesSection) {
      experiencesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCategoryClick = (category: string) => {
    const searchParams = new URLSearchParams();
    searchParams.set('category', category.toLowerCase());
    navigate(`/search?${searchParams.toString()}`);
  };

  const handlePromoClick = (promo: Promo) => {
    const searchParams = new URLSearchParams();
    searchParams.set('location', promo.location);
    navigate(`/search?${searchParams.toString()}`);
  };

  const openHelpModal = (topic: string) => {
    setSelectedHelpTopic(topic);
    setShowHelpModal(true);
  };

  const getHelpContent = (topic: string) => {
    const content = {
      booking: {
        title: t('home.helpModal.bookingTitle'),
        content: [
          {
            step: t('home.helpModal.bookingStep1'),
            description: t('home.helpModal.bookingStep1Desc'),
          },
          {
            step: t('home.helpModal.bookingStep2'),
            description: t('home.helpModal.bookingStep2Desc'),
          },
          {
            step: t('home.helpModal.bookingStep3'),
            description: t('home.helpModal.bookingStep3Desc'),
          },
          {
            step: t('home.helpModal.bookingStep4'),
            description: t('home.helpModal.bookingStep4Desc'),
          },
          {
            step: t('home.helpModal.bookingStep5'),
            description: t('home.helpModal.bookingStep5Desc'),
          },
        ],
      },
      cancellation: {
        title: t('home.helpModal.cancellationTitle'),
        content: [
          {
            step: t('home.helpModal.cancellationStep1'),
            description: t('home.helpModal.cancellationStep1Desc'),
          },
          {
            step: t('home.helpModal.cancellationStep2'),
            description: t('home.helpModal.cancellationStep2Desc'),
          },
          {
            step: t('home.helpModal.cancellationStep3'),
            description: t('home.helpModal.cancellationStep3Desc'),
          },
          {
            step: t('home.helpModal.cancellationStep4'),
            description: t('home.helpModal.cancellationStep4Desc'),
          },
          {
            step: t('home.helpModal.cancellationStep5'),
            description: t('home.helpModal.cancellationStep5Desc'),
          },
        ],
      },
      safety: {
        title: t('home.helpModal.safetyTitle'),
        content: [
          {
            step: t('home.helpModal.safetyStep1'),
            description: t('home.helpModal.safetyStep1Desc'),
          },
          {
            step: t('home.helpModal.safetyStep2'),
            description: t('home.helpModal.safetyStep2Desc'),
          },
          {
            step: t('home.helpModal.safetyStep3'),
            description: t('home.helpModal.safetyStep3Desc'),
          },
          {
            step: t('home.helpModal.safetyStep4'),
            description: t('home.helpModal.safetyStep4Desc'),
          },
          {
            step: t('home.helpModal.safetyStep5'),
            description: t('home.helpModal.safetyStep5Desc'),
          },
        ],
      },
    };
    return content[topic as keyof typeof content];
  };

  const handleWineTastingBooking = () => {
    setIsWineTastingModalOpen(false);
    setIsWineTastingBookingOpen(true);
  };

  const handleWineTastingBookingClose = () => {
    setIsWineTastingBookingOpen(false);
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
        title={t('home.seo.title')}
        description="Find and book unique Georgian cottage rentals across Tbilisi, Batumi, Kakheti and Gudauri. Verified cottages, mountain retreats and traditional Georgian homes. Book your perfect Georgian getaway today."
        keywords="Georgian cottage rental, Georgia vacation rental, rent cottage Georgia, Tbilisi accommodation, Kakheti cottage"
        canonical="/"
        jsonLd={jsonLd}
        ogImage="https://rentcottage.ge/og-image.png"
      />
      <Header onStaysClick={scrollToListings} onExperiencesClick={scrollToExperiences} />

      {/* Hero Section — seasonal (auto-selects by month, switchable) */}
      <section
        className="relative w-full min-h-[520px] md:min-h-[640px] flex flex-col justify-center items-center text-center px-4 py-24 md:py-28 transition-[background-image] duration-500"
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
              aria-label={t('home.seasons.seasonAria', { season: t(`home.seasons.${key}`) })}
              onClick={() => selectSeason(key)}
              className={`text-xs md:text-[13px] font-bold px-3 py-1.5 rounded-full cursor-pointer transition-opacity ${
                season === key ? 'bg-red-500 text-white opacity-100' : 'text-white opacity-75 hover:opacity-100'
              }`}
            >
              {t(`home.seasons.${key}`)}
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
            {t(`home.seasons.${season}Title`)}
          </h1>
          <p
            className={`text-base md:text-lg text-white/95 mb-5 md:mb-7 max-w-xl leading-relaxed transition-opacity duration-300 ${
              heroFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {t(`home.seasons.${season}Sub`)}
          </p>
          <div
            className={`flex flex-wrap justify-center gap-2.5 md:gap-3 mb-8 md:mb-10 transition-opacity duration-300 ${
              heroFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="bg-white/15 border border-white/30 text-white text-xs md:text-[13.5px] font-semibold px-3.5 py-1.5 rounded-full"
              >
                {t(`home.seasons.${season}Badge${i}`)}
              </span>
            ))}
          </div>
          <div className="w-full max-w-4xl">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Popular destinations — region cards */}
      <section className="py-12 md:py-16 px-4 md:px-6 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6 md:mb-7">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">{t('home.destinations.title')}</h2>
            <p className="text-soft mt-1">{t('home.destinations.subtitle')}</p>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="text-red-500 font-bold text-sm hover:text-red-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t('home.destinations.allRegions')}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-[18px]">
          {[
            { name: 'Gudauri', tag: t('home.destinations.gudauriTag'), img: '/redesign/region-gudauri.jpg' },
            { name: 'Bakuriani', tag: t('home.destinations.bakurianiTag'), img: '/redesign/region-bakuriani.jpg' },
            { name: 'Kakheti', tag: t('home.destinations.kakhetiTag'), img: '/redesign/region-kakheti.jpg' },
            { name: 'Kazbegi', tag: t('home.destinations.kazbegiTag'), img: '/redesign/region-kazbegi.jpg' },
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

      {/* Categories */}
      <section className="py-8 md:py-16 px-4 md:px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6 mb-8 md:mb-16">
          {[
            { icon: 'ri-landscape-line', label: 'Mountain' },
            { icon: 'ri-ship-line', label: 'Lakeside' },
            { icon: 'ri-building-2-line', label: 'Traditional' },
            { icon: 'ri-tree-line', label: 'Forest' },
            { icon: 'ri-sun-line', label: 'Countryside' },
            { icon: 'ri-goblet-line', label: 'Winery' },
          ].map((category, index) => (
            <div
              key={index}
              onClick={() => handleCategoryClick(category.label)}
              className="flex flex-col items-center p-2 md:p-4 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors"
            >
              <div className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center mb-1 md:mb-2">
                <i className={`${category.icon} text-xl md:text-3xl text-gray-700`}></i>
              </div>
              <span className="text-xs md:text-sm font-medium text-gray-900 text-center leading-tight">{translateVocab(t, 'categories', category.label)}</span>
            </div>
          ))}
        </div>

        {/* Offers & Promos — hidden entirely when there are no active promos */}
        {FEATURE_FLAGS.ENABLE_PROMOS && promos.length > 0 && (
          <div className="mb-8 md:mb-16">
            <div className="mb-4 md:mb-6">
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">{t('home.promos.title')}</h2>
              <p className="text-gray-600 text-sm md:text-base">{t('home.promos.subtitle')}</p>
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
                    <span className="text-white/80 text-[10px] md:text-xs font-semibold uppercase tracking-wide mt-0.5">{t('home.promos.off')}</span>
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
                          {t('home.promos.until', { date: new Date(promo.ends_at + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) })}
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
            <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">{t('home.featured.title')}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p className="text-soft">{t('home.featured.subtitle')}</p>
              {dbLoading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-3 h-3 flex items-center justify-center animate-spin">
                    <i className="ri-loader-4-line"></i>
                  </span>
                  {t('home.featured.loadingLive')}
                </span>
              ) : (totalCount ?? dbProperties.length) > 0 ? (
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
                  {t('home.featured.liveListings', { count: totalCount ?? dbProperties.length })}
                </span>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="text-red-500 font-bold text-sm hover:text-red-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t('home.featured.viewAll')}
          </button>
        </div>

        {dbLoading ? (
          <div className="flex items-center justify-center py-16 mb-8 md:mb-16">
            <div className="flex items-center gap-3 text-gray-400">
              <span className="w-5 h-5 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line text-xl"></i>
              </span>
              <span className="text-sm">{t('home.featured.loading')}</span>
            </div>
          </div>
        ) : featuredProperties.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 mb-8 md:mb-16">
            {featuredProperties.map((property) => (
              <PropertyCard key={property.id} {...property} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 mb-8 md:mb-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <i className="ri-home-2-line text-2xl text-gray-400"></i>
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">{t('home.featured.emptyTitle')}</h3>
            <p className="text-sm text-gray-400">{t('home.featured.emptySubtitle')}</p>
          </div>
        )}

        {/* Show More Button */}
        <div className="text-center mb-8 md:mb-16">
          <button
            onClick={() => navigate('/search')}
            className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-lg font-medium transition-colors whitespace-nowrap"
          >
            {t('home.featured.showMore')}
          </button>
        </div>

        {/* Unique Experiences Section */}
        <section className="mb-8 md:mb-16">
          <div className="text-center mb-6 md:mb-12">
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-2 md:mb-4">{t('home.experiences.title')}</h2>
            <p className="text-sm md:text-lg text-gray-600 max-w-2xl mx-auto">
              {t('home.experiences.subtitle')}
            </p>
          </div>

          {experiencesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-8 items-stretch">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                  <div className="w-full sm:h-52 h-32 bg-gray-100"></div>
                  <div className="p-3 sm:p-6 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-100 rounded w-full"></div>
                    <div className="h-3 bg-gray-100 rounded w-5/6"></div>
                    <div className="h-8 bg-gray-100 rounded mt-3"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : experiences.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">{t('home.experiences.empty')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-8 items-stretch">
              {experiences.map((exp) => {
                const isComingSoon = exp.status === 'coming_soon';
                const titleColor = isComingSoon ? 'text-gray-400' : 'text-gray-900';
                const descColor = isComingSoon ? 'text-gray-400' : 'text-gray-500';
                const priceColor = isComingSoon ? 'text-gray-300' : 'text-red-500';
                const priceLabelColor = isComingSoon ? 'text-gray-300' : 'text-gray-400';
                return (
                  <div
                    key={exp.id}
                    className={`bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col sm:flex-col ${
                      isComingSoon ? '' : 'hover:border-gray-200 transition-all cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!isComingSoon) navigate(`/book-experience?id=${exp.id}`);
                    }}
                  >
                    <div className="flex flex-row sm:flex-col flex-1">
                      <div className="relative w-28 sm:w-full h-auto sm:h-52 flex-shrink-0 overflow-hidden bg-gray-50">
                        {exp.image_url ? (
                          <img
                            alt={exp.title}
                            className={`w-full h-full object-contain ${isComingSoon ? 'opacity-80' : ''}`}
                            style={{ height: '100%', minHeight: '7rem' }}
                            src={optimizedImageUrl(exp.image_url, IMG_CARD)}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                            <i className="ri-image-line text-3xl"></i>
                          </div>
                        )}
                        {isComingSoon && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="bg-white/95 text-gray-900 text-xs font-semibold px-2.5 py-1 rounded-full">
                              {t('home.experiences.comingSoon')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 sm:p-6 flex flex-col flex-1 min-w-0">
                        <h3
                          className={`text-sm sm:text-lg font-semibold ${titleColor} mb-1 sm:mb-2 leading-snug`}
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        >
                          {exp.title}
                        </h3>
                        <p
                          className={`text-xs sm:text-sm ${descColor} mb-2 sm:mb-4 leading-relaxed`}
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        >
                          {exp.description}
                        </p>
                        <div className="mt-auto">
                          <div className="flex items-baseline gap-1 mb-2 sm:mb-3">
                            <span className={`text-xs ${priceLabelColor}`}>{t('home.experiences.from')}</span>
                            <span className={`text-base sm:text-xl font-bold ${priceColor}`}>
                              {exp.currency_symbol || '₾'}
                              {Number(exp.price_per_person).toFixed(0)}
                            </span>
                            <span className={`text-xs ${priceLabelColor}`}>{t('home.experiences.perPerson')}</span>
                          </div>
                          {isComingSoon ? (
                            <div className="w-full bg-gray-100 text-gray-400 text-xs sm:text-sm font-medium py-1.5 sm:py-2.5 rounded-lg text-center whitespace-nowrap cursor-default select-none">
                              {t('home.experiences.comingSoon')}
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/book-experience?id=${exp.id}`);
                              }}
                              className="w-full bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-medium py-1.5 sm:py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {t('home.experiences.bookNow')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* More Experiences Coming Soon Notice */}
          <div className="mt-6 md:mt-12 text-center">
            <div className="bg-blue-50 rounded-xl p-4 md:p-8 max-w-2xl mx-auto">
              <div className="w-10 h-10 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <i className="ri-time-line text-base md:text-2xl text-blue-600"></i>
              </div>
              <h3 className="text-sm md:text-xl font-semibold text-gray-900 mb-2 md:mb-3">
                {t('home.experiences.moreTitle')}
              </h3>
              <p className="text-xs md:text-base text-gray-600 mb-3 md:mb-4">
                {t('home.experiences.moreDesc')}
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs md:text-sm text-gray-500">
                <span className="bg-white px-2 md:px-3 py-1 rounded-full">{t('home.experiences.tagDance')}</span>
                <span className="bg-white px-2 md:px-3 py-1 rounded-full">{t('home.experiences.tagPottery')}</span>
                <span className="bg-white px-2 md:px-3 py-1 rounded-full">{t('home.experiences.tagRiding')}</span>
                <span className="bg-white px-2 md:px-3 py-1 rounded-full">{t('home.experiences.tagTours')}</span>
              </div>
            </div>
          </div>
        </section>
      </section>

      {/* Trust band — why choose us (cards open the help modals) */}
      <section className="bg-[#181818] text-white py-14 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-9 md:mb-11 tracking-tight">{t('home.trust.title')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
            {[
              { icon: 'ri-shield-check-line', title: t('home.trust.verifiedTitle'), desc: t('home.trust.verifiedDesc'), topic: 'safety' },
              { icon: 'ri-calendar-line', title: t('home.trust.flexibleTitle'), desc: t('home.trust.flexibleDesc'), topic: 'cancellation' },
              { icon: 'ri-home-line', title: t('home.trust.easyTitle'), desc: t('home.trust.easyDesc'), topic: 'booking' },
            ].map((item) => (
              <button
                key={item.topic}
                type="button"
                onClick={() => openHelpModal(item.topic)}
                className="text-left cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mb-3.5">
                  <i className={`${item.icon} text-2xl text-red-500`}></i>
                </div>
                <h3 className="text-[16.5px] font-bold mb-1.5 group-hover:text-red-400 transition-colors">{item.title}</h3>
                <p className="text-sm text-white/75 leading-relaxed">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 md:py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="mb-8 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">{t('home.howItWorks.title')}</h2>
          <p className="text-soft mt-1">{t('home.howItWorks.subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {[
            { n: 1, title: t('home.howItWorks.step1Title'), desc: t('home.howItWorks.step1Desc') },
            { n: 2, title: t('home.howItWorks.step2Title'), desc: t('home.howItWorks.step2Desc') },
            { n: 3, title: t('home.howItWorks.step3Title'), desc: t('home.howItWorks.step3Desc') },
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
          <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">{t('home.reviews.title')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {[
            { text: t('home.reviews.review1'), who: 'Nino K. · Gudauri, January 2026' },
            { text: t('home.reviews.review2'), who: 'Giorgi M. · Bakuriani, February 2026' },
            { text: t('home.reviews.review3'), who: 'Tamar B. · Sighnaghi, October 2025' },
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
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-3">{t('home.hostCta.title')}</h2>
          <p className="max-w-xl mx-auto opacity-95 mb-6">
            {t('home.hostCta.subtitle')}
          </p>
          <button
            onClick={() => navigate('/become-host')}
            className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl px-6 py-3 cursor-pointer transition-colors whitespace-nowrap"
          >
            {t('home.hostCta.button')}
          </button>
        </div>
      </section>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {getHelpContent(selectedHelpTopic)?.title}
                </h2>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>

              <div className="space-y-6">
                {getHelpContent(selectedHelpTopic)?.content.map((item, index) => (
                  <div key={index} className="flex items-start">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0 mt-1">
                      <span className="text-sm font-semibold text-red-600">{index + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">{item.step}</h3>
                      <p className="text-gray-600 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <i className="ri-information-line text-blue-500 mr-3"></i>
                    <p className="text-sm text-blue-800">
                      <strong>{t('home.helpModal.needMoreHelpLabel')}</strong> {t('home.helpModal.needMoreHelpText')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />

      {/* Booking Form Modal */}
      {showBookingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{t('home.bookingForm.cookingTitle')}</h2>
                <button
                  onClick={() => setShowBookingForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form
                id="georgian-cooking-booking"
                data-readdy-form
                action="https://readdy.ai/api/form/d3vqfn2b9hjta443jkgg"
                method="POST"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const requiredFields = [
                    'full_name',
                    'email',
                    'phone',
                    'preferred_date',
                    'number_of_people',
                  ];
                  let isValid = true;
                  for (const field of requiredFields) {
                    if (!formData.get(field)) {
                      alert(t('home.bookingForm.validationFillField', { field: field.replace('_', ' ') }));
                      isValid = false;
                      break;
                    }
                  }
                  if (isValid) {
                    fetch('https://readdy.ai/api/form/d3vqfn2b9hjta443jkgg', {
                      method: 'POST',
                      body: new URLSearchParams(formData as any),
                    })
                      .then(() => {
                        alert(t('home.bookingForm.successCooking'));
                        setShowBookingForm(false);
                      })
                      .catch(() => {
                        alert(t('home.bookingForm.errorSubmit'));
                      });
                  }
                }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('home.bookingForm.fullName')}
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                      placeholder={t('home.bookingForm.fullNamePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('home.bookingForm.email')}
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                      placeholder={t('home.bookingForm.emailPlaceholder')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('home.bookingForm.phone')}
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                      placeholder={t('home.bookingForm.phonePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('home.bookingForm.numberOfPeople')}
                    </label>
                    <div className="relative">
                      <select
                        name="number_of_people"
                        required
                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm appearance-none"
                      >
                        <option value="">{t('home.bookingForm.selectNumberOfPeople')}</option>
                        <option value="2">{t('home.bookingForm.peopleOption', { count: 2 })}</option>
                        <option value="3">{t('home.bookingForm.peopleOption', { count: 3 })}</option>
                        <option value="4">{t('home.bookingForm.peopleOption', { count: 4 })}</option>
                        <option value="5">{t('home.bookingForm.peopleOption', { count: 5 })}</option>
                        <option value="6">{t('home.bookingForm.peopleOption', { count: 6 })}</option>
                        <option value="7">{t('home.bookingForm.peopleOption', { count: 7 })}</option>
                        <option value="8">{t('home.bookingForm.peopleOption', { count: 8 })}</option>
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('home.bookingForm.preferredDate')}
                    </label>
                    <input
                      type="date"
                      name="preferred_date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('home.bookingForm.preferredTime')}
                    </label>
                    <div className="relative">
                      <select
                        name="preferred_time"
                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm appearance-none"
                      >
                        <option value="">{t('home.bookingForm.selectTime')}</option>
                        <option value="10:00 AM">10:00 AM</option>
                        <option value="2:00 PM">2:00 PM</option>
                        <option value="6:00 PM">6:00 PM</option>
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('home.bookingForm.howHeard')}
                  </label>
                  <div className="relative">
                    <select
                      name="how_heard"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm pr-8"
                    >
                      <option value="">{t('home.bookingForm.selectOption')}</option>
                      <option value="google">{t('home.bookingForm.optGoogle')}</option>
                      <option value="social-media">{t('home.bookingForm.optSocial')}</option>
                      <option value="friend-recommendation">{t('home.bookingForm.optFriendRecommendation')}</option>
                      <option value="travel-blog">{t('home.bookingForm.optTravelBlog')}</option>
                      <option value="hotel-concierge">{t('home.bookingForm.optHotelConcierge')}</option>
                      <option value="other">{t('home.bookingForm.optOther')}</option>
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="agreeTerms"
                    name="agreeTerms"
                    required
                    className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                  />
                  <label htmlFor="agreeTerms" className="text-sm text-gray-600">
                    {t('home.bookingForm.agreeTerms')}
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBookingForm(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    {t('home.bookingForm.submit')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Cooking Class Modal */}
      {showCookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="relative">
              <img
                src="https://readdy.ai/api/search-image?query=Georgian%20grandmother%20teaching%20traditional%20cooking%20in%20rustic%20kitchen%2C%20making%20khachapuri%20and%20khinkali%2C%20authentic%20clay%20oven%2C%20wooden%20utensils%2C%20warm%20family%20atmosphere%2C%20traditional%20Georgian%20cuisine%20preparation&width=800&height=300&seq=cooking-header&orientation=landscape"
                alt={t('home.cookingModal.imageAlt')}
                className="w-full h-64 object-cover object-top"
              />
              <button
                onClick={() => setShowCookingModal(false)}
                className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100 transition-colors"
              >
                <i className="ri-close-line text-xl text-gray-600"></i>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('home.cookingModal.title')}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <i className="ri-time-line text-red-500"></i>
                    <span>{t('home.cookingModal.duration')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="ri-group-line text-red-500"></i>
                    <span>{t('home.cookingModal.groupSize')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="ri-map-pin-line text-red-500"></i>
                    <span>{t('home.cookingModal.location')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className="ri-star-fill text-yellow-400"></i>
                    <span>{t('home.cookingModal.rating')}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{t('home.cookingModal.whatYoullLearn')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3">
                      <i className="ri-restaurant-line text-red-500 text-lg"></i>
                      <span>{t('home.cookingModal.learn1')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <i className="ri-restaurant-line text-red-500 text-lg"></i>
                      <span>{t('home.cookingModal.learn2')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <i className="ri-leaf-line text-red-500 text-lg"></i>
                      <span>{t('home.cookingModal.learn3')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <i className="ri-book-line text-red-500 text-lg"></i>
                      <span>{t('home.cookingModal.learn4')}</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className="bg-gray-50 p-6 rounded-lg sticky top-6">
                    <div className="text-center mb-4">
                      <div className="text-3xl font-bold text-gray-900">₾45</div>
                      <div className="text-sm text-gray-600">{t('home.cookingModal.perPerson')}</div>
                    </div>

                    <div className="flex items-center justify-center gap-1 mb-4">
                      <div className="flex text-yellow-400">
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                      </div>
                      <span className="text-sm text-gray-600 ml-2">{t('home.cookingModal.rating')}</span>
                    </div>

                    <button
                      onClick={() => {
                        setShowCookingModal(false);
                        setShowBookingForm(true);
                      }}
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                    >
                      {t('home.cookingModal.bookThis')}
                    </button>

                    <div className="mt-4 text-xs text-gray-500 text-center">
                      <p>{t('home.cookingModal.noCharge')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wine Tasting Experience Modal */}
      {isWineTastingModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="relative">
              <img
                alt="Traditional Georgian Wine Tasting"
                className="w-full h-64 object-cover object-top"
                src="https://readdy.ai/api/search-image?query=Traditional%20Georgian%20wine%20cellar%20tasting%20experience%2C%20ancient%20qvevri%20clay%20vessels%2C%20wine%20master%20pouring%20amber%20wine%2C%20rustic%20stone%20cellar%2C%20candlelit%20atmosphere%2C%20traditional%20Georgian%20winemaking%2C%20authentic%20vineyard%20setting&width=800&height=400&seq=winetastingmodal&orientation=landscape"
              />
              <button
                onClick={() => setIsWineTastingModalOpen(false)}
                className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100 transition-colors"
              >
                <i className="ri-close-line text-xl text-gray-600"></i>
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Traditional Georgian Wine Tasting
                  </h2>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center gap-1">
                      <i className="ri-time-line text-red-500"></i>
                      <span className="text-gray-600">2-3 hours</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <i className="ri-group-line text-red-500"></i>
                      <span className="text-gray-600">2-12 people</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <i className="ri-map-pin-line text-red-500"></i>
                      <span className="text-gray-600">Kakheti Region</span>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Experience Overview</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Discover Georgia&apos;s 8,000‑year‑old winemaking tradition in an authentic cellar
                      setting. Taste unique amber wines made in traditional qvevri clay vessels, learn about
                      ancient techniques, and enjoy local cheese and bread pairings with a master sommelier.
                    </p>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">What You&apos;ll Taste</h3>
                    <ul className="space-y-2 text-gray-600">
                      <li className="flex items-start gap-2">
                        <i className="ri-check-line text-red-500 mt-1"></i>
                        <span>5 premium Georgian wines including rare amber varieties</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-check-line text-red-500 mt-1"></i>
                        <span>Traditional qvevri wines aged underground</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-check-line text-red-500 mt-1"></i>
                        <span>Local Saperavi, Rkatsiteli, and Mtsvane varieties</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-check-line text-red-500 mt-1"></i>
                        <span>Artisanal Georgian cheese and fresh bread</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Experience Includes</h3>
                    <ul className="space-y-2 text-gray-600">
                      <li className="flex items-start gap-2">
                        <i className="ri-check-line text-red-500 mt-1"></i>
                        <span>Professional wine tasting with expert sommelier</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-check-line text-red-500 mt-1"></i>
                        <span>Traditional cellar and qvevri tour</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-check-line text-red-500 mt-1"></i>
                        <span>Local cheese, bread, and snack pairings</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-check-line text-red-500 mt-1"></i>
                        <span>Transportation from Tbilisi (optional)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-check-line text-red-500 mt-1"></i>
                        <span>Wine tasting notes and educational materials</span>
                      </li>
                    </ul>
                  </div>

                </div>

                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-lg p-6 sticky top-6">
                    <div className="text-center mb-4">
                      <span className="text-3xl font-bold text-red-500">₾35</span>
                      <span className="text-gray-600 ml-2">per person</span>
                    </div>

                    <div className="flex items-center justify-center gap-1 mb-4">
                      <div className="flex text-yellow-400">
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                      </div>
                      <span className="text-sm text-gray-600 ml-2">4.9 (127 reviews)</span>
                    </div>

                    <button
                      onClick={handleWineTastingBooking}
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors mb-4"
                    >
                      Book This Experience
                    </button>

                    <div className="text-sm text-gray-600 space-y-2">
                      <div className="flex items-center gap-2">
                        <i className="ri-shield-check-line text-green-500"></i>
                        <span>Free cancellation up to 24 hours</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-time-line text-blue-500"></i>
                        <span>Instant confirmation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-group-line text-purple-500"></i>
                        <span>Private or group options</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-2">Cancellation Policy</h4>
                      <p className="text-sm text-gray-600">
                        Free cancellation up to 24 hours before the experience starts. 50% refund for cancellations
                        within 24 hours.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wine Tasting Booking Form Modal */}
      {isWineTastingBookingOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Book Wine Tasting Experience</h2>
                <button
                  onClick={handleWineTastingBookingClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>

              <form
                id="wine-tasting-booking"
                data-readdy-form
                action="https://readdy.ai/api/form/d3vqi5jjbvf464v011o0"
                method="POST"
                encType="application/x-www-form-urlencoded"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);

                  // Validate required fields
                  const requiredFields = ['fullName', 'email', 'phone', 'preferredDate', 'numberOfPeople'];
                  const missingFields = requiredFields.filter((field) => !formData.get(field));

                  if (missingFields.length > 0) {
                    alert('Please fill in all required fields');
                    return;
                  }

                  // Ensure date is in the future
                  const selectedDate = new Date(formData.get('preferredDate') as string);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  if (selectedDate < today) {
                    alert('Please select a future date');
                    return;
                  }

                  // Submit form
                  fetch(form.action, {
                    method: 'POST',
                    body: new URLSearchParams(formData as any),
                  })
                    .then(() => {
                      alert(
                        'Booking request submitted successfully! We will contact you within 24 hours to confirm your wine tasting experience.'
                      );
                      handleWineTastingBookingClose();
                    })
                    .catch(() => {
                      alert('There was an error submitting your booking. Please try again.');
                    });
                }}
                className="space-y-4"
              >
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-red-800 mb-2">Traditional Georgian Wine Tasting</h3>
                  <div className="text-sm text-red-700 space-y-1">
                    <p>• 2-3 hours experience in Kakheti Region</p>
                    <p>• 5 premium wines + traditional food pairings</p>
                    <p>• Expert sommelier and cellar tour included</p>
                    <p>• Price: ₾35 per person</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-5 text-sm"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                      placeholder="Enter your phone number"
                    />
                  </div>

                  <div>
                    <label htmlFor="numberOfPeople" className="block text-sm font-medium text-gray-700 mb-1">
                      Number of People *
                    </label>
                    <select
                      id="numberOfPeople"
                      name="numberOfPeople"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm pr-8"
                    >
                      <option value="">Select group size</option>
                      <option value="2">2 people</option>
                      <option value="3">3 people</option>
                      <option value="4">4 people</option>
                      <option value="5">5 people</option>
                      <option value="6">6 people</option>
                      <option value="7">7 people</option>
                      <option value="8">8 people</option>
                      <option value="9">9 people</option>
                      <option value="10">10 people</option>
                      <option value="11">11 people</option>
                      <option value="12">12 people</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="preferredDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred Date *
                    </label>
                    <input
                      type="date"
                      id="preferredDate"
                      name="preferredDate"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="preferredTime" className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred Time
                    </label>
                    <select
                      id="preferredTime"
                      name="preferredTime"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm pr-8"
                    >
                      <option value="">Select time</option>
                      <option value="10:00 AM">10:00 AM</option>
                      <option value="11:00 AM">11:00 AM</option>
                      <option value="2:00 PM">2:00 PM</option>
                      <option value="3:00 PM">3:00 PM</option>
                      <option value="4:00 PM">4:00 PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="transportationNeeded" className="block text-sm font-medium text-gray-700 mb-1">
                    Transportation from Tbilisi
                  </label>
                  <select
                    id="transportationNeeded"
                    name="transportationNeeded"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm pr-8"
                  >
                    <option value="">Select option</option>
                    <option value="yes">Yes, I need transportation (+₾25 per person)</option>
                    <option value="no">No, I have my own transportation</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="dietaryRestrictions" className="block text-sm font-medium text-gray-700 mb-1">
                    Dietary Restrictions or Allergies
                  </label>
                  <textarea
                    id="dietaryRestrictions"
                    name="dietaryRestrictions"
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
                    placeholder="Please let us know about any dietary restrictions, allergies, or special requirements..."
                  ></textarea>
                  <p className="text-xs text-gray-500 mt-1">Maximum 500 characters</p>
                </div>

                <div>
                  <label htmlFor="howDidYouHear" className="block text-sm font-medium text-gray-700 mb-1">
                    How did you hear about us?
                  </label>
                  <select
                    id="howDidYouHear"
                    name="howDidYouHear"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm pr-8"
                  >
                    <option value="">Select option</option>
                    <option value="google">Google Search</option>
                    <option value="social-media">Social Media</option>
                    <option value="friend-referral">Friend Referral</option>
                    <option value="travel-blog">Travel Blog</option>
                    <option value="hotel-recommendation">Hotel Recommendation</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="agreeTermsWine"
                    name="agreeTermsWine"
                    required
                    className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                  />
                  <label htmlFor="agreeTermsWine" className="text-sm text-gray-600">
                    I agree to the cancellation policy and terms of service *
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleWineTastingBookingClose}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    Submit Booking Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
