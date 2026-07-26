import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';
import { useApprovedCount } from '../../hooks/useApprovedCount';
import { useT } from '../../i18n';

type SeasonKey = 'summer' | 'autumn' | 'winter' | 'spring';

const SEASON_KEYS: SeasonKey[] = ['summer', 'autumn', 'winter', 'spring'];
const SEASON_LABEL_KEY: Record<SeasonKey, string> = {
  summer: 'aboutGeorgia.seasonSummer',
  autumn: 'aboutGeorgia.seasonAutumn',
  winter: 'aboutGeorgia.seasonWinter',
  spring: 'aboutGeorgia.seasonSpring',
};

interface Region {
  name: string;
  kind: string;
  tag: string;
  places: string[];
  count: number;
  img: string;
}

const REGION_META = [
  { n: 1, count: 14, img: '/redesign/region-kakheti.jpg' },
  { n: 2, count: 24, img: '/redesign/region-gudauri.jpg' },
  { n: 3, count: 9, img: '/redesign/region-kazbegi.jpg' },
  { n: 4, count: 17, img: '/redesign/region-bakuriani.jpg' },
  { n: 5, count: 19, img: '/redesign/season-summer.jpg' },
  { n: 6, count: 7, img: '/redesign/season-autumn.jpg' },
];

const EXPERIENCE_ICONS = ['🍷', '🎿', '♨️', '👨‍👩‍👧‍👦'];
const PRACTICAL_ICONS = ['🗓', '🚗', '💳', '🐶'];

