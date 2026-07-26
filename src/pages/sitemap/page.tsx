import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';
import { useT } from '../../i18n';

export default function SiteMap() {
  const navigate = useNavigate();
  const { t } = useT();
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Site Map — RentCottage.Ge',
    description: 'Navigate through all pages and sections of RentCottage.Ge, the Georgian cottage rental platform.',
    url: `${siteUrl}/sitemap`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  // Real, public-appropriate routes grouped into the mockup's three columns.
  // (Gated surfaces like the admin panel are intentionally not exposed here.)
  const columns = [
    {
      title: t('siteMap.forGuests'),
      links: [
        { label: t('siteMap.home'), path: '/' },
        { label: t('siteMap.search'), path: '/search' },
        { label: t('siteMap.sample'), path: '/property/1' },
        { label: t('siteMap.experiences'), path: '/book-experience' },
        { label: t('siteMap.whereToStay'), path: '/about-georgia' },
        { label: t('siteMap.howItWorks'), path: '/how-it-works' },
      ],
    },
    {
      title: t('siteMap.forHosts'),
      links: [
        { label: t('siteMap.becomeHost'), path: '/become-host' },
        { label: t('siteMap.hostGuide'), path: '/host-resources' },
        { label: t('siteMap.hostDashboard'), path: '/host-dashboard' },
      ],
    },
    {
      title: t('siteMap.account'),
      links: [
        { label: t('siteMap.myProfile'), path: '/profile' },
        { label: t('siteMap.terms'), path: '/terms' },
        { label: t('siteMap.privacy'), path: '/privacy' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <SEO
        title="Site Map — RentCottage.Ge"
        description="Navigate through all pages and sections of RentCottage.Ge, the Georgian cottage rental platform."
        canonical="/sitemap"
        noIndex={true}
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero — white band, centered */}
      <section className="bg-white border-b border-line py-10 text-center">
        <div className="max-w-4xl mx-auto px-5">
          <h1 className="text-[22px] md:text-[30px] font-extrabold text-ink tracking-tight">{t('siteMap.title')}</h1>
          <p className="text-soft text-sm mt-1.5">{t('siteMap.subtitle')}</p>
        </div>
      </section>

      {/* Three-column link grid */}
      <div className="max-w-4xl mx-auto px-5 grid grid-cols-1 md:grid-cols-3 gap-5 py-10 md:py-14">
        {columns.map((col) => (
          <div key={col.title} className="bg-white border border-line rounded-card p-6">
            <h2 className="text-[15px] font-extrabold text-ink mb-3.5 flex items-center gap-2">{col.title}</h2>
            <div className="flex flex-col">
              {col.links.map((link) => (
                <button
                  key={link.label}
                  onClick={() => navigate(link.path)}
                  className="flex items-center gap-2 text-sm text-muted-foreground py-1.5 border-b border-[#fafafa] last:border-b-0 hover:text-red-500 transition-colors cursor-pointer text-left"
                >
                  <span className="text-red-500 font-bold" aria-hidden="true">→</span>
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />
    </div>
  );
}
