import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import SEO from '../../components/feature/SEO';

const sections = [
  {
    id: 'introduction',
    number: '1',
    title: 'Introduction',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-4">
          Welcome to <strong>rentcottage.ge</strong> .
        </p>
        <p className="text-gray-700 leading-relaxed mb-4">
          RentCottage.ge belongs to Lux Export LLC &quot;ID 425368434&quot; .

        </p>
        <p className="text-gray-700 leading-relaxed mb-4">
          These Terms &amp; Conditions govern your access to and use of the platform, including booking accommodations and listing properties.
        </p>
        <p className="text-gray-700 leading-relaxed">
          By using this website, you agree to these Terms.
        </p>
      </>
    ),
  },
  {
    id: 'platform-description',
    number: '2',
    title: 'Platform Description',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-4">
          rentcottage.ge is an online marketplace that connects:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
          <li><strong>Guests</strong> (users who book cottages)</li>
          <li><strong>Hosts</strong> (property owners who list cottages)</li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          We act solely as an intermediary and do not own or operate the listed properties.
        </p>
      </>
    ),
  },
  {
    id: 'user-accounts',
    number: '3',
    title: 'User Accounts',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-4">Users must:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
          <li>provide accurate and complete information</li>
          <li>use a valid email address and phone number</li>
          <li>maintain the confidentiality of their account credentials</li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          We reserve the right to suspend or terminate accounts that provide false information or violate these Terms.
        </p>
      </>
    ),
  },
  {
    id: 'booking-process',
    number: '4',
    title: 'Booking Process',
    content: (
      <>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
          <li>Guests can submit booking requests through the platform</li>
          <li>Bookings may require host approval or be automatically confirmed</li>
          <li>
            A booking is confirmed only after:
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>host approval, or</li>
              <li>successful payment (if applicable)</li>
            </ul>
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          Users must ensure that all booking details are accurate.
        </p>
      </>
    ),
  },
  {
    id: 'payments',
    number: '5',
    title: 'Payments',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-4">The platform may support:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
          <li><strong>Pay at Property</strong> (payment made directly to the host)</li>
          <li><strong>Online Payments</strong> (processed via third-party providers)</li>
        </ul>
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-4 mb-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">Important:</p>
          <ul className="list-disc pl-4 space-y-1 text-amber-800 text-sm">
            <li>rentcottage.ge does not store card details</li>
            <li>Payments are processed securely via external providers (e.g. Bank of Georgia)</li>
          </ul>
        </div>
        <p className="text-gray-700 leading-relaxed">
          The platform may hold and transfer payments according to its internal payment processing and settlement rules.
        </p>
      </>
    ),
  },
  {
    id: 'cancellation-policy',
    number: '6',
    title: 'Cancellation Policy',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-4">Cancellation terms depend on the selected policy:</p>
        <div className="space-y-4 mb-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Flexible</h4>
            <p className="text-gray-700 text-sm">Full refund if cancelled at least 2 days before check-in</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Moderate</h4>
            <p className="text-gray-700 text-sm">Partial refund depending on cancellation timing</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Strict</h4>
            <p className="text-gray-700 text-sm">Limited or no refund depending on timing</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">Note:</p>
          <ul className="list-disc pl-4 space-y-1 text-gray-600 text-sm">
            <li>Some policies apply only to online payments</li>
            <li>Final refund handling may depend on host policy and payment method</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    id: 'host-responsibilities',
    number: '7',
    title: 'Host Responsibilities',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-3">Hosts must:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-5">
          <li>provide accurate descriptions and photos</li>
          <li>keep availability updated</li>
          <li>honor confirmed bookings</li>
          <li>maintain acceptable property standards</li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-3">Hosts are not allowed to:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-5">
          <li>include personal contact details in listings</li>
          <li>attempt to bypass the platform for bookings</li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-4">
          Hosts agree to comply with the platform&apos;s commission structure and payment terms as defined in separate agreements.
        </p>
        <p className="text-gray-700 leading-relaxed">
          We may hide or remove listings that violate these rules.
        </p>
      </>
    ),
  },
  {
    id: 'guest-responsibilities',
    number: '8',
    title: 'Guest Responsibilities',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-3">Guests must:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>respect host rules and property conditions</li>
          <li>avoid causing damage</li>
          <li>provide accurate booking information</li>
        </ul>
      </>
    ),
  },
  {
    id: 'prohibited-activities',
    number: '9',
    title: 'Prohibited Activities',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-3">Users must NOT:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
          <li>share contact details (phone, email, social media) to bypass the platform</li>
          <li>engage in fraudulent or illegal activities</li>
          <li>manipulate bookings or reviews</li>
          <li>upload harmful, misleading, or inappropriate content</li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          Violation may result in account suspension or removal.
        </p>
      </>
    ),
  },
  {
    id: 'reviews',
    number: '10',
    title: 'Reviews',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-4">
          Guests may leave reviews after completed stays.
        </p>
        <p className="text-gray-700 leading-relaxed mb-3">Reviews must:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
          <li>be honest and respectful</li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-3">We reserve the right to remove:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>fake content</li>
          <li>abusive content</li>
          <li>misleading content</li>
        </ul>
      </>
    ),
  },
  {
    id: 'platform-fees',
    number: '11',
    title: 'Platform Fees',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-4">
          Platform service fees (if applicable) are included in the displayed price.
        </p>
        <p className="text-gray-700 leading-relaxed">
          Hosts may be subject to commission agreements as defined separately.
        </p>
      </>
    ),
  },
  {
    id: 'limitation-of-liability',
    number: '12',
    title: 'Limitation of Liability',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-3">rentcottage.ge:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>is not responsible for actions of hosts or guests</li>
          <li>is not liable for damages, losses, or disputes between users</li>
        </ul>
      </>
    ),
  },
  {
    id: 'availability',
    number: '13',
    title: 'Availability of Service',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-3">
          We aim to keep the platform available and functional, but:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>we do not guarantee uninterrupted access</li>
          <li>features may be modified or updated at any time</li>
        </ul>
      </>
    ),
  },
  {
    id: 'data-privacy',
    number: '14',
    title: 'Data & Privacy',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed">
          Use of the platform is subject to our{' '}
          <a href="/privacy" className="text-red-500 hover:text-red-600 underline cursor-pointer">Privacy Policy</a>.
        </p>
      </>
    ),
  },
  {
    id: 'changes-to-terms',
    number: '15',
    title: 'Changes to Terms',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-4">
          We reserve the right to update these Terms at any time.
        </p>
        <p className="text-gray-700 leading-relaxed">
          Continued use of the platform constitutes acceptance of the updated Terms.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    number: '16',
    title: 'Contact',
    content: (
      <>
        <p className="text-gray-700 leading-relaxed mb-4">
          For questions or support:
        </p>
        <div className="bg-gray-50 rounded-lg p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="ri-mail-line text-red-500 text-lg"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-0.5">Email</p>
            <a href="mailto:info@rentcottage.ge" className="text-gray-900 font-medium hover:text-red-500 transition-colors cursor-pointer">
              info@rentcottage.ge
            </a>
          </div>
        </div>
      </>
    ),
  },
];

