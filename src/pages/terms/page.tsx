import { useTranslation } from '@lib/i18n';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';

export default function TermsPage() {
  const { t, lang } = useTranslation();
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const sections = [
    {
      id: 'introduction',
      number: '1',
      title: t('terms.s1Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('terms.s1P1')}
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('terms.s1P2')}
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('terms.s1P3')}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.s1P4')}
          </p>
        </>
      ),
    },
    {
      id: 'platform-description',
      number: '2',
      title: t('terms.s2Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('terms.s2P1')}
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li><strong>{t('terms.s2GuestsTerm')}</strong> {t('terms.s2GuestsDef')}</li>
            <li><strong>{t('terms.s2HostsTerm')}</strong> {t('terms.s2HostsDef')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.s2P2')}
          </p>
        </>
      ),
    },
    {
      id: 'user-accounts',
      number: '3',
      title: t('terms.s3Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">{t('terms.s3Intro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li>{t('terms.s3Li1')}</li>
            <li>{t('terms.s3Li2')}</li>
            <li>{t('terms.s3Li3')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.s3P2')}
          </p>
        </>
      ),
    },
    {
      id: 'booking-process',
      number: '4',
      title: t('terms.s4Title'),
      content: (
        <>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li>{t('terms.s4Li1')}</li>
            <li>{t('terms.s4Li2')}</li>
            <li>
              {t('terms.s4Li3')}
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>{t('terms.s4Li3a')}</li>
                <li>{t('terms.s4Li3b')}</li>
              </ul>
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.s4P1')}
          </p>
        </>
      ),
    },
    {
      id: 'payments',
      number: '5',
      title: t('terms.s5Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">{t('terms.s5P1')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li><strong>{t('terms.s5PayAtPropertyTerm')}</strong> {t('terms.s5PayAtPropertyDef')}</li>
            <li><strong>{t('terms.s5OnlineTerm')}</strong> {t('terms.s5OnlineDef')}</li>
          </ul>
          <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-4 mb-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">{t('terms.s5ImportantLabel')}</p>
            <ul className="list-disc pl-4 space-y-1 text-amber-800 text-sm">
              <li>{t('terms.s5ImportantLi1')}</li>
              <li>{t('terms.s5ImportantLi2')}</li>
            </ul>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.s5P2')}
          </p>
        </>
      ),
    },
    {
      id: 'cancellation-policy',
      number: '6',
      title: t('terms.s6Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">{t('terms.s6P1')}</p>
          <div className="space-y-4 mb-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">{t('terms.s6FlexibleTitle')}</h4>
              <p className="text-gray-700 text-sm">{t('terms.s6FlexibleDesc')}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">{t('terms.s6ModerateTitle')}</h4>
              <p className="text-gray-700 text-sm">{t('terms.s6ModerateDesc')}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">{t('terms.s6StrictTitle')}</h4>
              <p className="text-gray-700 text-sm">{t('terms.s6StrictDesc')}</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">{t('terms.s6NoteLabel')}</p>
            <ul className="list-disc pl-4 space-y-1 text-gray-600 text-sm">
              <li>{t('terms.s6NoteLi1')}</li>
              <li>{t('terms.s6NoteLi2')}</li>
            </ul>
          </div>
        </>
      ),
    },
    {
      id: 'host-responsibilities',
      number: '7',
      title: t('terms.s7Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-3">{t('terms.s7MustIntro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-5">
            <li>{t('terms.s7MustLi1')}</li>
            <li>{t('terms.s7MustLi2')}</li>
            <li>{t('terms.s7MustLi3')}</li>
            <li>{t('terms.s7MustLi4')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-3">{t('terms.s7NotAllowedIntro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-5">
            <li>{t('terms.s7NotLi1')}</li>
            <li>{t('terms.s7NotLi2')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('terms.s7P1')}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.s7P2')}
          </p>
        </>
      ),
    },
    {
      id: 'guest-responsibilities',
      number: '8',
      title: t('terms.s8Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-3">{t('terms.s8Intro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>{t('terms.s8Li1')}</li>
            <li>{t('terms.s8Li2')}</li>
            <li>{t('terms.s8Li3')}</li>
          </ul>
        </>
      ),
    },
    {
      id: 'prohibited-activities',
      number: '9',
      title: t('terms.s9Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-3">{t('terms.s9Intro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li>{t('terms.s9Li1')}</li>
            <li>{t('terms.s9Li2')}</li>
            <li>{t('terms.s9Li3')}</li>
            <li>{t('terms.s9Li4')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.s9P1')}
          </p>
        </>
      ),
    },
    {
      id: 'reviews',
      number: '10',
      title: t('terms.s10Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('terms.s10P1')}
          </p>
          <p className="text-gray-700 leading-relaxed mb-3">{t('terms.s10MustIntro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li>{t('terms.s10MustLi1')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-3">{t('terms.s10RemoveIntro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>{t('terms.s10RemoveLi1')}</li>
            <li>{t('terms.s10RemoveLi2')}</li>
            <li>{t('terms.s10RemoveLi3')}</li>
          </ul>
        </>
      ),
    },
    {
      id: 'platform-fees',
      number: '11',
      title: t('terms.s11Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('terms.s11P1')}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.s11P2')}
          </p>
        </>
      ),
    },
    {
      id: 'limitation-of-liability',
      number: '12',
      title: t('terms.s12Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-3">{t('terms.s12Intro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>{t('terms.s12Li1')}</li>
            <li>{t('terms.s12Li2')}</li>
          </ul>
        </>
      ),
    },
    {
      id: 'availability',
      number: '13',
      title: t('terms.s13Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-3">
            {t('terms.s13Intro')}
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>{t('terms.s13Li1')}</li>
            <li>{t('terms.s13Li2')}</li>
          </ul>
        </>
      ),
    },
    {
      id: 'data-privacy',
      number: '14',
      title: t('terms.s14Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.s14P1')}{' '}
            <a href="/privacy" className="text-red-500 hover:text-red-600 underline cursor-pointer">{t('privacy.title')}</a>.
          </p>
        </>
      ),
    },
    {
      id: 'changes-to-terms',
      number: '15',
      title: t('terms.s15Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('terms.s15P1')}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.s15P2')}
          </p>
        </>
      ),
    },
    {
      id: 'contact',
      number: '16',
      title: t('terms.s16Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('terms.s16P1')}
          </p>
          <div className="bg-gray-50 rounded-lg p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="ri-mail-line text-red-500 text-lg"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-0.5">{t('common.email')}</p>
              <a href="mailto:info@rentcottage.ge" className="text-gray-900 font-medium hover:text-red-500 transition-colors cursor-pointer">
                info@rentcottage.ge
              </a>
            </div>
          </div>
        </>
      ),
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms & Conditions — RentCottage.Ge',
    description: 'Read the Terms & Conditions for using RentCottage.Ge, the Georgian cottage rental platform. Learn about bookings, payments, cancellations, and user responsibilities.',
    url: `${siteUrl}/terms`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={t('terms.seo.title')}
        description="Read the Terms & Conditions for using RentCottage.Ge, the Georgian cottage rental platform. Learn about bookings, payments, cancellations, and user responsibilities."
        canonical="/terms"
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero bar */}
      <div className="relative w-full h-[180px] sm:h-[240px] md:h-[320px] overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=cozy%20traditional%20Georgian%20stone%20mountain%20cabin%20cottage%20wooden%20balcony%20Svaneti%20style%20surrounded%20by%20pine%20forest%20autumn%20foliage%20warm%20golden%20light%20no%20people%20rustic%20premium%20natural%20landscape%20peaceful%20alpine%20setting%20soft%20warm%20tones&width=1600&height=460&seq=terms-hero-01&orientation=landscape"
          alt={t('terms.heroAlt')}
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex flex-col justify-end px-4 pb-5 sm:pb-8 md:pb-12">
          <div className="max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-white/70 mb-2 sm:mb-3">
              <a href="/" className="hover:text-white transition-colors cursor-pointer">{t('common.home')}</a>
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-s-line text-white/50"></i>
              </div>
              <span className="text-white/90">{t('footer.terms')}</span>
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">{t('footer.terms')}</h1>
            <p className="text-white/70 text-xs sm:text-sm">
              {t('common.lastUpdated', { date: new Date().toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' }) })}
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 md:py-16">
        <div className="flex flex-col lg:flex-row gap-8 sm:gap-10">

          {/* Table of Contents — sticky sidebar on desktop */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{t('terms.contents')}</p>
              <nav className="space-y-1.5">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors cursor-pointer group"
                  >
                    <span className="text-xs font-mono text-gray-300 group-hover:text-red-300 w-5 flex-shrink-0">{s.number}.</span>
                    <span className="leading-snug">{s.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Sections */}
          <div className="flex-1 min-w-0">
            <div className="space-y-6 sm:space-y-8 md:space-y-12">
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <div className="flex items-baseline gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <span className="text-xs font-mono font-bold text-red-400 bg-red-50 px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0">
                      {s.number}
                    </span>
                    <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">{s.title}</h2>
                  </div>
                  <div className="pl-0 md:pl-9 text-xs sm:text-sm">
                    {s.content}
                  </div>
                  <div className="mt-6 sm:mt-8 md:mt-12 border-t border-gray-100" />
                </section>
              ))}
            </div>

            {/* Footer note */}
            <div className="mt-6 sm:mt-10 bg-gray-50 rounded-xl p-4 sm:p-6 flex items-start gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-shield-check-line text-red-500 text-sm sm:text-base"></i>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base mb-1">{t('terms.questionsTitle')}</h3>
                <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3">
                  {t('terms.questionsDesc')}
                </p>
                <a
                  href="mailto:info@rentcottage.ge"
                  className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-mail-line text-xs sm:text-sm"></i>
                  </div>
                  info@rentcottage.ge
                </a>
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
