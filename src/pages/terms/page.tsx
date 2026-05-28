import { useState } from 'react';
import Header from '../../components/feature/Header';
import SEO from '../../components/feature/SEO';
import { useNavigate } from 'react-router-dom';
import CancellationModal from '../../components/feature/CancellationModal';
import ContactModal from '../../components/feature/ContactModal';

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
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

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
        title="Terms & Conditions — RentCottage.Ge"
        description="Read the Terms & Conditions for using RentCottage.Ge, the Georgian cottage rental platform. Learn about bookings, payments, cancellations, and user responsibilities."
        canonical="/terms"
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero bar */}
      <div className="relative w-full h-[180px] sm:h-[240px] md:h-[320px] overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=cozy%20traditional%20Georgian%20stone%20mountain%20cabin%20cottage%20wooden%20balcony%20Svaneti%20style%20surrounded%20by%20pine%20forest%20autumn%20foliage%20warm%20golden%20light%20no%20people%20rustic%20premium%20natural%20landscape%20peaceful%20alpine%20setting%20soft%20warm%20tones&width=1600&height=460&seq=terms-hero-01&orientation=landscape"
          alt="Georgian mountain cottage"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex flex-col justify-end px-4 pb-5 sm:pb-8 md:pb-12">
          <div className="max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-white/70 mb-2 sm:mb-3">
              <a href="/" className="hover:text-white transition-colors cursor-pointer">Home</a>
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-s-line text-white/50"></i>
              </div>
              <span className="text-white/90">Terms &amp; Conditions</span>
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">Terms &amp; Conditions</h1>
            <p className="text-white/70 text-xs sm:text-sm">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Contents</p>
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
                <h3 className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base mb-1">Questions about these Terms?</h3>
                <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3">
                  If you have any questions or concerns about these Terms &amp; Conditions, don&apos;t hesitate to reach out — we&apos;re happy to help.
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

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-10 md:py-16 mt-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-6 md:mb-8">
            <div>
              <h3 className="text-sm font-semibold mb-3 md:mb-4">Support</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li><button onClick={() => setShowCancellationModal(true)} className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer text-left whitespace-nowrap">Cancellation Options</button></li>
                <li><button onClick={() => setShowContactModal(true)} className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer text-left whitespace-nowrap">Contact Us</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3 md:mb-4">Community</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li><a href="/become-host" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Become a Host</a></li>
                <li><a href="/host-resources" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Host Resources</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3 md:mb-4">About</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li><a href="/how-it-works" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">How it Works</a></li>
                <li><a href="/about-georgia" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">About Georgia</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3 md:mb-4">Follow Us</h3>
              <div className="flex space-x-3">
                <a href="https://www.facebook.com/profile.php?id=61583084123461" target="_blank" rel="noopener noreferrer nofollow" className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer">
                  <i className="ri-facebook-line"></i>
                </a>
                <a href="https://www.instagram.com/rentcottage.ge/" target="_blank" rel="noopener noreferrer nofollow" className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer">
                  <i className="ri-instagram-line"></i>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col gap-3 md:gap-0 md:flex-row justify-between items-center">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-0">
              <h2
                className="text-base md:text-xl font-bold text-red-500 cursor-pointer whitespace-nowrap sm:mr-5"
                style={{ fontFamily: '"Futura", "Arial", sans-serif' }}
                onClick={() => navigate('/')}
              >
                RentCottage.Ge
              </h2>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                <a href="/privacy" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Privacy</a>
                <a href="/terms" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Terms &amp; Conditions</a>
                <a href="/sitemap" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Site Map</a>
                <a href="/corporate" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Corporate</a>
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-400">© 2024 RentCottage.Ge, Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <CancellationModal isOpen={showCancellationModal} onClose={() => setShowCancellationModal(false)} />
      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
    </div>
  );
}
