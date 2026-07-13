import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@lib/i18n';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';

export default function SiteMap() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Site Map — RentCottage.Ge',
    description: 'Navigate through all pages and sections of RentCottage.Ge, the Georgian cottage rental platform.',
    url: `${siteUrl}/sitemap`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  const siteStructure = [
    {
      category: t('sitemap.catMain'),
      links: [
        { title: t('common.home'), path: '/', description: t('sitemap.homeDesc') },
        { title: t('sitemap.searchTitle'), path: '/search', description: t('sitemap.searchDesc') },
        { title: t('sitemap.propertyTitle'), path: '/property/1', description: t('sitemap.propertyDesc') }
      ]
    },
    {
      category: t('sitemap.catAccount'),
      links: [
        { title: t('sitemap.profileTitle'), path: '/profile', description: t('sitemap.profileDesc') }
      ]
    },
    {
      category: t('sitemap.catHost'),
      links: [
        { title: t('header.nav.becomeHost'), path: '/become-host', description: t('sitemap.becomeHostDesc') },
        { title: t('footer.hostResources'), path: '/host-resources', description: t('sitemap.hostResourcesDesc') }
      ]
    },
    {
      category: t('sitemap.catAbout'),
      links: [
        { title: t('header.nav.howItWorks'), path: '/how-it-works', description: t('sitemap.howItWorksDesc') },
        { title: t('header.nav.aboutGeorgia'), path: '/about-georgia', description: t('sitemap.aboutGeorgiaDesc') }
      ]
    },
    {
      category: t('sitemap.catLegal'),
      links: [
        { title: t('privacy.title'), path: '/privacy', description: t('sitemap.privacyDesc') },
        { title: t('footer.terms'), path: '/terms', description: t('sitemap.termsDesc') }
      ]
    }
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={t('sitemap.seo.title')}
        description="Navigate through all pages and sections of RentCottage.Ge, the Georgian cottage rental platform."
        canonical="/sitemap"
        noIndex={true}
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero Section */}
      <section className="relative w-full h-[180px] sm:h-[260px] md:h-[340px] overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=panoramic%20Georgian%20mountain%20landscape%20Kazbegi%20Greater%20Caucasus%20range%20wide%20open%20valley%20soft%20morning%20light%20misty%20peaks%20green%20meadows%20no%20people%20calm%20serene%20minimal%20clean%20aerial%20view%20pastel%20tones%20golden%20hour%20glow%20vast%20sky%20peaceful%20nature&width=1600&height=500&seq=sitemap-hero-01&orientation=landscape"
          alt={t('sitemap.heroAlt')}
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3">{t('footer.siteMap')}</h1>
          <p className="text-xs sm:text-base md:text-lg text-white/85 max-w-2xl">
            {t('sitemap.heroSubtitle')}
          </p>
        </div>
      </section>

      {/* Site Map Content */}
      <section className="py-8 sm:py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">

          {/* Site structure grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {siteStructure.map((section, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                <h2 className="text-sm sm:text-base md:text-xl font-semibold text-gray-900 mb-3 sm:mb-5 md:mb-6 pb-2 sm:pb-3 border-b border-gray-100">
                  {section.category}
                </h2>
                <div className="space-y-2 sm:space-y-3 md:space-y-4">
                  {section.links.map((link, linkIndex) => (
                    <div key={linkIndex} className="group">
                      <button
                        onClick={() => handleNavigation(link.path)}
                        className="block w-full text-left hover:bg-gray-50 rounded-lg p-2 sm:p-3 transition-colors cursor-pointer"
                      >
                        <h3 className="font-medium text-red-600 group-hover:text-red-700 mb-0.5 sm:mb-1 text-xs sm:text-sm md:text-base">
                          {link.title}
                        </h3>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {link.description}
                        </p>
                        <span className="text-xs text-gray-400 mt-0.5 sm:mt-1 block">
                          {link.path}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Navigation */}
          <div className="mt-8 sm:mt-12 md:mt-16 bg-red-50 rounded-2xl p-4 sm:p-6 md:p-8">
            <div className="text-center mb-4 sm:mb-6 md:mb-8">
              <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">{t('sitemap.quickNavTitle')}</h2>
              <p className="text-gray-600 text-xs sm:text-sm md:text-base">
                {t('sitemap.quickNavSubtitle')}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                { icon: 'ri-search-line', label: t('header.searchCottages'), path: '/search' },
                { icon: 'ri-home-heart-line', label: t('sitemap.becomeHostShort'), path: '/become-host' },
                { icon: 'ri-question-line', label: t('header.nav.howItWorks'), path: '/how-it-works' },
                { icon: 'ri-map-pin-line', label: t('header.nav.aboutGeorgia'), path: '/about-georgia' }
              ].map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleNavigation(item.path)}
                  className="flex flex-col items-center p-3 sm:p-4 bg-white rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center mb-2 sm:mb-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                      <i className={`${item.icon} text-lg sm:text-xl text-red-600`}></i>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-900 text-center">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Contact Information */}
          <div className="mt-8 sm:mt-12 md:mt-16 text-center">
            <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 md:p-8">
              <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">{t('sitemap.helpTitle')}</h2>
              <p className="text-gray-600 text-xs sm:text-sm md:text-base mb-4 sm:mb-5 md:mb-6 max-w-2xl mx-auto">
                {t('sitemap.helpBody')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mr-1.5 sm:mr-2">
                    <i className="ri-mail-line text-red-600 text-sm sm:text-base"></i>
                  </div>
                  <span className="text-gray-700 text-xs sm:text-sm md:text-base">info.rentcottage@gmail.com</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />
    </div>
  );
}
