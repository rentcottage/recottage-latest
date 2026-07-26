import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';
import { useApprovedCount } from '../../hooks/useApprovedCount';
import { useT } from '../../i18n';

interface Step {
  num: number;
  title: string;
  description: string;
  bullets: string[];
}

const GUARANTEE_ICONS = ['🛡️', '💬', '💰'];

export default function HowItWorks() {
  const { count } = useApprovedCount();
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<'guests' | 'hosts'>('guests');
  const navigate = useNavigate();

  const guestSteps: Step[] = [
    {
      num: 1,
      title: t('howItWorks.g1Title'),
      description: t('howItWorks.g1Desc'),
      bullets: [
        t('howItWorks.g1b1', { count: count !== null ? `${count} ` : '' }),
        t('howItWorks.g1b2'),
        t('howItWorks.g1b3'),
      ],
    },
    {
      num: 2,
      title: t('howItWorks.g2Title'),
      description: t('howItWorks.g2Desc'),
      bullets: [t('howItWorks.g2b1'), t('howItWorks.g2b2'), t('howItWorks.g2b3')],
    },
    {
      num: 3,
      title: t('howItWorks.g3Title'),
      description: t('howItWorks.g3Desc'),
      bullets: [t('howItWorks.g3b1'), t('howItWorks.g3b2'), t('howItWorks.g3b3')],
    },
    {
      num: 4,
      title: t('howItWorks.g4Title'),
      description: t('howItWorks.g4Desc'),
      bullets: [t('howItWorks.g4b1'), t('howItWorks.g4b2'), t('howItWorks.g4b3')],
    },
  ];

  const hostSteps: Step[] = [
    {
      num: 1,
      title: t('howItWorks.h1Title'),
      description: t('howItWorks.h1Desc'),
      bullets: [t('howItWorks.h1b1'), t('howItWorks.h1b2'), t('howItWorks.h1b3')],
    },
    {
      num: 2,
      title: t('howItWorks.h2Title'),
      description: t('howItWorks.h2Desc'),
      bullets: [t('howItWorks.h2b1'), t('howItWorks.h2b2'), t('howItWorks.h2b3')],
    },
    {
      num: 3,
      title: t('howItWorks.h3Title'),
      description: t('howItWorks.h3Desc'),
      bullets: [t('howItWorks.h3b1'), t('howItWorks.h3b2'), t('howItWorks.h3b3')],
    },
    {
      num: 4,
      title: t('howItWorks.h4Title'),
      description: t('howItWorks.h4Desc'),
      bullets: [t('howItWorks.h4b1'), t('howItWorks.h4b2'), t('howItWorks.h4b3')],
    },
  ];

  const guarantees = [1, 2, 3].map((n, i) => ({
    icon: GUARANTEE_ICONS[i],
    title: t(`howItWorks.guar${n}Title`),
    desc: t(`howItWorks.guar${n}Desc`),
  }));

  const faqs = [1, 2, 3, 4, 5].map((n) => ({
    q: t(`howItWorks.faq${n}Q`),
    a: t(`howItWorks.faq${n}A`),
  }));

  const steps = activeTab === 'guests' ? guestSteps : hostSteps;

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'How RentCottage.Ge Works — Book Georgian Cottages Easily',
      description: 'Learn how to search, book and stay in authentic Georgian cottages. Simple steps for guests and hosts. Safe payments, verified properties and local support.',
      url: `${siteUrl}/how-it-works`,
      isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to Book a Georgian Cottage on RentCottage.Ge',
      description: 'Step-by-step guide to finding and booking your perfect Georgian cottage rental.',
      step: [
        { '@type': 'HowToStep', name: 'Search & Discover', text: 'Enter your destination, dates and number of guests to find available cottages.' },
        { '@type': 'HowToStep', name: 'Connect with Hosts', text: 'Send booking requests and communicate directly with verified Georgian hosts.' },
        { '@type': 'HowToStep', name: 'Secure Booking', text: 'Complete your reservation with our secure payment system and receive instant confirmation.' },
        { '@type': 'HowToStep', name: 'Enjoy Your Stay', text: 'Arrive at your cottage and experience authentic Georgian hospitality.' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="How RentCottage.Ge Works — Book Georgian Cottages Easily"
        description="Learn how to search, book and stay in authentic Georgian cottages. Simple 4-step process for guests and hosts. Safe payments, verified properties and local Georgian support."
        keywords="how to book Georgian cottage, Georgia cottage rental guide, rent cottage Georgia steps, Georgian vacation rental process"
        canonical="/how-it-works"
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero — white, centered, with the guests/hosts pill toggle overlapping the next section */}
      <section className="bg-white border-b border-line pt-14 pb-0">
        <div className="max-w-5xl mx-auto px-5 text-center">
          <h1 className="text-[26px] md:text-[38px] font-extrabold tracking-tight text-ink">
            {t('howItWorks.heroTitle')}
          </h1>
          <p className="text-soft text-[15px] md:text-base max-w-xl mx-auto mt-3 mb-7">
            {t('howItWorks.heroSub')}
          </p>
          <div className="inline-flex bg-[#fafafa] border-[1.5px] border-line rounded-full p-1.5 relative z-[2] -mb-6">
            <button
              onClick={() => setActiveTab('guests')}
              className={`text-[14.5px] font-bold px-6 py-2.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'guests' ? 'bg-red-500 text-white' : 'text-soft hover:text-ink'
              }`}
            >
              {t('howItWorks.tabGuests')}
            </button>
            <button
              onClick={() => setActiveTab('hosts')}
              className={`text-[14.5px] font-bold px-6 py-2.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'hosts' ? 'bg-red-500 text-white' : 'text-soft hover:text-ink'
              }`}
            >
              {t('howItWorks.tabHosts')}
            </button>
          </div>
        </div>
      </section>

      {/* Steps timeline */}
      <section className="py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center text-ink">
            {activeTab === 'guests' ? t('howItWorks.guestsStepsTitle') : t('howItWorks.hostsStepsTitle')}
          </h2>
          <p className="text-center text-soft max-w-lg mx-auto mt-2 mb-10">
            {activeTab === 'guests' ? t('howItWorks.guestsStepsSub') : t('howItWorks.hostsStepsSub')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step) => (
              <div key={step.num} className="bg-white border border-line rounded-card p-6">
                <div className="w-10 h-10 rounded-full bg-red-500 text-white font-extrabold text-[17px] flex items-center justify-center mb-3.5">
                  {step.num}
                </div>
                <h3 className="text-[16.5px] font-bold text-ink mb-2">{step.title}</h3>
                <p className="text-sm text-soft">{step.description}</p>
                <ul className="mt-2 space-y-1.5">
                  {step.bullets.map((b, i) => (
                    <li key={i} className="relative pl-5 text-[13.5px] text-muted-foreground">
                      <span className="absolute left-0 text-red-500 font-extrabold" aria-hidden="true">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guarantees — dark band */}
      <section className="bg-[#222222] text-white py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center">{t('howItWorks.guaranteesTitle')}</h2>
          <p className="text-center text-gray-300 max-w-lg mx-auto mt-2 mb-10">{t('howItWorks.guaranteesSub')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {guarantees.map((g) => (
              <div key={g.title} className="bg-white/[0.06] border border-white/[0.14] rounded-card p-6 text-center">
                <div className="text-[32px] leading-none" aria-hidden="true">{g.icon}</div>
                <h3 className="text-[17px] font-bold mt-3 mb-2">{g.title}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center text-ink">
            {t('howItWorks.faqTitle')}
          </h2>
          <p className="text-center text-soft max-w-lg mx-auto mt-2 mb-10">
            {t('howItWorks.faqSub')}
          </p>
          <div className="max-w-2xl mx-auto">
            {faqs.map((f, i) => (
              <details
                key={f.q}
                open={i === 0}
                className="group bg-white border border-line rounded-xl px-5 py-4 mb-3 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-[15px] font-bold text-ink">
                  {f.q}
                  <span className="text-red-500 text-xl font-extrabold shrink-0 group-open:hidden" aria-hidden="true">+</span>
                  <span className="text-red-500 text-xl font-extrabold shrink-0 hidden group-open:inline" aria-hidden="true">–</span>
                </summary>
                <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white border-t border-line py-16 px-5 text-center">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-ink">{t('howItWorks.ctaTitle')}</h2>
          <p className="text-soft max-w-md mx-auto mt-2.5 mb-6">
            {t('howItWorks.ctaSub', { count: count !== null ? ` — ${count} options` : '' })}
          </p>
          <button
            onClick={() => navigate(activeTab === 'guests' ? '/search' : '/become-host')}
            className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl px-6 py-3.5 text-[15.5px] cursor-pointer transition-colors whitespace-nowrap"
          >
            {activeTab === 'guests' ? t('howItWorks.ctaGuests') : t('howItWorks.ctaHosts')}
          </button>
        </div>
      </section>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />
    </div>
  );
}
