import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';
import { useT } from '../../i18n';

interface Section {
  id: string;
  title: string;
  content: ReactNode;
}

type T = (key: string, vars?: Record<string, string | number>) => string;

function buildSections(t: T): Section[] {
  return [
    {
      id: 's1',
      title: t('corporate.privacy.s1Title'),
      content: (
        <div className="space-y-3 text-muted-foreground">
          <h3 className="text-[15px] font-bold text-ink">{t('corporate.privacy.s1PersonalTitle')}</h3>
          <p>{t('corporate.privacy.s1PersonalIntro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('corporate.privacy.s1PersonalLi1')}</li>
            <li>{t('corporate.privacy.s1PersonalLi2')}</li>
            <li>{t('corporate.privacy.s1PersonalLi3')}</li>
            <li>{t('corporate.privacy.s1PersonalLi4')}</li>
            <li>{t('corporate.privacy.s1PersonalLi5')}</li>
          </ul>
          <h3 className="text-[15px] font-bold text-ink mt-4">{t('corporate.privacy.s1UsageTitle')}</h3>
          <p>{t('corporate.privacy.s1UsageIntro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('corporate.privacy.s1UsageLi1')}</li>
            <li>{t('corporate.privacy.s1UsageLi2')}</li>
            <li>{t('corporate.privacy.s1UsageLi3')}</li>
            <li>{t('corporate.privacy.s1UsageLi4')}</li>
          </ul>
        </div>
      ),
    },
    {
      id: 's2',
      title: t('corporate.privacy.s2Title'),
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>{t('corporate.privacy.s2Intro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('corporate.privacy.s2Li1')}</li>
            <li>{t('corporate.privacy.s2Li2')}</li>
            <li>{t('corporate.privacy.s2Li3')}</li>
            <li>{t('corporate.privacy.s2Li4')}</li>
            <li>{t('corporate.privacy.s2Li5')}</li>
            <li>{t('corporate.privacy.s2Li6')}</li>
            <li>{t('corporate.privacy.s2Li7')}</li>
          </ul>
        </div>
      ),
    },
    {
      id: 's3',
      title: t('corporate.privacy.s3Title'),
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>{t('corporate.privacy.s3Intro')}</p>
          <h3 className="text-[15px] font-bold text-ink">{t('corporate.privacy.s3HostsGuestsTitle')}</h3>
          <p>{t('corporate.privacy.s3HostsGuestsBody')}</p>
          <h3 className="text-[15px] font-bold text-ink">{t('corporate.privacy.s3ProvidersTitle')}</h3>
          <p>{t('corporate.privacy.s3ProvidersIntro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('corporate.privacy.s3ProvidersLi1')}</li>
            <li>{t('corporate.privacy.s3ProvidersLi2')}</li>
            <li>{t('corporate.privacy.s3ProvidersLi3')}</li>
            <li>{t('corporate.privacy.s3ProvidersLi4')}</li>
          </ul>
          <h3 className="text-[15px] font-bold text-ink">{t('corporate.privacy.s3LegalTitle')}</h3>
          <p>{t('corporate.privacy.s3LegalBody')}</p>
        </div>
      ),
    },
    {
      id: 's4',
      title: t('corporate.privacy.s4Title'),
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>{t('corporate.privacy.s4Intro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('corporate.privacy.s4Li1')}</li>
            <li>{t('corporate.privacy.s4Li2')}</li>
            <li>{t('corporate.privacy.s4Li3')}</li>
            <li>{t('corporate.privacy.s4Li4')}</li>
          </ul>
          <p>{t('corporate.privacy.s4P2')}</p>
        </div>
      ),
    },
    {
      id: 's5',
      title: t('corporate.privacy.s5Title'),
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>{t('corporate.privacy.s5Intro')}</p>
          <h3 className="text-[15px] font-bold text-ink">{t('corporate.privacy.s5AccessTitle')}</h3>
          <p>{t('corporate.privacy.s5AccessBody')}</p>
          <h3 className="text-[15px] font-bold text-ink">{t('corporate.privacy.s5PortabilityTitle')}</h3>
          <p>{t('corporate.privacy.s5PortabilityBody')}</p>
          <h3 className="text-[15px] font-bold text-ink">{t('corporate.privacy.s5DeletionTitle')}</h3>
          <p>{t('corporate.privacy.s5DeletionBody')}</p>
          <h3 className="text-[15px] font-bold text-ink">{t('corporate.privacy.s5MarketingTitle')}</h3>
          <p>{t('corporate.privacy.s5MarketingBody')}</p>
        </div>
      ),
    },
    {
      id: 's6',
      title: t('corporate.privacy.s6Title'),
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>{t('corporate.privacy.s6Intro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('corporate.privacy.s6Li1')}</li>
            <li>{t('corporate.privacy.s6Li2')}</li>
            <li>{t('corporate.privacy.s6Li3')}</li>
            <li>{t('corporate.privacy.s6Li4')}</li>
          </ul>
          <p>{t('corporate.privacy.s6P2')}</p>
        </div>
      ),
    },
    {
      id: 's7',
      title: t('corporate.privacy.s7Title'),
      content: (
        <p className="text-muted-foreground">{t('corporate.privacy.s7Body')}</p>
      ),
    },
    {
      id: 's8',
      title: t('corporate.privacy.s8Title'),
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>{t('corporate.privacy.s8Intro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('corporate.privacy.s8Li1')}</li>
            <li>{t('corporate.privacy.s8Li2')}</li>
            <li>{t('corporate.privacy.s8Li3')}</li>
            <li>{t('corporate.privacy.s8Li4')}</li>
          </ul>
          <p>{t('corporate.privacy.s8P2')}</p>
        </div>
      ),
    },
    {
      id: 's9',
      title: t('corporate.privacy.s9Title'),
      content: (
        <p className="text-muted-foreground">{t('corporate.privacy.s9Body')}</p>
      ),
    },
    {
      id: 's10',
      title: t('corporate.privacy.s10Title'),
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>{t('corporate.privacy.s10Intro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('corporate.privacy.s10Li1')}</li>
            <li>{t('corporate.privacy.s10Li2')}</li>
            <li>{t('corporate.privacy.s10Li3')}</li>
          </ul>
          <p>{t('corporate.privacy.s10P2')}</p>
        </div>
      ),
    },
    {
      id: 's11',
      title: t('corporate.privacy.s11Title'),
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>{t('corporate.privacy.s11Intro')}</p>
          <div className="bg-[#fafafa] border border-line rounded-xl p-4 mt-1">
            <h3 className="font-bold text-ink text-sm mb-1">{t('corporate.privacy.s11EmailLabel')}</h3>
            <p>info.rentcottage@gmail.com</p>
          </div>
        </div>
      ),
    },
  ];
}

export default function Privacy() {
  const { t } = useT();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState('s1');
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Privacy Policy — RentCottage.Ge',
    description: 'Learn how RentCottage.Ge collects, uses and protects your personal information when you use our Georgian cottage rental platform.',
    url: `${siteUrl}/privacy`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  const sections = buildSections(t);

  // Scroll-spy: highlight the TOC entry for the section currently in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
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
        title="Privacy Policy — RentCottage.Ge"
        description="Learn how RentCottage.Ge collects, uses and protects your personal information when you use our Georgian cottage rental platform."
        canonical="/privacy"
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
              onClick={() => navigate('/terms')}
              className="text-sm font-bold px-5.5 py-2.5 rounded-full cursor-pointer transition-colors text-muted-foreground hover:text-ink whitespace-nowrap"
            >
              {t('corporate.legal.tabTerms')}
            </button>
            <button
              className="text-sm font-bold px-5.5 py-2.5 rounded-full cursor-pointer bg-red-500 text-white whitespace-nowrap"
              aria-current="page"
            >
              {t('corporate.legal.tabPrivacy')}
            </button>
          </div>
        </div>
      </section>

      {/* TOC + content */}
      <div className="max-w-5xl mx-auto px-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-9 py-9 md:py-9">
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
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content card */}
        <main className="bg-white border border-line rounded-card p-6 md:px-9 md:py-8">
          <p className="text-[12.5px] text-soft mb-5">{t('corporate.legal.lastUpdated', { date: updated })}</p>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-extrabold text-red-500 mb-1.5">{t('corporate.privacy.inShortTitle')}</h3>
            <p className="text-[13.5px] text-muted-foreground m-0">
              {t('corporate.privacy.inShortBody')}
            </p>
          </div>

          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-[90px] mb-7 last:mb-0 text-[14.5px] leading-relaxed">
              <h2 className="text-[19px] font-extrabold text-ink mb-3">{s.title}</h2>
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
