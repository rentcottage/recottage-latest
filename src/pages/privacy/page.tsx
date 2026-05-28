import { useState } from 'react';
import Header from '../../components/feature/Header';
import SEO from '../../components/feature/SEO';
import CancellationModal from '../../components/feature/CancellationModal';
import ContactModal from '../../components/feature/ContactModal';

export default function Privacy() {
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Privacy Policy — RentCottage.Ge',
    description: 'Learn how RentCottage.Ge collects, uses and protects your personal information when you use our Georgian cottage rental platform.',
    url: `${siteUrl}/privacy`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Privacy Policy — RentCottage.Ge"
        description="Learn how RentCottage.Ge collects, uses and protects your personal information when you use our Georgian cottage rental platform."
        canonical="/privacy"
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero */}
      <div className="relative w-full h-[180px] sm:h-[240px] md:h-[320px] overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=serene%20Georgian%20Gudauri%20mountain%20valley%20pine%20forest%20misty%20morning%20fog%20rolling%20hills%20no%20people%20wide%20open%20landscape%20soft%20diffused%20light%20pale%20green%20and%20grey%20tones%20tranquil%20nature%20clean%20minimal%20aerial%20Caucasus%20range&width=1600&height=460&seq=privacy-hero-01&orientation=landscape"
          alt="Georgian mountain valley"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/28" />
        <div className="absolute inset-0 flex flex-col justify-end px-4 pb-5 sm:pb-8 md:pb-12">
          <div className="max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-white/70 mb-2 sm:mb-3">
              <a href="/" className="hover:text-white transition-colors cursor-pointer">Home</a>
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-s-line text-white/50"></i>
              </div>
              <span className="text-white/90">Privacy Policy</span>
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">Privacy Policy</h1>
            <p className="text-white/70 text-xs sm:text-sm">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 md:py-16">
        <div className="bg-white">
          <div className="prose max-w-none">
            <p className="sr-only">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            {[
              {
                title: '1. Information We Collect',
                content: (
                  <div className="space-y-3 text-gray-700">
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Personal Information</h3>
                    <p className="text-xs sm:text-sm">When you use RentCottage.Ge, we may collect the following personal information:</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>Name, email address, and phone number</li>
                      <li>Profile information and photos</li>
                      <li>Payment information (processed securely through third-party providers)</li>
                      <li>Government-issued ID for verification purposes</li>
                      <li>Communication preferences</li>
                    </ul>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900 mt-4">Usage Information</h3>
                    <p className="text-xs sm:text-sm">We automatically collect information about how you use our platform:</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>Device information (IP address, browser type, operating system)</li>
                      <li>Usage patterns and preferences</li>
                      <li>Location data (with your permission)</li>
                      <li>Cookies and similar tracking technologies</li>
                    </ul>
                  </div>
                )
              },
              {
                title: '2. How We Use Your Information',
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">We use your information to:</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>Provide and improve our cottage rental services</li>
                      <li>Process bookings and payments</li>
                      <li>Communicate with you about your reservations</li>
                      <li>Verify your identity and prevent fraud</li>
                      <li>Send you marketing communications (with your consent)</li>
                      <li>Comply with legal obligations</li>
                      <li>Resolve disputes and provide customer support</li>
                    </ul>
                  </div>
                )
              },
              {
                title: '3. Information Sharing',
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">We may share your information with:</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Hosts and Guests</h3>
                    <p className="text-xs sm:text-sm">When you make or receive a booking, we share necessary information to facilitate the transaction, including contact details and booking information.</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Service Providers</h3>
                    <p className="text-xs sm:text-sm">We work with trusted third-party service providers who help us operate our platform, including:</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>Payment processors</li>
                      <li>Identity verification services</li>
                      <li>Customer support tools</li>
                      <li>Analytics providers</li>
                    </ul>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Legal Requirements</h3>
                    <p className="text-xs sm:text-sm">We may disclose your information when required by law or to protect our rights and safety.</p>
                  </div>
                )
              },
              {
                title: '4. Data Security',
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">We implement appropriate security measures to protect your personal information:</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>Encryption of sensitive data in transit and at rest</li>
                      <li>Regular security assessments and updates</li>
                      <li>Limited access to personal information on a need-to-know basis</li>
                      <li>Secure payment processing through certified providers</li>
                    </ul>
                    <p className="text-xs sm:text-sm">However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>
                  </div>
                )
              },
              {
                title: '5. Your Rights and Choices',
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">You have the following rights regarding your personal information:</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Access and Correction</h3>
                    <p className="text-xs sm:text-sm">You can access and update your personal information through your account settings.</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Data Portability</h3>
                    <p className="text-xs sm:text-sm">You can request a copy of your personal data in a structured, machine-readable format.</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Deletion</h3>
                    <p className="text-xs sm:text-sm">You can request deletion of your personal information, subject to certain legal and operational requirements.</p>
                    <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Marketing Communications</h3>
                    <p className="text-xs sm:text-sm">You can opt out of marketing communications at any time by following the unsubscribe instructions in our emails.</p>
                  </div>
                )
              },
              {
                title: '6. Cookies and Tracking',
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">We use cookies and similar technologies to:</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>Remember your preferences and settings</li>
                      <li>Analyze website traffic and usage patterns</li>
                      <li>Provide personalized content and advertisements</li>
                      <li>Improve our services and user experience</li>
                    </ul>
                    <p className="text-xs sm:text-sm">You can control cookie settings through your browser preferences, but disabling cookies may affect website functionality.</p>
                  </div>
                )
              },
              {
                title: '7. International Data Transfers',
                content: (
                  <p className="text-xs sm:text-sm text-gray-700">Our information may be transferred to and processed in countries other than Georgia. We ensure appropriate safeguards are in place to protect your data during international transfers.</p>
                )
              },
              {
                title: '8. Data Retention',
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">We retain your personal information for as long as necessary to:</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>Provide our services to you</li>
                      <li>Comply with legal obligations</li>
                      <li>Resolve disputes and enforce agreements</li>
                      <li>Improve our services</li>
                    </ul>
                    <p className="text-xs sm:text-sm">When we no longer need your information, we will securely delete or anonymize it.</p>
                  </div>
                )
              },
              {
                title: "9. Children's Privacy",
                content: (
                  <p className="text-xs sm:text-sm text-gray-700">Our services are not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal information from a child under 18, we will take steps to delete such information.</p>
                )
              },
              {
                title: '10. Changes to This Policy',
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">We may update this Privacy Policy from time to time. We will notify you of any material changes by:</p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      <li>Posting the updated policy on our website</li>
                      <li>Sending you an email notification</li>
                      <li>Displaying a prominent notice on our platform</li>
                    </ul>
                    <p className="text-xs sm:text-sm">Your continued use of our services after any changes indicates your acceptance of the updated policy.</p>
                  </div>
                )
              },
              {
                title: '11. Contact Us',
                content: (
                  <div className="space-y-3 text-gray-700">
                    <p className="text-xs sm:text-sm">If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
                    <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mt-3">
                      <h3 className="font-medium text-gray-900 text-xs sm:text-sm mb-1 sm:mb-2">Email</h3>
                      <p className="text-gray-600 text-xs sm:text-sm">info.rentcottage@gmail.com</p>
                    </div>
                  </div>
                )
              },
            ].map(({ title, content }) => (
              <section key={title} className="mb-6 sm:mb-8">
                <h2 className="text-base sm:text-xl md:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">{title}</h2>
                {content}
              </section>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 mt-6 sm:mt-8">
              <div className="flex items-start">
                <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center mr-2 sm:mr-3 mt-0.5 flex-shrink-0">
                  <i className="ri-information-line text-blue-500 text-sm sm:text-base"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 text-xs sm:text-sm md:text-base mb-1 sm:mb-2">Your Privacy Matters</h3>
                  <p className="text-blue-800 text-xs sm:text-sm">
                    We are committed to protecting your privacy and being transparent about how we use your information.
                    If you have any concerns or questions, please don't hesitate to contact us.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-10 md:py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-6 md:mb-8">
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">Support</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li><button onClick={() => setShowCancellationModal(true)} className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer text-left whitespace-nowrap">Cancellation Options</button></li>
                <li><button onClick={() => setShowContactModal(true)} className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer text-left whitespace-nowrap">Contact Us</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">Community</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li><a href="/become-host" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Become a Host</a></li>
                <li><a href="/host-resources" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Host Resources</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">About</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li><a href="/how-it-works" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">How it Works</a></li>
                <li><a href="/about-georgia" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">About Georgia</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">Follow Us</h3>
              <div className="flex space-x-3 md:space-x-4">
                <a href="https://www.facebook.com/profile.php?id=61583084123461" target="_blank" rel="noopener noreferrer" className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer">
                  <i className="ri-facebook-line"></i>
                </a>
                <a href="https://www.instagram.com/rentcottage.ge/" target="_blank" rel="noopener noreferrer" className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer">
                  <i className="ri-instagram-line"></i>
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 md:pt-8 flex flex-col gap-3 md:gap-0 md:flex-row justify-between items-center">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-0">
              <h1 className="text-base md:text-xl font-bold text-red-500 sm:mr-6" style={{ fontFamily: '"Pacifico", serif' }}>
                RentCottage.Ge
              </h1>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 md:space-x-6">
                <a href="/privacy" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">Privacy</a>
                <a href="/terms" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">Terms &amp; Conditions</a>
                <a href="/sitemap" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">Site Map</a>
                <a href="/corporate" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">Corporate</a>
              </div>
            </div>
            <p className="text-gray-400 text-xs md:text-sm">© 2024 RentCottage.Ge, Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <CancellationModal isOpen={showCancellationModal} onClose={() => setShowCancellationModal(false)} />
      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
    </div>
  );
}
