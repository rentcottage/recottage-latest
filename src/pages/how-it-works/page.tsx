import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import ContactModal from '../../components/feature/ContactModal';
import CancellationModal from '../../components/feature/CancellationModal';
import SEO from '../../components/feature/SEO';
import Reveal from '../../components/base/Reveal';

export default function HowItWorks() {
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [activeTab, setActiveTab] = useState('guests');
  const navigate = useNavigate();

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
      
      {/* Hero Section */}
      <section className="relative w-full h-[260px] md:h-[400px] overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=charming%20traditional%20Georgian%20wooden%20cottage%20with%20carved%20balcony%20nestled%20in%20lush%20green%20Caucasus%20mountain%20valley%20Svaneti%20style%20architecture%20stone%20walls%20surrounded%20by%20wildflowers%20alpine%20meadow%20warm%20afternoon%20light%20no%20people%20premium%20travel%20photography%20wide%20angle%20landscape&width=1600&height=560&seq=how-it-works-hero-2025&orientation=landscape"
          alt="Georgian cottage in mountain valley"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4">
          <h1 className="text-2xl md:text-5xl font-bold text-white mb-3 md:mb-4">
            How It Works
          </h1>
          <p className="text-sm md:text-xl text-white/90 mb-4 md:mb-8 max-w-2xl">
            Discover how easy it is to find your perfect Georgian cottage or become a successful host
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8 md:py-16">
        {/* Tab Navigation */}
        <div className="flex justify-center mb-8 md:mb-16">
          <div className="bg-gray-100 rounded-full p-1 flex">
            <button
              onClick={() => setActiveTab('guests')}
              className={`px-5 md:px-8 py-2 md:py-3 rounded-full font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'guests'
                  ? 'bg-red-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              For Guests
            </button>
            <button
              onClick={() => setActiveTab('hosts')}
              className={`px-5 md:px-8 py-2 md:py-3 rounded-full font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'hosts'
                  ? 'bg-red-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              For Hosts
            </button>
          </div>
        </div>

        {/* Guest Journey */}
        {activeTab === 'guests' && (
          <div>
            <div className="text-center mb-6 md:mb-12">
              <h2 className="text-lg md:text-3xl font-bold text-gray-900 mb-2 md:mb-4">Your Journey to the Perfect Georgian Getaway</h2>
              <p className="text-sm md:text-base text-gray-600 max-w-2xl mx-auto">
                From search to checkout, we&apos;ve made finding and booking your ideal cottage simple and secure
              </p>
            </div>

            {/* Guest Steps */}
            <div className="space-y-8 md:space-y-16 mb-8 md:mb-16">
              {[
                {
                  step: '1',
                  title: 'Search & Discover',
                  description: 'Enter your destination, dates, and number of guests to find available cottages',
                  details: [
                    'Browse through hundreds of verified Georgian cottages',
                    'Use filters to find exactly what you\'re looking for',
                    'View detailed photos, amenities, and guest reviews',
                    'Compare prices and locations easily'
                  ],
                  image: 'https://readdy.ai/api/search-image?query=Person%20using%20laptop%20to%20search%20for%20Georgian%20cottages%20online%2C%20beautiful%20cottage%20listings%20on%20screen%2C%20modern%20search%20interface%2C%20comfortable%20home%20setting%2C%20travel%20planning%20experience&width=600&height=400&seq=guestStep1&orientation=landscape',
                  color: 'red'
                },
                {
                  step: '2',
                  title: 'Connect with Hosts',
                  description: 'Message hosts directly to ask questions and request bookings',
                  details: [
                    'Send booking requests with your travel details',
                    'Ask hosts about local recommendations and amenities',
                    'Get responses within 24 hours',
                    'Build confidence through direct communication'
                  ],
                  image: 'https://readdy.ai/api/search-image?query=Friendly%20Georgian%20host%20welcoming%20guests%20via%20video%20call%2C%20warm%20smile%2C%20traditional%20Georgian%20cottage%20in%20background%2C%20personal%20connection%2C%20hospitality%20culture%2C%20authentic%20communication&width=600&height=400&seq=guestStep2&orientation=landscape',
                  color: 'blue'
                },
                {
                  step: '3',
                  title: 'Secure Booking',
                  description: 'Complete your reservation with our secure payment system',
                  details: [
                    'Pay securely through our encrypted platform',
                    'Receive instant booking confirmation',
                    'Get detailed check-in instructions',
                    'Access 24/7 customer support during business hours'
                  ],
                  image: 'https://readdy.ai/api/search-image?query=Secure%20online%20payment%20interface%20for%20cottage%20booking%2C%20credit%20card%20and%20mobile%20payment%20options%2C%20security%20icons%2C%20confirmation%20screen%2C%20trust%20and%20safety%20elements&width=600&height=400&seq=guestStep3&orientation=landscape',
                  color: 'green'
                },
                {
                  step: '4',
                  title: 'Enjoy Your Stay',
                  description: 'Arrive at your cottage and experience authentic Georgian hospitality',
                  details: [
                    'Easy check-in with clear instructions',
                    'Enjoy all listed amenities and local experiences',
                    'Get support from your host throughout your stay',
                    'Leave reviews to help future guests'
                  ],
                  image: 'https://readdy.ai/api/search-image?query=Happy%20family%20enjoying%20stay%20at%20Georgian%20cottage%2C%20beautiful%20mountain%20views%2C%20traditional%20architecture%2C%20outdoor%20activities%2C%20authentic%20cultural%20experience%2C%20memorable%20vacation%20moments&width=600&height=400&seq=guestStep4&orientation=landscape',
                  color: 'purple'
                }
              ].map((item, index) => (
                <Reveal key={index} as="div" delay={index % 2 ? 70 : 0} className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-4 md:gap-12`}>
                  <div className="flex-1 w-full">
                    <div className="flex items-center mb-3 md:mb-6">
                      <div className={`w-10 h-10 md:w-16 md:h-16 bg-${item.color}-100 rounded-full flex items-center justify-center mr-3 md:mr-6 flex-shrink-0`}>
                        <span className={`text-base md:text-2xl font-bold text-${item.color}-600`}>{item.step}</span>
                      </div>
                      <div>
                        <h3 className="text-base md:text-2xl font-bold text-gray-900">{item.title}</h3>
                        <p className="text-xs md:text-base text-gray-600 mt-0.5 md:mt-2">{item.description}</p>
                      </div>
                    </div>
                    <ul className="space-y-1.5 md:space-y-3">
                      {item.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-start">
                          <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center mt-0.5 mr-2 md:mr-3 flex-shrink-0">
                            <i className={`ri-check-line text-${item.color}-500 text-xs md:text-sm`}></i>
                          </div>
                          <span className="text-xs md:text-sm text-gray-700">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex-1 w-full">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-40 md:h-80 object-cover object-top rounded-xl"
                    />
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Guest Benefits */}
            <div className="bg-gray-50 rounded-2xl p-4 md:p-8 mb-8 md:mb-16">
              <h3 className="text-base md:text-2xl font-bold text-gray-900 text-center mb-5 md:mb-8">Why Choose RentCottage.Ge?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-8">
                {[
                  { icon: 'ri-shield-check-line', color: 'red', title: 'Verified Properties', desc: 'All cottages are inspected and verified by our team for quality and safety' },
                  { icon: 'ri-customer-service-line', color: 'blue', title: 'Local Support', desc: 'Get help from our Georgian team who knows the country inside and out' },
                  { icon: 'ri-money-dollar-circle-line', color: 'green', title: 'Best Price Guarantee', desc: 'Find the same cottage cheaper elsewhere? We\'ll match the price' },
                ].map(({ icon, color, title, desc }) => (
                  <div key={title} className="text-center">
                    <div className={`w-12 h-12 md:w-16 md:h-16 bg-${color}-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4`}>
                      <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center">
                        <i className={`${icon} text-xl md:text-2xl text-${color}-500`}></i>
                      </div>
                    </div>
                    <h4 className="text-xs md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">{title}</h4>
                    <p className="text-gray-600 text-xs md:text-sm">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA for Guests */}
            <div className="text-center">
              <button
                onClick={() => navigate('/search')}
                className="bg-red-500 hover:bg-red-600 text-white px-6 md:px-8 py-2.5 md:py-4 rounded-lg font-medium text-sm md:text-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Start Your Search
              </button>
            </div>
          </div>
        )}

        {/* Host Journey */}
        {activeTab === 'hosts' && (
          <div>
            <div className="text-center mb-6 md:mb-12">
              <h2 className="text-lg md:text-3xl font-bold text-gray-900 mb-2 md:mb-4">Your Path to Successful Hosting</h2>
              <p className="text-sm md:text-base text-gray-600 max-w-2xl mx-auto">
                Turn your Georgian cottage into a profitable business while sharing your culture with travelers
              </p>
            </div>

            {/* Host Steps */}
            <div className="space-y-8 md:space-y-16 mb-8 md:mb-16">
              {[
                {
                  step: '1',
                  title: 'List Your Property',
                  description: 'Create a compelling listing that showcases your cottage\'s unique charm',
                  details: [
                    'Upload high-quality photos of your cottage',
                    'Write an engaging description highlighting unique features',
                    'Set competitive pricing for your area',
                    'List all amenities and nearby attractions'
                  ],
                  image: 'https://readdy.ai/api/search-image?query=Georgian%20cottage%20owner%20taking%20professional%20photos%20of%20beautiful%20traditional%20cottage%2C%20camera%20equipment%2C%20staging%20interior%20spaces%2C%20creating%20attractive%20listing%2C%20mountain%20backdrop&width=600&height=400&seq=hostStep1&orientation=landscape',
                  color: 'red'
                },
                {
                  step: '2',
                  title: 'Get Verified',
                  description: 'Our team reviews and approves your listing to ensure quality standards',
                  details: [
                    'Complete identity verification process',
                    'Schedule property inspection with our team',
                    'Receive feedback and recommendations',
                    'Get approved and go live on the platform'
                  ],
                  image: 'https://readdy.ai/api/search-image?query=Professional%20property%20inspector%20reviewing%20Georgian%20cottage%2C%20checklist%20in%20hand%2C%20quality%20assessment%2C%20safety%20verification%2C%20approval%20process%2C%20official%20documentation&width=600&height=400&seq=hostStep2&orientation=landscape',
                  color: 'blue'
                },
                {
                  step: '3',
                  title: 'Welcome Guests',
                  description: 'Start receiving bookings and providing exceptional hospitality',
                  details: [
                    'Respond to booking inquiries within 24 hours',
                    'Communicate with guests before and during their stay',
                    'Provide local recommendations and support',
                    'Maintain your property to high standards'
                  ],
                  image: 'https://readdy.ai/api/search-image?query=Georgian%20host%20warmly%20welcoming%20international%20guests%20at%20cottage%20entrance%2C%20traditional%20Georgian%20hospitality%2C%20cultural%20exchange%2C%20friendly%20greeting%2C%20authentic%20experience&width=600&height=400&seq=hostStep3&orientation=landscape',
                  color: 'green'
                },
                {
                  step: '4',
                  title: 'Earn & Grow',
                  description: 'Build your reputation and increase your income through great reviews',
                  details: [
                    'Receive payments securely through our platform',
                    'Get reviews from satisfied guests',
                    'Access host resources and support',
                    'Expand your hosting business over time'
                  ],
                  image: 'https://readdy.ai/api/search-image?query=Successful%20Georgian%20cottage%20host%20reviewing%20positive%20guest%20feedback%20on%20tablet%2C%20earnings%20dashboard%2C%20five-star%20reviews%2C%20business%20growth%2C%20financial%20success&width=600&height=400&seq=hostStep4&orientation=landscape',
                  color: 'purple'
                }
              ].map((item, index) => (
                <Reveal key={index} as="div" delay={index % 2 ? 70 : 0} className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-4 md:gap-12`}>
                  <div className="flex-1 w-full">
                    <div className="flex items-center mb-3 md:mb-6">
                      <div className={`w-10 h-10 md:w-16 md:h-16 bg-${item.color}-100 rounded-full flex items-center justify-center mr-3 md:mr-6 flex-shrink-0`}>
                        <span className={`text-base md:text-2xl font-bold text-${item.color}-600`}>{item.step}</span>
                      </div>
                      <div>
                        <h3 className="text-base md:text-2xl font-bold text-gray-900">{item.title}</h3>
                        <p className="text-xs md:text-base text-gray-600 mt-0.5 md:mt-2">{item.description}</p>
                      </div>
                    </div>
                    <ul className="space-y-1.5 md:space-y-3">
                      {item.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-start">
                          <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center mt-0.5 mr-2 md:mr-3 flex-shrink-0">
                            <i className={`ri-check-line text-${item.color}-500 text-xs md:text-sm`}></i>
                          </div>
                          <span className="text-xs md:text-sm text-gray-700">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex-1 w-full">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-40 md:h-80 object-cover object-top rounded-xl"
                    />
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Host Benefits */}
            <div className="bg-gray-50 rounded-2xl p-4 md:p-8 mb-8 md:mb-16">
              <h3 className="text-base md:text-2xl font-bold text-gray-900 text-center mb-5 md:mb-8">Why Host with Us?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-8">
                {[
                  { icon: 'ri-money-dollar-circle-line', color: 'green', title: 'Competitive Earnings', desc: 'Keep the majority of your booking revenue with our low commission rates' },
                  { icon: 'ri-shield-check-line', color: 'blue', title: 'Host Protection', desc: 'Comprehensive insurance coverage and verified guest screening' },
                  { icon: 'ri-customer-service-line', color: 'purple', title: 'Dedicated Support', desc: 'Get help from our host specialists during business hours' },
                ].map(({ icon, color, title, desc }) => (
                  <div key={title} className="text-center">
                    <div className={`w-12 h-12 md:w-16 md:h-16 bg-${color}-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4`}>
                      <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center">
                        <i className={`${icon} text-xl md:text-2xl text-${color}-500`}></i>
                      </div>
                    </div>
                    <h4 className="text-xs md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">{title}</h4>
                    <p className="text-gray-600 text-xs md:text-sm">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA for Hosts */}
            <div className="text-center">
              <button
                onClick={() => navigate('/become-host')}
                className="bg-red-500 hover:bg-red-600 text-white px-6 md:px-8 py-2.5 md:py-4 rounded-lg font-medium text-sm md:text-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Start Hosting Today
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-10 md:py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-6 md:mb-8">
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">Support</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li>
                  <button 
                    onClick={() => setShowCancellationModal(true)}
                    className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer text-left"
                  >
                    Cancellation Options
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer text-left"
                  >
                    Contact Us
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">Community</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li><a href="/become-host" className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer">Become a Host</a></li>
                <li><a href="/host-resources" className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer">Host Resources</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">About</h3>
              <ul className="space-y-1.5 md:space-y-2">
                <li><a href="/how-it-works" className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer">How it Works</a></li>
                <li><a href="/about-georgia" className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer">About Georgia</a></li>
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
              </div>
            </div>
            <p className="text-gray-400 text-xs md:text-sm">© 2024 RentCottage.Ge, Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      <ContactModal 
        isOpen={showContactModal} 
        onClose={() => setShowContactModal(false)} 
      />

      {/* Cancellation Modal */}
      <CancellationModal 
        isOpen={showCancellationModal} 
        onClose={() => setShowCancellationModal(false)} 
      />
    </div>
  );
}
