import { useState } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ContactModal from '../../components/feature/ContactModal';
import CancellationModal from '../../components/feature/CancellationModal';
import SEO from '../../components/feature/SEO';

const PHOTO_TIPS = [
  { num: 1, title: 'Natural lighting', desc: 'Shoot at “golden hour” or in daylight. Avoid the flash' },
  { num: 2, title: 'Wide angles', desc: 'Use wide-angle shots — rooms look bigger and more inviting' },
  { num: 3, title: 'Clean & tidy', desc: 'Tidy the space before shooting — the first impression is made in the photo' },
  { num: 4, title: 'Tell a story', desc: 'What makes your cottage special? The view? A river? Grandpa\u2019s vineyard?' },
  { num: 5, title: 'Seasonal pricing', desc: 'Raise prices in peak season (winter in Gudauri, harvest in Kakheti), lower them off-season' },
  { num: 6, title: 'Be honest', desc: 'Accurate description = happy guest = 5 stars. Overselling leads to bad reviews' },
];

const RESPONSE_TIMES = [
  { title: 'Booking questions', desc: 'Initial inquiries', time: 'Within 1 hour' },
  { title: 'Booking requests', desc: 'Accept or decline', time: 'Within 24 hours' },
  { title: 'Ongoing messages', desc: 'Regular communication', time: 'Within 4 hours' },
];

const TEMPLATES = [
  {
    title: 'Welcome',
    text: 'Welcome! I\u2019m glad you chose [cottage name]. Here\u2019s everything you\u2019ll need for check-in…',
  },
  {
    title: 'Check-in instructions',
    text: 'Check-in is from 3:00 PM. The key is in the lockbox by the door, code: [code]. Address and map: [link]…',
  },
  {
    title: 'Local recommendations',
    text: 'The best khinkali is at [restaurant name], 10 minutes away. For an evening stroll I\u2019d suggest [place]…',
  },
];

const PROPERTY_SAFETY = [
  'Install smoke and CO detectors',
  'Keep a fire extinguisher and first-aid kit',
  'Check the electrical wiring',
  'Make sure doors and windows are secure',
];

const GUEST_VERIFICATION = [
  'Review the guest profile and past reviews',
  'Get in touch before check-in',
  'Trust your instincts',
  'Keep the communication history on the platform',
];

