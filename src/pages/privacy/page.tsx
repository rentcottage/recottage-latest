import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';

interface Section {
  id: string;
  title: string;
  content: ReactNode;
}

export default function Privacy() {
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

  const sections: Section[] = [
    {
      id: 's1',
      title: '1. Information We Collect',
      content: (
        <div className="space-y-3 text-muted-foreground">
          <h3 className="text-[15px] font-bold text-ink">Personal Information</h3>
          <p>When you use RentCottage.Ge, we may collect the following personal information:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name, email address, and phone number</li>
            <li>Profile information and photos</li>
            <li>Payment information (processed securely through third-party providers)</li>
            <li>Government-issued ID for verification purposes</li>
            <li>Communication preferences</li>
          </ul>
          <h3 className="text-[15px] font-bold text-ink mt-4">Usage Information</h3>
          <p>We automatically collect information about how you use our platform:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Device information (IP address, browser type, operating system)</li>
            <li>Usage patterns and preferences</li>
            <li>Location data (with your permission)</li>
            <li>Cookies and similar tracking technologies</li>
          </ul>
        </div>
      ),
    },
    {
      id: 's2',
      title: '2. How We Use Your Information',
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>We use your information to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide and improve our cottage rental services</li>
            <li>Process bookings and payments</li>
            <li>Communicate with you about your reservations</li>
            <li>Verify your identity and prevent fraud</li>
            <li>Send you marketing communications (with your consent)</li>
            <li>Comply with legal obligations</li>
            <li>Resolve disputes and provide customer support</li>
          </ul>
        </div>
      ),
    },
    {
      id: 's3',
      title: '3. Information Sharing',
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>We may share your information with:</p>
          <h3 className="text-[15px] font-bold text-ink">Hosts and Guests</h3>
          <p>When you make or receive a booking, we share necessary information to facilitate the transaction, including contact details and booking information.</p>
          <h3 className="text-[15px] font-bold text-ink">Service Providers</h3>
          <p>We work with trusted third-party service providers who help us operate our platform, including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Payment processors</li>
            <li>Identity verification services</li>
            <li>Customer support tools</li>
            <li>Analytics providers</li>
          </ul>
          <h3 className="text-[15px] font-bold text-ink">Legal Requirements</h3>
          <p>We may disclose your information when required by law or to protect our rights and safety.</p>
        </div>
      ),
    },
    {
      id: 's4',
      title: '4. Data Security',
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>We implement appropriate security measures to protect your personal information:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Encryption of sensitive data in transit and at rest</li>
            <li>Regular security assessments and updates</li>
            <li>Limited access to personal information on a need-to-know basis</li>
            <li>Secure payment processing through certified providers</li>
          </ul>
          <p>However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>
        </div>
      ),
    },
    {
      id: 's5',
      title: '5. Your Rights and Choices',
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>You have the following rights regarding your personal information:</p>
          <h3 className="text-[15px] font-bold text-ink">Access and Correction</h3>
          <p>You can access and update your personal information through your account settings.</p>
          <h3 className="text-[15px] font-bold text-ink">Data Portability</h3>
          <p>You can request a copy of your personal data in a structured, machine-readable format.</p>
          <h3 className="text-[15px] font-bold text-ink">Deletion</h3>
          <p>You can request deletion of your personal information, subject to certain legal and operational requirements.</p>
          <h3 className="text-[15px] font-bold text-ink">Marketing Communications</h3>
          <p>You can opt out of marketing communications at any time by following the unsubscribe instructions in our emails.</p>
        </div>
      ),
    },
    {
      id: 's6',
      title: '6. Cookies and Tracking',
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>We use cookies and similar technologies to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Remember your preferences and settings</li>
            <li>Analyze website traffic and usage patterns</li>
            <li>Provide personalized content and advertisements</li>
            <li>Improve our services and user experience</li>
          </ul>
          <p>You can control cookie settings through your browser preferences, but disabling cookies may affect website functionality.</p>
        </div>
      ),
    },
    {
      id: 's7',
      title: '7. International Data Transfers',
      content: (
        <p className="text-muted-foreground">Our information may be transferred to and processed in countries other than Georgia. We ensure appropriate safeguards are in place to protect your data during international transfers.</p>
      ),
    },
    {
      id: 's8',
      title: '8. Data Retention',
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>We retain your personal information for as long as necessary to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide our services to you</li>
            <li>Comply with legal obligations</li>
            <li>Resolve disputes and enforce agreements</li>
            <li>Improve our services</li>
          </ul>
          <p>When we no longer need your information, we will securely delete or anonymize it.</p>
        </div>
      ),
    },
    {
      id: 's9',
      title: "9. Children's Privacy",
      content: (
        <p className="text-muted-foreground">Our services are not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal information from a child under 18, we will take steps to delete such information.</p>
      ),
    },
    {
      id: 's10',
      title: '10. Changes to This Policy',
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Posting the updated policy on our website</li>
            <li>Sending you an email notification</li>
            <li>Displaying a prominent notice on our platform</li>
          </ul>
          <p>Your continued use of our services after any changes indicates your acceptance of the updated policy.</p>
        </div>
      ),
    },
    {
      id: 's11',
      title: '11. Contact Us',
      content: (
        <div className="space-y-3 text-muted-foreground">
          <p>If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
          <div className="bg-[#fafafa] border border-line rounded-xl p-4 mt-1">
            <h3 className="font-bold text-ink text-sm mb-1">Email</h3>
            <p>info.rentcottage@gmail.com</p>
          </div>
        </div>
      ),
    },
  ];

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
          <h1 className="text-[22px] md:text-[32px] font-extrabold tracking-tight text-ink">Legal information</h1>
          <p className="text-soft text-sm mt-2">Transparent terms — in plain language</p>
          <div className="inline-flex bg-[#fafafa] border-[1.5px] border-line rounded-full p-1.5 mt-5">
            <button
              onClick={() => navigate('/terms')}
              className="text-sm font-bold px-5.5 py-2.5 rounded-full cursor-pointer transition-colors text-muted-foreground hover:text-ink whitespace-nowrap"
            >
              📄 Terms &amp; Conditions
            </button>
            <button
              className="text-sm font-bold px-5.5 py-2.5 rounded-full cursor-pointer bg-red-500 text-white whitespace-nowrap"
              aria-current="page"
            >
              🔒 Privacy
            </button>
          </div>
        </div>
      </section>

      {/* TOC + content */}
      <div className="max-w-5xl mx-auto px-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-9 py-9 md:py-9">
        {/* Table of contents */}
        <aside className="hidden md:block sticky top-[90px] h-fit bg-white border border-line rounded-card p-4.5">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-soft mb-2.5">Contents</h3>
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
          <p className="text-[12.5px] text-soft mb-5">Last updated: {updated}</p>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-extrabold text-red-500 mb-1.5">💡 Your privacy matters</h3>
            <p className="text-[13.5px] text-muted-foreground m-0">
              We are committed to protecting your privacy and being transparent about how we use your information.
              If you have any concerns or questions, please don&apos;t hesitate to contact us.
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
