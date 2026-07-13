import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';

type SeasonKey = 'summer' | 'autumn' | 'winter' | 'spring';

const SEASONS: { key: SeasonKey; label: string }[] = [
  { key: 'summer', label: '☀️ Summer' },
  { key: 'autumn', label: '🍂 Autumn' },
  { key: 'winter', label: '❄️ Winter' },
  { key: 'spring', label: '🌸 Spring' },
];

interface Region {
  name: string;
  kind: string;
  tag: string;
  places: string[];
  count: string;
  img: string;
}

const REGIONS: Region[] = [
  {
    name: 'Kakheti',
    kind: 'Wine · Harvest · Gastronomy',
    tag: '🍂 Best: Sep–Oct',
    places: ['Sighnaghi — the City of Love', 'Bodbe Monastery', 'Alazani Valley & wineries'],
    count: '14 cottages',
    img: '/redesign/region-kakheti.jpg',
  },
  {
    name: 'Gudauri & Kazbegi',
    kind: 'Skiing · Mountains · Trinity views',
    tag: '❄️ Best: Dec–Mar',
    places: ['Gudauri ski slopes', 'Gergeti Trinity Church', 'Truso Valley'],
    count: '24 cottages',
    img: '/redesign/region-gudauri.jpg',
  },
  {
    name: 'Svaneti',
    kind: 'Hiking · Towers · Ushguli',
    tag: '☀️ Best: Jun–Sep',
    places: ['Mestia & its museums', 'Ushguli — Europe\u2019s highest village', 'Hiking trails'],
    count: '9 cottages',
    img: '/redesign/region-kazbegi.jpg',
  },
  {
    name: 'Samtskhe-Javakheti',
    kind: 'Borjomi · Vardzia · Abastumani',
    tag: '🌸 Year-round',
    places: ['Vardzia cave city', 'Rabati Castle', 'Borjomi mineral waters'],
    count: '17 cottages',
    img: '/redesign/region-bakuriani.jpg',
  },
  {
    name: 'Imereti & Racha',
    kind: 'Caves · Canyons · Shaori',
    tag: '☀️ Best: May–Oct',
    places: ['Prometheus Cave', 'Okatse Canyon', 'Lake Shaori & Utsera'],
    count: '19 cottages',
    img: '/redesign/season-summer.jpg',
  },
  {
    name: 'Adjara',
    kind: 'Sea · Mountain Adjara · Chirukhi',
    tag: '☀️ Best: Jun–Sep',
    places: ['Batumi & the Botanical Garden', 'Machakhela Valley', 'Gonio & Kvariati'],
    count: '7 cottages',
    img: '/redesign/season-autumn.jpg',
  },
];

const EXPERIENCES = [
  { icon: '🍷', title: 'Harvest & wine', desc: 'Winery cottages in Kakheti, with tastings and a feast' },
  { icon: '🎿', title: 'Ski weekend', desc: 'Cottages by the slopes — Gudauri, Bakuriani, Goderdzi' },
  { icon: '♨️', title: 'Jacuzzi & calm', desc: 'Romantic A-Frames in the forest, for two' },
  { icon: '👨‍👩‍👧‍👦', title: 'Family getaway', desc: 'A big yard, a grill and room for the whole family' },
];

const PRACTICAL = [
  { icon: '🗓', title: 'When to book', desc: 'In winter (Gudauri, Bakuriani) book 3–4 weeks ahead — the best cottages fill fast' },
  { icon: '🚗', title: 'Getting there', desc: 'Most cottages are reachable by car; road conditions are always noted on the page' },
  { icon: '💳', title: 'Payment', desc: 'Online by card or on arrival — your choice. Prices are always in GEL, with no hidden fees' },
  { icon: '🐶', title: 'Pets', desc: 'Many cottages welcome four-legged guests too — use the “Pets” filter' },
];

export default function AboutGeorgia() {
  const navigate = useNavigate();
  const [season, setSeason] = useState<SeasonKey>('summer');

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
          <h1 className="text-[26px] md:text-[40px] font-extrabold tracking-tight">Where to stay in Georgia?</h1>
          <p className="max-w-xl mx-auto mt-3 text-[16.5px] opacity-95">
            Pick a season and discover the region that fits your mood
          </p>
          <div className="flex justify-center gap-2.5 mt-6 flex-wrap">
            {SEASONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSeason(s.key)}
                className={`rounded-full px-5 py-2.5 text-sm font-bold cursor-pointer transition-colors border-[1.5px] ${
                  season === s.key
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-white/[0.14] border-white/35 text-white hover:bg-white/25'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Region cards */}
      <section className="py-14 md:py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center text-ink">Regions to unwind</h2>
          <p className="text-center text-muted-foreground max-w-xl mx-auto mt-2 mb-9">
            Verified cottages await in every region
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-[22px]">
            {REGIONS.map((r) => (
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
                    {r.places.map((p, i) => (
                      <li key={i} className="relative pl-5 text-[13.5px] text-muted-foreground">
                        <span className="absolute left-0 text-[11px]" aria-hidden="true">📍</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between items-center border-t border-line pt-3">
                    <span className="text-[13px] text-soft">{r.count}</span>
                    <button
                      onClick={() => navigate(`/search?location=${encodeURIComponent(r.name)}`)}
                      className="text-red-500 text-[13.5px] font-bold cursor-pointer hover:text-red-600 transition-colors whitespace-nowrap"
                    >
                      See cottages →
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
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center">What experience are you after?</h2>
          <p className="text-center text-gray-300 max-w-xl mx-auto mt-2 mb-9">
            A cottage is more than a bed — pick your type of getaway
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px]">
            {EXPERIENCES.map((e) => (
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
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center text-ink">Practical information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px] mt-8">
            {PRACTICAL.map((p) => (
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
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-ink">Ready to travel?</h2>
          <p className="text-muted-foreground max-w-md mx-auto mt-2.5 mb-6">
            Pick a region and find your cottage — 500+ options across Georgia
          </p>
          <button
            onClick={() => navigate('/search')}
            className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl px-6 py-3.5 text-[15px] cursor-pointer transition-colors whitespace-nowrap"
          >
            🔍 Find a cottage
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
