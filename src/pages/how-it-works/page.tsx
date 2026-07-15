import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';
import { useApprovedCount } from '../../hooks/useApprovedCount';

interface Step {
  num: number;
  title: string;
  description: string;
  bullets: string[];
}

const GUEST_STEPS: Step[] = [
  {
    num: 1,
    title: 'Search',
    description: 'Pick a place, dates and guests',
    bullets: ['{count} verified cottages', 'Filters: jacuzzi, fireplace, pool', 'Real photos and reviews'],
  },
  {
    num: 2,
    title: 'Connect with the host',
    description: 'Ask your questions directly',
    bullets: ['Response in ~1 hour on average', 'Local tips from the host', 'Or book instantly ⚡'],
  },
  {
    num: 3,
    title: 'Book securely',
    description: 'Pay online or on arrival',
    bullets: ['Secure online payment', 'Instant SMS confirmation', 'Free cancellation up to 48h'],
  },
  {
    num: 4,
    title: 'Relax',
    description: 'Enjoy Georgian hospitality',
    bullets: ['Easy check-in with instructions', 'Support throughout your visit', 'Leave a review for others'],
  },
];

const HOST_STEPS: Step[] = [
  {
    num: 1,
    title: 'List your cottage',
    description: 'Create a listing that shows its charm',
    bullets: ['Upload high-quality photos', 'Write an engaging description', 'Set competitive pricing'],
  },
  {
    num: 2,
    title: 'Get verified',
    description: 'Our team reviews and approves your listing',
    bullets: ['Identity verification', 'Property quality check', 'Approved and live on the platform'],
  },
  {
    num: 3,
    title: 'Welcome guests',
    description: 'Start receiving bookings',
    bullets: ['Respond to inquiries quickly', 'Share local recommendations', 'Keep your cottage to high standards'],
  },
  {
    num: 4,
    title: 'Earn & grow',
    description: 'Build your reputation and income',
    bullets: ['Secure payouts through the platform', 'Collect guest reviews', 'Commission only on successful bookings'],
  },
];

const GUARANTEES = [
  { icon: '🛡️', title: 'Verified cottages', desc: 'Every cottage is personally checked by our team for quality and safety' },
  { icon: '💬', title: 'Local support', desc: 'A Georgian team that knows every corner — we help in Georgian, every day' },
  { icon: '💰', title: 'Best price guarantee', desc: 'Found the same cottage cheaper elsewhere? We\u2019ll match the price' },
];

const FAQS = [
  {
    q: 'When do I pay for the booking?',
    a: 'It\u2019s your choice: pay online by card, or choose \u201cpay on arrival\u201d and pay at check-in by cash or card. Placing a booking is free.',
  },
  {
    q: 'Can I cancel my booking?',
    a: 'Yes — most cottages offer free cancellation up to 48 hours before check-in. The cancellation terms are always shown on the booking page.',
  },
  {
    q: 'How do I know the cottage matches the photos?',
    a: 'Cottages marked \u201cVerified\u201d are checked by our team. On top of that, real guest reviews help you choose with confidence.',
  },
  {
    q: 'Do I need an account to book?',
    a: 'Booking requires a simple registration — just your name and phone number, so you can receive the confirmation by SMS.',
  },
  {
    q: 'How do I add my cottage?',
    a: 'Click \u201cBecome a Host\u201d and upload photos and a description — listing is free. You pay a commission only on successful bookings.',
  },
];

export default function HowItWorks() {
  const { count } = useApprovedCount();
  const [activeTab, setActiveTab] = useState<'guests' | 'hosts'>('guests');
  const navigate = useNavigate();

  const steps = activeTab === 'guests' ? GUEST_STEPS : HOST_STEPS;

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
            How RentCottage.Ge works
          </h1>
          <p className="text-soft text-[15px] md:text-base max-w-xl mx-auto mt-3 mb-7">
            See how easy it is to find the perfect cottage — or to earn from yours
          </p>
          <div className="inline-flex bg-[#fafafa] border-[1.5px] border-line rounded-full p-1.5 relative z-[2] -mb-6">
            <button
              onClick={() => setActiveTab('guests')}
              className={`text-[14.5px] font-bold px-6 py-2.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'guests' ? 'bg-red-500 text-white' : 'text-soft hover:text-ink'
              }`}
            >
              🧳 For guests
            </button>
            <button
              onClick={() => setActiveTab('hosts')}
              className={`text-[14.5px] font-bold px-6 py-2.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'hosts' ? 'bg-red-500 text-white' : 'text-soft hover:text-ink'
              }`}
            >
              🏡 For hosts
            </button>
          </div>
        </div>
      </section>

      {/* Steps timeline */}
      <section className="py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center text-ink">
            {activeTab === 'guests' ? 'From search to relaxation — 4 steps' : 'From listing to earning — 4 steps'}
          </h2>
          <p className="text-center text-soft max-w-lg mx-auto mt-2 mb-10">
            {activeTab === 'guests'
              ? 'Booking is simple and secure — we\u2019re with you at every step'
              : 'Getting started is simple — and you only pay when you get booked'}
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
                      {b.replace('{count} ', count !== null ? `${count} ` : '')}
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
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-center">Why RentCottage.Ge?</h2>
          <p className="text-center text-gray-300 max-w-lg mx-auto mt-2 mb-10">{'Guarantees you won\u2019t find elsewhere'}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {GUARANTEES.map((g) => (
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
            Frequently asked questions
          </h2>
          <p className="text-center text-soft max-w-lg mx-auto mt-2 mb-10">
            {'Didn\u2019t find your answer? Message us in chat or on WhatsApp'}
          </p>
          <div className="max-w-2xl mx-auto">
            {FAQS.map((f, i) => (
              <details
                key={i}
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
          <h2 className="text-[20px] md:text-[28px] font-extrabold tracking-tight text-ink">Ready to relax?</h2>
          <p className="text-soft max-w-md mx-auto mt-2.5 mb-6">
            Find your perfect cottage now{count !== null ? ` — ${count} options` : ''} across Georgia
          </p>
          <button
            onClick={() => navigate(activeTab === 'guests' ? '/search' : '/become-host')}
            className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl px-6 py-3.5 text-[15.5px] cursor-pointer transition-colors whitespace-nowrap"
          >
            {activeTab === 'guests' ? '🔍 Start searching' : '🏡 Become a host'}
          </button>
        </div>
      </section>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />
    </div>
  );
}
