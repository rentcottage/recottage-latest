import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';
import { useT } from '../../i18n';

type T = (key: string, vars?: Record<string, string | number>) => string;

function buildSections(t: T) {
  return [
    {
      id: 'introduction',
      number: '1',
      title: t('corporate.terms.s1Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('corporate.terms.s1P1Pre')} <strong>rentcottage.ge</strong>.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('corporate.terms.s1P2')}
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('corporate.terms.s1P3')}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {t('corporate.terms.s1P4')}
          </p>
        </>
      ),
    },
    {
      id: 'platform-description',
      number: '2',
      title: t('corporate.terms.s2Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('corporate.terms.s2P1')}
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li><strong>{t('corporate.terms.s2Guests')}</strong> {t('corporate.terms.s2GuestsDesc')}</li>
            <li><strong>{t('corporate.terms.s2Hosts')}</strong> {t('corporate.terms.s2HostsDesc')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            {t('corporate.terms.s2P2')}
          </p>
        </>
      ),
    },
    {
      id: 'user-accounts',
      number: '3',
      title: t('corporate.terms.s3Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">{t('corporate.terms.s3P1')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li>{t('corporate.terms.s3Li1')}</li>
            <li>{t('corporate.terms.s3Li2')}</li>
            <li>{t('corporate.terms.s3Li3')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            {t('corporate.terms.s3P2')}
          </p>
        </>
      ),
    },
    {
      id: 'booking-process',
      number: '4',
      title: t('corporate.terms.s4Title'),
      content: (
        <>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li>{t('corporate.terms.s4Li1')}</li>
            <li>{t('corporate.terms.s4Li2')}</li>
            <li>
              {t('corporate.terms.s4Li3Intro')}
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>{t('corporate.terms.s4Li3a')}</li>
                <li>{t('corporate.terms.s4Li3b')}</li>
              </ul>
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            {t('corporate.terms.s4P1')}
          </p>
        </>
      ),
    },
    {
      id: 'payments',
      number: '5',
      title: t('corporate.terms.s5Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">{t('corporate.terms.s5P1')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li><strong>{t('corporate.terms.s5PayAtProperty')}</strong> {t('corporate.terms.s5PayAtPropertyDesc')}</li>
            <li><strong>{t('corporate.terms.s5OnlinePayments')}</strong> {t('corporate.terms.s5OnlinePaymentsDesc')}</li>
          </ul>
          <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-4 mb-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">{t('corporate.terms.s5ImportantLabel')}</p>
            <ul className="list-disc pl-4 space-y-1 text-amber-800 text-sm">
              <li>{t('corporate.terms.s5ImpLi1')}</li>
              <li>{t('corporate.terms.s5ImpLi2')}</li>
            </ul>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {t('corporate.terms.s5P2')}
          </p>
        </>
      ),
    },
    {
      id: 'cancellation-policy',
      number: '6',
      title: t('corporate.terms.s6Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">{t('corporate.terms.s6P1')}</p>
          <div className="space-y-4 mb-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">{t('corporate.terms.s6FlexTitle')}</h4>
              <p className="text-gray-700 text-sm">{t('corporate.terms.s6FlexDesc')}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">{t('corporate.terms.s6ModTitle')}</h4>
              <p className="text-gray-700 text-sm">{t('corporate.terms.s6ModDesc')}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">{t('corporate.terms.s6StrictTitle')}</h4>
              <p className="text-gray-700 text-sm">{t('corporate.terms.s6StrictDesc')}</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">{t('corporate.terms.s6NoteLabel')}</p>
            <ul className="list-disc pl-4 space-y-1 text-gray-600 text-sm">
              <li>{t('corporate.terms.s6NoteLi1')}</li>
              <li>{t('corporate.terms.s6NoteLi2')}</li>
            </ul>
          </div>
        </>
      ),
    },
    {
      id: 'host-responsibilities',
      number: '7',
      title: t('corporate.terms.s7Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-3">{t('corporate.terms.s7MustIntro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-5">
            <li>{t('corporate.terms.s7MustLi1')}</li>
            <li>{t('corporate.terms.s7MustLi2')}</li>
            <li>{t('corporate.terms.s7MustLi3')}</li>
            <li>{t('corporate.terms.s7MustLi4')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-3">{t('corporate.terms.s7NotAllowedIntro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-5">
            <li>{t('corporate.terms.s7NotLi1')}</li>
            <li>{t('corporate.terms.s7NotLi2')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('corporate.terms.s7P1')}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {t('corporate.terms.s7P2')}
          </p>
        </>
      ),
    },
    {
      id: 'guest-responsibilities',
      number: '8',
      title: t('corporate.terms.s8Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-3">{t('corporate.terms.s8Intro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>{t('corporate.terms.s8Li1')}</li>
            <li>{t('corporate.terms.s8Li2')}</li>
            <li>{t('corporate.terms.s8Li3')}</li>
          </ul>
        </>
      ),
    },
    {
      id: 'prohibited-activities',
      number: '9',
      title: t('corporate.terms.s9Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-3">{t('corporate.terms.s9Intro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li>{t('corporate.terms.s9Li1')}</li>
            <li>{t('corporate.terms.s9Li2')}</li>
            <li>{t('corporate.terms.s9Li3')}</li>
            <li>{t('corporate.terms.s9Li4')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            {t('corporate.terms.s9P1')}
          </p>
        </>
      ),
    },
    {
      id: 'reviews',
      number: '10',
      title: t('corporate.terms.s10Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('corporate.terms.s10P1')}
          </p>
          <p className="text-gray-700 leading-relaxed mb-3">{t('corporate.terms.s10Intro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li>{t('corporate.terms.s10Li1')}</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-3">{t('corporate.terms.s10P2Intro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>{t('corporate.terms.s10Li2')}</li>
            <li>{t('corporate.terms.s10Li3')}</li>
            <li>{t('corporate.terms.s10Li4')}</li>
          </ul>
        </>
      ),
    },
    {
      id: 'platform-fees',
      number: '11',
      title: t('corporate.terms.s11Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('corporate.terms.s11P1')}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {t('corporate.terms.s11P2')}
          </p>
        </>
      ),
    },
    {
      id: 'limitation-of-liability',
      number: '12',
      title: t('corporate.terms.s12Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-3">{t('corporate.terms.s12Intro')}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>{t('corporate.terms.s12Li1')}</li>
            <li>{t('corporate.terms.s12Li2')}</li>
          </ul>
        </>
      ),
    },
    {
      id: 'availability',
      number: '13',
      title: t('corporate.terms.s13Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-3">
            {t('corporate.terms.s13Intro')}
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>{t('corporate.terms.s13Li1')}</li>
            <li>{t('corporate.terms.s13Li2')}</li>
          </ul>
        </>
      ),
    },
    {
      id: 'data-privacy',
      number: '14',
      title: t('corporate.terms.s14Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed">
            {t('corporate.terms.s14P1Pre')}{' '}
            <a href="/privacy" className="text-red-500 hover:text-red-600 underline cursor-pointer">{t('corporate.terms.s14PrivacyLink')}</a>.
          </p>
        </>
      ),
    },
    {
      id: 'changes-to-terms',
      number: '15',
      title: t('corporate.terms.s15Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('corporate.terms.s15P1')}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {t('corporate.terms.s15P2')}
          </p>
        </>
      ),
    },
    {
      id: 'contact',
      number: '16',
      title: t('corporate.terms.s16Title'),
      content: (
        <>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t('corporate.terms.s16P1')}
          </p>
          <div className="bg-gray-50 rounded-lg p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="ri-mail-line text-red-500 text-lg"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-0.5">{t('corporate.terms.s16EmailLabel')}</p>
              <a href="mailto:info@rentcottage.ge" className="text-gray-900 font-medium hover:text-red-500 transition-colors cursor-pointer">
                info@rentcottage.ge
              </a>
            </div>
          </div>
        </>
      ),
    },
  ];
}

export default function TermsPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const sections = buildSections(t);
  const [activeId, setActiveId] = useState(sections[0].id);
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms & Conditions — RentCottage.Ge',
    description: 'Read the Terms & Conditions for using RentCottage.Ge, the Georgian cottage rental platform. Learn about bookings, payments, cancellations, and user responsibilities.',
    url: `${siteUrl}/terms`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  // Scroll-spy: highlight the TOC entry for the section currently in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -70% 0px', threshold: 0 },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <SEO
        title="Terms & Conditions — RentCottage.Ge"
        description="Read the Terms & Conditions for using RentCottage.Ge, the Georgian cottage rental platform. Learn about bookings, payments, cancellations, and user responsibilities."
        canonical="/terms"
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero — white band, centered, with doc tabs */}
      <section className="bg-white border-b border-line py-11 px-5 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-[22px] md:text-[32px] font-extrabold tracking-tight text-ink">{t('corporate.legal.pageTitle')}</h1>
          <p className="text-soft text-sm mt-2">{t('corporate.legal.pageSub')}</p>
          <div className="inline-flex bg-[#fafafa] border-[1.5px] border-line rounded-full p-1.5 mt-5">
            <button
              className="text-sm font-bold px-5.5 py-2.5 rounded-full cursor-pointer bg-red-500 text-white whitespace-nowrap"
              aria-current="page"
            >
              {t('corporate.legal.tabTerms')}
            </button>
            <button
              onClick={() => navigate('/privacy')}
              className="text-sm font-bold px-5.5 py-2.5 rounded-full cursor-pointer transition-colors text-muted-foreground hover:text-ink whitespace-nowrap"
            >
              {t('corporate.legal.tabPrivacy')}
            </button>
          </div>
        </div>
      </section>

      {/* TOC + content */}
      <div className="max-w-5xl mx-auto px-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-9 py-9">
        {/* Table of contents */}
        <aside className="hidden md:block sticky top-[90px] h-fit bg-white border border-line rounded-card p-4.5">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-soft mb-2.5">{t('corporate.legal.contentsLabel')}</h3>
          <nav>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`block text-[13.5px] px-2.5 py-1.5 rounded-lg border-l-[2.5px] transition-colors ${
                  activeId === s.id
                    ? 'text-red-500 font-bold border-red-500 bg-red-50'
                    : 'text-muted-foreground border-transparent hover:text-red-500'
                }`}
              >
                {s.number}. {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content card */}
        <main className="bg-white border border-line rounded-card p-6 md:px-9 md:py-8">
          <p className="text-[12.5px] text-soft mb-5">{t('corporate.legal.lastUpdated', { date: updated })}</p>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-extrabold text-red-500 mb-1.5">{t('corporate.terms.inShortTitle')}</h3>
            <p className="text-[13.5px] text-muted-foreground m-0">
              {t('corporate.terms.inShortBody')}
            </p>
          </div>

          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-[90px] mb-7 last:mb-0 text-[14.5px] leading-relaxed">
              <h2 className="text-[19px] font-extrabold text-ink mb-3">{s.number}. {s.title}</h2>
              {s.content}
            </section>
          ))}
        </main>
      </div>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />
    </div>
  );
}
