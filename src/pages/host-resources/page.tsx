import { useState } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import ContactModal from '../../components/feature/ContactModal';
import CancellationModal from '../../components/feature/CancellationModal';
import SEO from '../../components/feature/SEO';
import { useT } from '../../i18n';

export default function HostResources() {
  const { t } = useT();
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const NAV_PILLS = [
    { id: 'start', label: t('hostResources.navStart') },
    { id: 'listing', label: t('hostResources.navListing') },
    { id: 'comm', label: t('hostResources.navComm') },
    { id: 'safety', label: t('hostResources.navSafety') },
  ];

  const CREATE_STEPS = [
    t('hostResources.create1'),
    t('hostResources.create2'),
    t('hostResources.create3'),
    t('hostResources.create4'),
  ];

  const PHOTO_TIPS = [1, 2, 3, 4, 5, 6].map((n) => ({
    num: n,
    title: t(`hostResources.photo${n}Title`),
    desc: t(`hostResources.photo${n}Desc`),
  }));

  const RESPONSE_TIMES = [1, 2, 3].map((n) => ({
    title: t(`hostResources.resp${n}Title`),
    desc: t(`hostResources.resp${n}Desc`),
    time: t(`hostResources.resp${n}Time`),
  }));

  const TEMPLATES = [1, 2, 3].map((n) => ({
    title: t(`hostResources.tpl${n}Title`),
    text: t(`hostResources.tpl${n}Text`),
  }));

  const PROPERTY_SAFETY = [
    t('hostResources.propSafety1'),
    t('hostResources.propSafety2'),
    t('hostResources.propSafety3'),
    t('hostResources.propSafety4'),
  ];

  const GUEST_VERIFICATION = [
    t('hostResources.guestVerify1'),
    t('hostResources.guestVerify2'),
    t('hostResources.guestVerify3'),
    t('hostResources.guestVerify4'),
  ];

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
          <h1 className="text-[24px] md:text-[36px] font-extrabold tracking-tight text-ink">{t('hostResources.heroTitle')}</h1>
          <p className="text-muted-foreground max-w-lg mx-auto mt-3 text-[15.5px]">
            {t('hostResources.heroSub')}
          </p>
          <div className="flex justify-center gap-2.5 mt-6 flex-wrap">
            {NAV_PILLS.map((p) => (
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
          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight text-ink">{t('hostResources.startTitle')}</h2>
          <p className="text-muted-foreground mb-6 text-[14.5px]">{t('hostResources.startSub')}</p>
          <div className="grid grid-cols-1 gap-5 md:gap-[22px]">
            <div className="bg-white border border-line rounded-card p-6">
              <h3 className="text-[16.5px] font-bold text-ink mb-3">{t('hostResources.createTitle')}</h3>
              <ul className="space-y-2.5">
                {CREATE_STEPS.map((li) => (
                  <li key={li} className="relative pl-6 text-sm text-muted-foreground">
                    <span className="absolute left-0 text-red-500 font-extrabold" aria-hidden="true">✓</span>
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-card p-5 mt-5 text-sm text-muted-foreground">
            {t('hostResources.tip')}
          </div>
        </div>
      </section>

      {/* Optimize listing — numbered minis */}
      <section id="listing" className="pt-0 pb-13 md:pb-14 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight text-ink">{t('hostResources.listingTitle')}</h2>
          <p className="text-muted-foreground mb-6 text-[14.5px]">{t('hostResources.listingSub')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
            {PHOTO_TIPS.map((tip) => (
              <div key={tip.num} className="bg-white border border-line rounded-card p-5">
                <div className="w-8 h-8 rounded-full bg-red-500 text-white font-extrabold text-sm flex items-center justify-center mb-2.5">
                  {tip.num}
                </div>
                <h3 className="text-[15px] font-bold text-ink mb-1.5">{tip.title}</h3>
                <p className="text-[13.5px] text-muted-foreground leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Communication */}
      <section id="comm" className="pt-0 pb-13 md:pb-14 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight text-ink">{t('hostResources.commTitle')}</h2>
          <p className="text-muted-foreground mb-6 text-[14.5px]">{t('hostResources.commSub')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
            {RESPONSE_TIMES.map((r) => (
              <div key={r.title} className="bg-white border border-line rounded-card p-5 text-center">
                <h3 className="text-[14.5px] font-bold text-ink">{r.title}</h3>
                <p className="text-[13px] text-soft mt-1 mb-2.5">{r.desc}</p>
                <span className="inline-block bg-red-50 text-red-500 font-extrabold text-sm px-4 py-1.5 rounded-full">{r.time}</span>
              </div>
            ))}
          </div>

          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight text-ink mt-10">{t('hostResources.templatesTitle')}</h2>
          <p className="text-muted-foreground mb-6 text-[14.5px]">{t('hostResources.templatesSub')}</p>
          {TEMPLATES.map((tpl, i) => (
            <div key={tpl.title} className="bg-white border border-line border-l-4 border-l-red-500 rounded-xl p-4 mb-3.5">
              <h4 className="text-sm font-bold text-ink mb-1.5">{tpl.title}</h4>
              <p className="text-[13.5px] text-muted-foreground italic">“{tpl.text}”</p>
              <button
                onClick={() => copyTemplate(i, tpl.text)}
                className="mt-2.5 text-red-500 font-bold text-[13px] cursor-pointer hover:text-red-600 transition-colors"
              >
                {copied === i ? t('hostResources.copied') : t('hostResources.copy')}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Safety — dark */}
      <section id="safety" className="bg-[#222222] text-white py-13 md:py-14 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight">{t('hostResources.safetyTitle')}</h2>
          <p className="text-gray-300 mb-6 text-[14.5px]">{t('hostResources.safetySub')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[22px]">
            <div className="bg-white/[0.06] border border-white/[0.14] rounded-card p-6">
              <h3 className="text-[16.5px] font-bold mb-3">{t('hostResources.propSafetyTitle')}</h3>
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
              <h3 className="text-[16.5px] font-bold mb-3">{t('hostResources.guestVerifyTitle')}</h3>
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
            <b className="text-[15px]">{t('hostResources.emergency')}</b>
            <span className="text-sm text-gray-300">{t('hostResources.emergencyPolice')} <span className="text-[22px] font-extrabold text-red-500 align-middle">112</span></span>
            <span className="text-sm text-gray-300">{t('hostResources.emergencySupport')} <span className="text-[22px] font-extrabold text-red-500 align-middle">*0505</span></span>
          </div>
        </div>
      </section>

      {/* Help CTA */}
      <section className="py-13 md:py-14 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[19px] md:text-[26px] font-extrabold tracking-tight text-center text-ink">{t('hostResources.helpTitle')}</h2>
          <p className="text-muted-foreground mb-6 text-[14.5px] text-center">{t('hostResources.helpSub')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[22px]">
            <div className="bg-white border border-line rounded-card p-6 text-center">
              <div className="text-[30px] leading-none" aria-hidden="true">💬</div>
              <h3 className="text-base font-bold text-ink mt-2.5 mb-1.5">{t('hostResources.supportTitle')}</h3>
              <p className="text-[13.5px] text-muted-foreground mb-4">{t('hostResources.supportDesc')}</p>
              <button
                onClick={() => setShowContactModal(true)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold text-[14.5px] rounded-xl px-5.5 py-3 cursor-pointer transition-colors whitespace-nowrap"
              >
                {t('hostResources.supportBtn')}
              </button>
            </div>
            <div className="bg-white border border-line rounded-card p-6 text-center">
              <div className="text-[30px] leading-none" aria-hidden="true">📄</div>
              <h3 className="text-base font-bold text-ink mt-2.5 mb-1.5">{t('hostResources.cancelTitle')}</h3>
              <p className="text-[13.5px] text-muted-foreground mb-4">{t('hostResources.cancelDesc')}</p>
              <button
                onClick={() => setShowCancellationModal(true)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold text-[14.5px] rounded-xl px-5.5 py-3 cursor-pointer transition-colors whitespace-nowrap"
              >
                {t('hostResources.cancelBtn')}
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
