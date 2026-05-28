import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import SEO from '../../components/feature/SEO';
import CancellationModal from '../../components/feature/CancellationModal';
import ContactModal from '../../components/feature/ContactModal';

export default function SiteMap() {
  const navigate = useNavigate();
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Site Map — RentCottage.Ge',
    description: 'Navigate through all pages and sections of RentCottage.Ge, the Georgian cottage rental platform.',
    url: `${siteUrl}/sitemap`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  const siteStructure = [
    {
      category: 'Main Pages',
      links: [
        { title: 'Home', path: '/', description: 'Discover Georgian cottages and experiences' },
        { title: 'Search Results', path: '/search', description: 'Browse and filter available cottages' },
        { title: 'Property Details', path: '/property/1', description: 'View detailed cottage information and book' }
      ]
    },
    {
      category: 'User Account',
      links: [
        { title: 'Profile', path: '/profile', description: 'Manage your account and bookings' }
      ]
    },
    {
      category: 'Host Information',
      links: [
        { title: 'Become a Host', path: '/become-host', description: 'Start hosting your property' },
        { title: 'Host Resources', path: '/host-resources', description: 'Guides and tools for hosts' }
      ]
    },
    {
      category: 'About & Information',
      links: [
        { title: 'How It Works', path: '/how-it-works', description: 'Learn how our platform works' },
        { title: 'About Georgia', path: '/about-georgia', description: 'Discover Georgian culture and destinations' }
      ]
    },
    {
      category: 'Legal & Support',
      links: [
        { title: 'Privacy Policy', path: '/privacy', description: 'Our privacy and data protection policy' },
        { title: 'Terms & Conditions', path: '/terms', description: 'Terms and conditions for using the platform' }
      ]
    }
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Site Map — RentCottage.Ge"
        description="Navigate through all pages and sections of RentCottage.Ge, the Georgian cottage rental platform."
        canonical="/sitemap"
        noIndex={true}
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero Section */}
      <section className="relative w-full h-[180px] sm:h-[260px] md:h-[340px] overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=panoramic%20Georgian%20mountain%20landscape%20Kazbegi%20Greater%20Caucasus%20range%20wide%20open%20valley%20soft%20morning%20light%20misty%20peaks%20green%20meadows%20no%20people%20calm%20serene%20minimal%20clean%20aerial%20view%20pastel%20tones%20golden%20hour%20glow%20vast%20sky%20peaceful%20nature&width=1600&height=500&seq=sitemap-hero-01&orientation=landscape"
          alt="Georgian mountain landscape"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3">Site Map</h1>
          <p className="text-xs sm:text-base md:text-lg text-white/85 max-w-2xl">
            Navigate through all pages and sections of RentCottage.Ge
          </p>
        </div>
      </section>

      {/* Site Map Content */}
      <section className="py-8 sm:py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">

          {/* Site structure grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {siteStructure.map((section, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                <h2 className="text-sm sm:text-base md:text-xl font-semibold text-gray-900 mb-3 sm:mb-5 md:mb-6 pb-2 sm:pb-3 border-b border-gray-100">
                  {section.category}
                </h2>
                <div className="space-y-2 sm:space-y-3 md:space-y-4">
                  {section.links.map((link, linkIndex) => (
                    <div key={linkIndex} className="group">
                      <button
                        onClick={() => handleNavigation(link.path)}
                        className="block w-full text-left hover:bg-gray-50 rounded-lg p-2 sm:p-3 transition-colors cursor-pointer"
                      >
                        <h3 className="font-medium text-red-600 group-hover:text-red-700 mb-0.5 sm:mb-1 text-xs sm:text-sm md:text-base">
                          {link.title}
                        </h3>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {link.description}
                        </p>
                        <span className="text-xs text-gray-400 mt-0.5 sm:mt-1 block">
                          {link.path}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Navigation */}
          <div className="mt-8 sm:mt-12 md:mt-16 bg-red-50 rounded-2xl p-4 sm:p-6 md:p-8">
            <div className="text-center mb-4 sm:mb-6 md:mb-8">
              <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">Quick Navigation</h2>
              <p className="text-gray-600 text-xs sm:text-sm md:text-base">
                Jump directly to the most popular sections of our website
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                { icon: 'ri-search-line', label: 'Search Cottages', path: '/search' },
                { icon: 'ri-home-heart-line', label: 'Become Host', path: '/become-host' },
                { icon: 'ri-question-line', label: 'How It Works', path: '/how-it-works' },
                { icon: 'ri-map-pin-line', label: 'About Georgia', path: '/about-georgia' }
              ].map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleNavigation(item.path)}
                  className="flex flex-col items-center p-3 sm:p-4 bg-white rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center mb-2 sm:mb-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                      <i className={`${item.icon} text-lg sm:text-xl text-red-600`}></i>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-900 text-center">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Contact Information */}
          <div className="mt-8 sm:mt-12 md:mt-16 text-center">
            <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 md:p-8">
              <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">Need Help Finding Something?</h2>
              <p className="text-gray-600 text-xs sm:text-sm md:text-base mb-4 sm:mb-5 md:mb-6 max-w-2xl mx-auto">
                If you can't find what you're looking for, our support team is here to help during business hours.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mr-1.5 sm:mr-2">
                    <i className="ri-mail-line text-red-600 text-sm sm:text-base"></i>
                  </div>
                  <span className="text-gray-700 text-xs sm:text-sm md:text-base">info.rentcottage@gmail.com</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-10 md:py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-6 md:mb-8">
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">Support</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li>
                  <button onClick={() => setShowCancellationModal(true)} className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer text-left whitespace-nowrap">
                    Cancellation Options
                  </button>
                </li>
                <li>
                  <button onClick={() => setShowContactModal(true)} className="text-gray-300 hover:text-white cursor-pointer text-left whitespace-nowrap">
                    <span className="text-xs md:text-sm">Contact Us</span>
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">Community</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li>
                  <a href="/become-host" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">
                    Become a Host
                  </a>
                </li>
                <li>
                  <a href="/host-resources" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">
                    Host Resources
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">About</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li>
                  <a href="/how-it-works" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">
                    How it Works
                  </a>
                </li>
                <li>
                  <a href="/about-georgia" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">
                    About Georgia
                  </a>
                </li>
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
                <a href="/privacy" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">
                  Privacy
                </a>
                <a href="/terms" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">
                  Terms &amp; Conditions
                </a>
                <a href="/corporate" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">
                  Corporate
                </a>
                <a href="/sitemap" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">
                  Site Map
                </a>
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
