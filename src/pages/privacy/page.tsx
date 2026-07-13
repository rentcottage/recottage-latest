import { useTranslation } from '@lib/i18n';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';

export default function Privacy() {
  const { t, lang } = useTranslation();
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Privacy Policy — RentCottage.Ge',
    description: 'Learn how RentCottage.Ge collects, uses and protects your personal information when you use our Georgian cottage rental platform.',
    url: `${siteUrl}/privacy`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={t('privacy.seo.title')}
        description="Learn how RentCottage.Ge collects, uses and protects your personal information when you use our Georgian cottage rental platform."
        canonical="/privacy"
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero */}
      <div className="relative w-full h-[180px] sm:h-[240px] md:h-[320px] overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=serene%20Georgian%20Gudauri%20mountain%20valley%20pine%20forest%20misty%20morning%20fog%20rolling%20hills%20no%20people%20wide%20open%20landscape%20soft%20diffused%20light%20pale%20green%20and%20grey%20tones%20tranquil%20nature%20clean%20minimal%20aerial%20Caucasus%20range&width=1600&height=460&seq=privacy-hero-01&orientation=landscape"
          alt={t('privacy.heroAlt')}
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/28" />
        <div className="absolute inset-0 flex flex-col justify-end px-4 pb-5 sm:pb-8 md:pb-12">
          <div className="max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-white/70 mb-2 sm:mb-3">
              <a href="/" className="hover:text-white transition-colors cursor-pointer">{t('common.home')}</a>
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-s-line text-white/50"></i>
              </div>
              <span className="text-white/90">{t('privacy.title')}</span>
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">{t('privacy.title')}</h1>
            <p className="text-white/70 text-xs sm:text-sm">
              {t('common.lastUpdated', { date: new Date().toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' }) })}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 md:py-16">
        <div className="bg-white">
          <div className="prose max-w-none">
            <p className="sr-only">
              {t('common.lastUpdated', { date: new Date().toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' }) })}
            </p>

            {[
              {
                title: t('privacy.s1Title'),
                content: (
                  <div className="space-y-3 text-gray-700">
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">{t('privacy.s1PersonalTitle')}</h3>
                    <p className="text-xs sm:text-sm">{t('privacy.s1PersonalIntro')}</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>{t('privacy.s1PersonalLi1')}</li>
                      <li>{t('privacy.s1PersonalLi2')}</li>
                      <li>{t('privacy.s1PersonalLi3')}</li>
                      <li>{t('privacy.s1PersonalLi4')}</li>
                      <li>{t('privacy.s1PersonalLi5')}</li>
                    </ul>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900 mt-4">{t('privacy.s1UsageTitle')}</h3>
                    <p className="text-xs sm:text-sm">{t('privacy.s1UsageIntro')}</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>{t('privacy.s1UsageLi1')}</li>
                      <li>{t('privacy.s1UsageLi2')}</li>
                      <li>{t('privacy.s1UsageLi3')}</li>
                      <li>{t('privacy.s1UsageLi4')}</li>
                    </ul>
                  </div>
                )
              },
              {
                title: t('privacy.s2Title'),
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">{t('privacy.s2Intro')}</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>{t('privacy.s2Li1')}</li>
                      <li>{t('privacy.s2Li2')}</li>
                      <li>{t('privacy.s2Li3')}</li>
                      <li>{t('privacy.s2Li4')}</li>
                      <li>{t('privacy.s2Li5')}</li>
                      <li>{t('privacy.s2Li6')}</li>
                      <li>{t('privacy.s2Li7')}</li>
                    </ul>
                  </div>
                )
              },
              {
                title: t('privacy.s3Title'),
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">{t('privacy.s3Intro')}</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">{t('privacy.s3HostsGuestsTitle')}</h3>
                    <p className="text-xs sm:text-sm">{t('privacy.s3HostsGuestsBody')}</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">{t('privacy.s3ProvidersTitle')}</h3>
                    <p className="text-xs sm:text-sm">{t('privacy.s3ProvidersIntro')}</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>{t('privacy.s3ProvidersLi1')}</li>
                      <li>{t('privacy.s3ProvidersLi2')}</li>
                      <li>{t('privacy.s3ProvidersLi3')}</li>
                      <li>{t('privacy.s3ProvidersLi4')}</li>
                    </ul>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">{t('privacy.s3LegalTitle')}</h3>
                    <p className="text-xs sm:text-sm">{t('privacy.s3LegalBody')}</p>
                  </div>
                )
              },
              {
                title: t('privacy.s4Title'),
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">{t('privacy.s4Intro')}</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>{t('privacy.s4Li1')}</li>
                      <li>{t('privacy.s4Li2')}</li>
                      <li>{t('privacy.s4Li3')}</li>
                      <li>{t('privacy.s4Li4')}</li>
                    </ul>
                    <p className="text-xs sm:text-sm">{t('privacy.s4Outro')}</p>
                  </div>
                )
              },
              {
                title: t('privacy.s5Title'),
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">{t('privacy.s5Intro')}</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">{t('privacy.s5AccessTitle')}</h3>
                    <p className="text-xs sm:text-sm">{t('privacy.s5AccessBody')}</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">{t('privacy.s5PortabilityTitle')}</h3>
                    <p className="text-xs sm:text-sm">{t('privacy.s5PortabilityBody')}</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">{t('privacy.s5DeletionTitle')}</h3>
                    <p className="text-xs sm:text-sm">{t('privacy.s5DeletionBody')}</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">{t('privacy.s5MarketingTitle')}</h3>
                    <p className="text-xs sm:text-sm">{t('privacy.s5MarketingBody')}</p>
                  </div>
                )
              },
              {
                title: t('privacy.s6Title'),
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">{t('privacy.s6Intro')}</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>{t('privacy.s6Li1')}</li>
                      <li>{t('privacy.s6Li2')}</li>
                      <li>{t('privacy.s6Li3')}</li>
                      <li>{t('privacy.s6Li4')}</li>
                    </ul>
                    <p className="text-xs sm:text-sm">{t('privacy.s6Outro')}</p>
                  </div>
                )
              },
              {
                title: t('privacy.s7Title'),
                content: (
                  <p className="text-xs sm:text-sm text-gray-700">{t('privacy.s7Body')}</p>
                )
              },
              {
                title: t('privacy.s8Title'),
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">{t('privacy.s8Intro')}</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>{t('privacy.s8Li1')}</li>
                      <li>{t('privacy.s2Li6')}</li>
                      <li>{t('privacy.s8Li3')}</li>
                      <li>{t('privacy.s8Li4')}</li>
                    </ul>
                    <p className="text-xs sm:text-sm">{t('privacy.s8Outro')}</p>
                  </div>
                )
              },
              {
                title: t('privacy.s9Title'),
                content: (
                  <p className="text-xs sm:text-sm text-gray-700">{t('privacy.s9Body')}</p>
                )
              },
              {
                title: t('privacy.s10Title'),
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">{t('privacy.s10Intro')}</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>{t('privacy.s10Li1')}</li>
                      <li>{t('privacy.s10Li2')}</li>
                      <li>{t('privacy.s10Li3')}</li>
                    </ul>
                    <p className="text-xs sm:text-sm">{t('privacy.s10Outro')}</p>
                  </div>
                )
              },
              {
                title: t('privacy.s11Title'),
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">{t('privacy.s11Intro')}</p>
                    <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mt-3">
                      <h3 className="font-medium text-gray-900 text-xs sm:text-sm mb-1 sm:mb-2">{t('common.email')}</h3>
                      <p className="text-gray-600 text-xs sm:text-sm">info.rentcottage@gmail.com</p>
                    </div>
                  </div>
                )
              },
            ].map(({ title, content }) => (
              <section key={title} className="mb-6 sm:mb-8">
                <h2 className="text-base sm:text-xl md:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">{title}</h2>
                {content}
              </section>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 mt-6 sm:mt-8">
              <div className="flex items-start">
                <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center mr-2 sm:mr-3 mt-0.5 flex-shrink-0">
                  <i className="ri-information-line text-blue-500 text-sm sm:text-base"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 text-xs sm:text-sm md:text-base mb-1 sm:mb-2">{t('privacy.matterTitle')}</h3>
                  <p className="text-blue-800 text-xs sm:text-sm">
                    {t('privacy.matterBody')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />
    </div>
  );
}