export default function TermsPage() {
  const navigate = useNavigate();
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
          <h1 className="text-[22px] md:text-[32px] font-extrabold tracking-tight text-ink">Legal information</h1>
          <p className="text-soft text-sm mt-2">Transparent terms — in plain language</p>
          <div className="inline-flex bg-[#fafafa] border-[1.5px] border-line rounded-full p-1.5 mt-5">
            <button
              className="text-sm font-bold px-5.5 py-2.5 rounded-full cursor-pointer bg-red-500 text-white whitespace-nowrap"
              aria-current="page"
            >
              📄 Terms &amp; Conditions
            </button>
            <button
              onClick={() => navigate('/privacy')}
              className="text-sm font-bold px-5.5 py-2.5 rounded-full cursor-pointer transition-colors text-muted-foreground hover:text-ink whitespace-nowrap"
            >
              🔒 Privacy
            </button>
          </div>
        </div>
      </section>

      {/* TOC + content */}
      <div className="max-w-5xl mx-auto px-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-9 py-9">
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
                {s.number}. {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content card */}
        <main className="bg-white border border-line rounded-card p-6 md:px-9 md:py-8">
          <p className="text-[12.5px] text-soft mb-5">Last updated: {updated}</p>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-extrabold text-red-500 mb-1.5">💡 In short</h3>
            <p className="text-[13.5px] text-muted-foreground m-0">
              RentCottage.ge connects guests and hosts. You pay online or on arrival; free cancellation up to 48 hours
              before check-in (unless the cottage page states otherwise). The full terms are below.
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