export default function HostResources() {
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const copyTemplate = (index: number, text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(index);
        setTimeout(() => setCopied((c) => (c === index ? null : c)), 1500);
      },
      () => {},
    );
  };

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Host Resources — Tips & Guides for Georgian Cottage Hosts',
    description: 'Everything Georgian cottage hosts need: listing tips, photography guides, guest communication templates, pricing strategies and safety guidelines.',
    url: `${siteUrl}/host-resources`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <SEO
        title="Host Resources — Tips & Guides for Georgian Cottage Hosts | RentCottage.Ge"
        description="Everything Georgian cottage hosts need to succeed: listing tips, photography best practices, guest communication templates, pricing strategies and safety guidelines."
        keywords="Georgian cottage host tips, host resources Georgia, listing cottage guide, hosting guide Georgia, cottage host photography tips"
        canonical="/host-resources"
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero — white, centered, with quick-nav pills */}
      <section className="bg-white border-b border-line py-13 md:py-14 px-5 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-[24px] md:text-[36px] font-extrabold tracking-tight text-ink">Host guide</h1>
          <p className="text-muted-foreground max-w-lg mx-auto mt-3 text-[15.5px]">
            Everything you need for successful hosting — from photos to pricing
          </p>
          <div className="flex justify-center gap-2.5 mt-6 flex-wrap">
            {[
              { id: 'start', label: '🚀 Getting started' },
              { id: 'listing', label: '📸 Improve your listing' },
              { id: 'comm', label: '💬 Communication' },
              { id: 'safety', label: '🛡 Safety' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => scrollToSection(p.id)}
                className="border-[1.5px] border-line bg-[#fafafa] rounded-full px-4.5 py-2 text-[13.5px] font-bold text-muted-foreground hover:border-red-500 hover:text-red-500 transition-colors cursor-pointer whitespace-nowrap"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Getting started */}
      <section id="start" className="py-13 md:py-14 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight text-ink">🚀 How to start</h2>
          <p className="text-muted-foreground mb-6 text-[14.5px]">In two steps — create a listing and get verified</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[22px]">
            <div className="bg-white border border-line rounded-card p-6">
              <h3 className="text-[16.5px] font-bold text-ink mb-3">Create a listing</h3>
              <ul className="space-y-2.5">
                {['Upload quality photos (min. 8)', 'Write an engaging description in Georgian', 'Set a competitive price for your region', 'List every amenity accurately'].map((li) => (
                  <li key={li} className="relative pl-6 text-sm text-muted-foreground">
                    <span className="absolute left-0 text-red-500 font-extrabold" aria-hidden="true">✓</span>
                    {li}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-line rounded-card p-6">
              <h3 className="text-[16.5px] font-bold text-ink mb-3">Verification process</h3>
              <ul className="space-y-2.5">
                {['Identity verification (5 minutes)', 'Property check by our team', 'Review and approval within 24 hours', 'Published with the “Verified” badge ✓'].map((li) => (
                  <li key={li} className="relative pl-6 text-sm text-muted-foreground">
                    <span className="absolute left-0 text-red-500 font-extrabold" aria-hidden="true">✓</span>
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-card p-5 mt-5 text-sm text-muted-foreground">
            <b className="text-red-500">💡 Tip:</b> Complete the listing fully before submitting — incomplete listings take longer to approve and need extra back-and-forth.
          </div>
        </div>
      </section>

      {/* Optimize listing — numbered minis */}
      <section id="listing" className="pt-0 pb-13 md:pb-14 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight text-ink">📸 Improve your listing</h2>
          <p className="text-muted-foreground mb-6 text-[14.5px]">Good photos increase bookings 2–3×</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
            {PHOTO_TIPS.map((t) => (
              <div key={t.num} className="bg-white border border-line rounded-card p-5">
                <div className="w-8 h-8 rounded-full bg-red-500 text-white font-extrabold text-sm flex items-center justify-center mb-2.5">
                  {t.num}
                </div>
                <h3 className="text-[15px] font-bold text-ink mb-1.5">{t.title}</h3>
                <p className="text-[13.5px] text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Communication */}
      <section id="comm" className="pt-0 pb-13 md:pb-14 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight text-ink">💬 Communicating with guests</h2>
          <p className="text-muted-foreground mb-6 text-[14.5px]">Fast replies = more bookings. Here are the target times:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
            {RESPONSE_TIMES.map((r) => (
              <div key={r.title} className="bg-white border border-line rounded-card p-5 text-center">
                <h3 className="text-[14.5px] font-bold text-ink">{r.title}</h3>
                <p className="text-[13px] text-soft mt-1 mb-2.5">{r.desc}</p>
                <span className="inline-block bg-red-50 text-red-500 font-extrabold text-sm px-4 py-1.5 rounded-full">{r.time}</span>
              </div>
            ))}
          </div>

          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight text-ink mt-10">📝 Ready-made templates</h2>
          <p className="text-muted-foreground mb-6 text-[14.5px]">Copy and tailor them to your cottage</p>
          {TEMPLATES.map((t, i) => (
            <div key={t.title} className="bg-white border border-line border-l-4 border-l-red-500 rounded-xl p-4 mb-3.5">
              <h4 className="text-sm font-bold text-ink mb-1.5">{t.title}</h4>
              <p className="text-[13.5px] text-muted-foreground italic">“{t.text}”</p>
              <button
                onClick={() => copyTemplate(i, t.text)}
                className="mt-2.5 text-red-500 font-bold text-[13px] cursor-pointer hover:text-red-600 transition-colors"
              >
                {copied === i ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Safety — dark */}
      <section id="safety" className="bg-[#222222] text-white py-13 md:py-14 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight">🛡 Safety</h2>
          <p className="text-gray-300 mb-6 text-[14.5px]">A safe guest and a safe host — the foundation of successful hosting</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[22px]">
            <div className="bg-white/[0.06] border border-white/[0.14] rounded-card p-6">
              <h3 className="text-[16.5px] font-bold mb-3">Property safety</h3>
              <ul className="space-y-2.5">
                {PROPERTY_SAFETY.map((li) => (
                  <li key={li} className="relative pl-6 text-sm text-gray-300">
                    <span className="absolute left-0 text-red-500 font-extrabold" aria-hidden="true">✓</span>
                    {li}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/[0.06] border border-white/[0.14] rounded-card p-6">
              <h3 className="text-[16.5px] font-bold mb-3">Guest verification</h3>
              <ul className="space-y-2.5">
                {GUEST_VERIFICATION.map((li) => (
                  <li key={li} className="relative pl-6 text-sm text-gray-300">
                    <span className="absolute left-0 text-red-500 font-extrabold" aria-hidden="true">✓</span>
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-red-500/15 border border-red-500/40 rounded-card p-5 mt-5 flex gap-x-8 gap-y-2 flex-wrap items-center">
            <b className="text-[15px]">🚨 Emergency:</b>
            <span className="text-sm text-gray-300">Police / Ambulance / Fire — <span className="text-[22px] font-extrabold text-red-500 align-middle">112</span></span>
            <span className="text-sm text-gray-300">RentCottage support — <span className="text-[22px] font-extrabold text-red-500 align-middle">*0505</span></span>
          </div>
        </div>
      </section>

      {/* Help CTA */}
      <section className="py-13 md:py-14 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight text-center text-ink">Need more help?</h2>
          <p className="text-muted-foreground mb-6 text-[14.5px] text-center">Our team is here for you</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[22px]">
            <div className="bg-white border border-line rounded-card p-6 text-center">
              <div className="text-[30px] leading-none" aria-hidden="true">💬</div>
              <h3 className="text-base font-bold text-ink mt-2.5 mb-1.5">Support service</h3>
              <p className="text-[13.5px] text-muted-foreground mb-4">Get an answer to any hosting question — in Georgian</p>
              <button
                onClick={() => setShowContactModal(true)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold text-[14.5px] rounded-xl px-5.5 py-3 cursor-pointer transition-colors whitespace-nowrap"
              >
                Message us
              </button>
            </div>
            <div className="bg-white border border-line rounded-card p-6 text-center">
              <div className="text-[30px] leading-none" aria-hidden="true">📄</div>
              <h3 className="text-base font-bold text-ink mt-2.5 mb-1.5">Cancellation policy</h3>
              <p className="text-[13.5px] text-muted-foreground mb-4">Learn the host cancellation rules and terms</p>
              <button
                onClick={() => setShowCancellationModal(true)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold text-[14.5px] rounded-xl px-5.5 py-3 cursor-pointer transition-colors whitespace-nowrap"
              >
                View policy
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />

      {/* Contact Modal */}
      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />

      {/* Cancellation Modal */}
      {showCancellationModal && (
        <CancellationModal isOpen={showCancellationModal} onClose={() => setShowCancellationModal(false)} />
      )}
    </div>
  );
}