export default function AboutGeorgia() {
  const navigate = useNavigate();
  const { count } = useApprovedCount();
  const { t } = useT();
  const [season, setSeason] = useState<SeasonKey>('summer');

  const regions: Region[] = REGION_META.map(({ n, count: c, img }) => ({
    name: t(`aboutGeorgia.r${n}Name`),
    kind: t(`aboutGeorgia.r${n}Kind`),
    tag: t(`aboutGeorgia.r${n}Tag`),
    places: [t(`aboutGeorgia.r${n}p1`), t(`aboutGeorgia.r${n}p2`), t(`aboutGeorgia.r${n}p3`)],
    count: c,
    img,
  }));

  const experiences = [1, 2, 3, 4].map((n, i) => ({
    icon: EXPERIENCE_ICONS[i],
    title: t(`aboutGeorgia.e${n}Title`),
    desc: t(`aboutGeorgia.e${n}Desc`),
  }));

  const practical = [1, 2, 3, 4].map((n, i) => ({
    icon: PRACTICAL_ICONS[i],
    title: t(`aboutGeorgia.p${n}Title`),
    desc: t(`aboutGeorgia.p${n}Desc`),
  }));

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'About Georgia — Travel Guide to Georgian Culture, Wine & Landscapes',
      description: "Explore Georgia's 8,000-year history, UNESCO World Heritage sites, ancient wine traditions and stunning Caucasus landscapes. Your complete guide to traveling in Georgia.",
      url: `${siteUrl}/about-georgia`,
      isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'TouristDestination',
      name: 'Georgia (Country)',
      description: "A land where ancient traditions meet stunning natural beauty. Georgia offers 8,000 years of winemaking, UNESCO World Heritage sites, Caucasus mountain landscapes and legendary hospitality.",
      url: `${siteUrl}/about-georgia`,
      touristType: ['Cultural Tourism', 'Eco Tourism', 'Wine Tourism', 'Adventure Tourism'],
      includesAttraction: [
        { '@type': 'TouristAttraction', name: 'Kazbegi National Park', address: { '@type': 'PostalAddress', addressCountry: 'GE' } },
        { '@type': 'TouristAttraction', name: 'Mtskheta — UNESCO World Heritage Site', address: { '@type': 'PostalAddress', addressCountry: 'GE' } },
        { '@type': 'TouristAttraction', name: 'Kakheti Wine Region', address: { '@type': 'PostalAddress', addressCountry: 'GE' } },
        { '@type': 'TouristAttraction', name: 'Upper Svaneti — UNESCO World Heritage Site', address: { '@type': 'PostalAddress', addressCountry: 'GE' } },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <SEO
        title="About Georgia — Travel Guide to Georgian Culture, Wine & Landscapes | RentCottage.Ge"
        description="Explore Georgia's 8,000-year history, UNESCO World Heritage sites, ancient wine traditions and stunning Caucasus landscapes. Your complete guide to traveling in Georgia."
        keywords="Georgia travel guide, Georgian culture, Caucasus mountains, Georgian wine, Kakheti, Kazbegi, UNESCO Georgia, Georgian cuisine, visit Georgia"
        canonical="/about-georgia"
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero — dark gradient over mountains, season selector */}
      <section
        className="text-white text-center py-[76px] px-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url('/redesign/region-kazbegi.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="max-w-3xl mx-auto">
          <h1 className="text-[26px] md:text-[40px] font-extrabold tracking-tight">{t('aboutGeorgia.heroTitle')}</h1>
          <p className="max-w-xl mx-auto mt-3 text-[16.5px] opacity-95">
            {t('aboutGeorgia.heroSub')}
          </p>
          <div className="flex justify-center gap-2.5 mt-6 flex-wrap">
            {SEASON_KEYS.map((s) => (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className={`rounded-full px-5 py-2.5 text-sm font-bold cursor-pointer transition-colors border-[1.5px] ${
                  season === s
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-white/[0.14] border-white/35 text-white hover:bg-white/25'
                }`}
              >
                {t(SEASON_LABEL_KEY[s])}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Region cards */}
      <section className="py-14 md:py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center text-ink">{t('aboutGeorgia.regionsTitle')}</h2>
          <p className="text-center text-muted-foreground max-w-xl mx-auto mt-2 mb-9">
            {t('aboutGeorgia.regionsSub')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-[22px]">
            {regions.map((r) => (
              <div key={r.name} className="bg-white rounded-card shadow-card overflow-hidden hover:-translate-y-1 transition-transform duration-200">
                <div
                  className="h-[170px] bg-cover bg-center relative"
                  style={{ backgroundImage: `url('${r.img}')` }}
                >
                  <span className="absolute top-3 left-3 bg-white/95 text-ink text-xs font-bold px-2.5 py-1 rounded-full">{r.tag}</span>
                </div>
                <div className="p-5">
                  <h3 className="text-[17.5px] font-extrabold text-ink">{r.name}</h3>
                  <div className="text-red-500 text-[13px] font-bold mt-0.5 mb-2.5">{r.kind}</div>
                  <ul className="mb-3.5 space-y-1.5">
                    {r.places.map((p) => (
                      <li key={p} className="relative pl-5 text-[13.5px] text-muted-foreground">
                        <span className="absolute left-0 text-[11px]" aria-hidden="true">📍</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between items-center border-t border-line pt-3">
                    <span className="text-[13px] text-soft">{t('aboutGeorgia.cottagesCount', { n: r.count })}</span>
                    <button
                      onClick={() => navigate(`/search?location=${encodeURIComponent(r.name)}`)}
                      className="text-red-500 text-[13.5px] font-bold cursor-pointer hover:text-red-600 transition-colors whitespace-nowrap"
                    >
                      {t('aboutGeorgia.seeCottages')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Experience strip — dark */}
      <section className="bg-[#222222] text-white py-14 md:py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center">{t('aboutGeorgia.expTitle')}</h2>
          <p className="text-center text-gray-300 max-w-xl mx-auto mt-2 mb-9">
            {t('aboutGeorgia.expSub')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px]">
            {experiences.map((e) => (
              <div key={e.title} className="bg-white/[0.06] border border-white/[0.14] rounded-card p-5 text-center">
                <div className="text-[30px] leading-none" aria-hidden="true">{e.icon}</div>
                <h3 className="text-[15.5px] font-bold mt-2.5 mb-1.5">{e.title}</h3>
                <p className="text-[13px] text-gray-300 leading-relaxed">{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Practical info */}
      <section className="py-14 md:py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center text-ink">{t('aboutGeorgia.practicalTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px] mt-8">
            {practical.map((p) => (
              <div key={p.title} className="bg-white border border-line rounded-card p-5">
                <div className="text-2xl leading-none" aria-hidden="true">{p.icon}</div>
                <h3 className="text-[15px] font-bold text-ink mt-2 mb-1.5">{p.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white border-t border-line py-14 md:py-16 px-5 text-center">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-ink">{t('aboutGeorgia.ctaTitle')}</h2>
          <p className="text-muted-foreground max-w-md mx-auto mt-2.5 mb-6">
            {t('aboutGeorgia.ctaSub', { count: count !== null ? ` — ${count} options` : '' })}
          </p>
          <button
            onClick={() => navigate('/search')}
            className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl px-6 py-3.5 text-[15px] cursor-pointer transition-colors whitespace-nowrap"
          >
            {t('aboutGeorgia.ctaBtn')}
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
