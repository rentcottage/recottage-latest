import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Header from '../../components/feature/Header';
import ExperienceBookingForm from './components/ExperienceBookingForm';
import SEO from '../../components/feature/SEO';

interface Experience {
  id: string;
  title: string;
  description: string;
  price_per_person: number;
  currency_symbol: string | null;
  image_url: string | null;
  status: 'active' | 'coming_soon' | 'archived';
}

export default function BookExperiencePage() {
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('id');

  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('experiences')
        .select('id,title,description,price_per_person,currency_symbol,image_url,status')
        .eq('status', 'active')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (cancelled) return;
      const list = (data ?? []) as Experience[];
      setExperiences(list);
      setLoading(false);
      if (requestedId && list.some((e) => e.id === requestedId)) {
        setActiveId(requestedId);
      } else if (list.length > 0) {
        setActiveId(list[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedId]);

  const active = experiences.find((e) => e.id === activeId) ?? null;

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';
  const jsonLd = active
    ? {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: active.title,
        description: active.description,
        url: `${siteUrl}/book-experience?id=${active.id}`,
        provider: { '@type': 'Organization', name: 'RentCottage.Ge', url: siteUrl },
        areaServed: { '@type': 'Country', name: 'Georgia' },
        offers: {
          '@type': 'Offer',
          price: String(active.price_per_person),
          priceCurrency: 'GEL',
        },
      }
    : null;

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={
          active
            ? `Book ${active.title} | RentCottage.Ge`
            : 'Book Georgian Experiences | RentCottage.Ge'
        }
        description={
          active?.description ??
          'Book authentic Georgian experiences. Immerse yourself in 8,000 years of culture.'
        }
        canonical={active ? `/book-experience?id=${active.id}` : '/book-experience'}
        ogImage={active?.image_url ?? undefined}
        jsonLd={jsonLd ?? undefined}
      />
      <Header />

      <section
        className="relative h-40 md:h-72 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('https://readdy.ai/api/search-image?query=Aerial%20panoramic%20view%20of%20Georgian%20mountain%20village%20at%20golden%20hour%2C%20traditional%20stone%20houses%2C%20vineyard%20terraces%2C%20lush%20green%20landscape%2C%20Caucasus%20peaks%20in%20background%2C%20cinematic%20warm%20lighting%2C%20beautiful%20rural%20countryside&width=1400&height=288&seq=exp-page-hero&orientation=landscape')",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <p className="hidden md:block text-xs uppercase tracking-widest text-red-300 font-medium mb-3">
            Authentic Georgian Experiences
          </p>
          <h1 className="text-2xl md:text-5xl font-bold text-white mb-1 md:mb-3">
            Book Your Experience
          </h1>
          <p className="text-white/80 text-xs md:text-base max-w-xl">
            Immerse yourself in Georgian culture
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-16">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading experiences…</div>
        ) : experiences.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No experiences are available right now. Please check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12 items-start">
            <div>
              {experiences.length > 1 && (
                <div className="flex flex-wrap gap-2 md:gap-3 mb-4 md:mb-8 bg-gray-50 rounded-xl p-1 md:p-1.5">
                  {experiences.map((exp) => (
                    <button
                      key={exp.id}
                      onClick={() => setActiveId(exp.id)}
                      className={`flex-1 py-2 md:py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                        activeId === exp.id
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {exp.title}
                    </button>
                  ))}
                </div>
              )}

              {active && (
                <div className="rounded-xl md:rounded-2xl overflow-hidden border border-gray-100">
                  <div className="relative">
                    {active.image_url ? (
                      <img
                        src={active.image_url}
                        alt={active.title}
                        className="w-full h-40 md:h-56 object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-40 md:h-56 bg-gray-100 flex items-center justify-center text-gray-300">
                        <i className="ri-image-line text-4xl"></i>
                      </div>
                    )}
                  </div>

                  <div className="p-4 md:p-6">
                    <h2 className="text-base md:text-xl font-bold text-gray-900 mb-2 md:mb-3">
                      {active.title}
                    </h2>
                    <p className="text-xs md:text-sm text-gray-600 leading-relaxed mb-4 md:mb-5 whitespace-pre-line">
                      {active.description}
                    </p>

                    <div className="border-t border-gray-100 pt-3 md:pt-5 flex items-baseline gap-2">
                      <span className="text-xs text-gray-400">From</span>
                      <span className="text-2xl md:text-3xl font-bold text-red-500">
                        {(active.currency_symbol || '₾')}
                        {Number(active.price_per_person).toFixed(0)}
                      </span>
                      <span className="text-xs text-gray-400">/ person</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              {active ? (
                <ExperienceBookingForm
                  key={active.id}
                  experienceType={active.id}
                  experienceLabel={active.title}
                />
              ) : (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Pick an experience to start booking.
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
