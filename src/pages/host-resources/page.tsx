import { useState } from 'react';
import Header from '../../components/feature/Header';
import ContactModal from '../../components/feature/ContactModal';
import CancellationModal from '../../components/feature/CancellationModal';
import SEO from '../../components/feature/SEO';

export default function HostResources() {
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
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
    <div className="min-h-screen bg-white">
      <SEO
        title="Host Resources — Tips & Guides for Georgian Cottage Hosts | RentCottage.Ge"
        description="Everything Georgian cottage hosts need to succeed: listing tips, photography best practices, guest communication templates, pricing strategies and safety guidelines."
        keywords="Georgian cottage host tips, host resources Georgia, listing cottage guide, hosting guide Georgia, cottage host photography tips"
        canonical="/host-resources"
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero Section */}
      <section
        className="relative h-[240px] sm:h-[400px] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('https://readdy.ai/api/search-image?query=Georgian%20cottage%20host%20welcoming%20guests%20with%20warm%20hospitality%2C%20traditional%20Georgian%20architecture%2C%20beautiful%20mountain%20landscape%2C%20professional%20hosting%20service%2C%20authentic%20cultural%20experience%2C%20friendly%20atmosphere&width=1400&height=400&seq=hostResourcesHero&orientation=landscape')`
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-2 sm:mb-4">
            Host Resources
          </h1>
          <p className="text-sm sm:text-xl text-white/90 mb-4 sm:mb-8 max-w-2xl">
            Everything you need to become a successful host and provide exceptional experiences for your guests
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8 sm:py-16">

        {/* Quick Navigation */}
        <div className="bg-gray-50 rounded-2xl p-4 sm:p-8 mb-8 sm:mb-16">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 text-center mb-4 sm:mb-8">Quick Navigation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { id: 'getting-started', icon: 'ri-rocket-line', label: 'Getting Started' },
              { id: 'listing-tips', icon: 'ri-home-line', label: 'Listing Tips' },
              { id: 'guest-communication', icon: 'ri-message-line', label: 'Guest Communication' },
              { id: 'safety-guidelines', icon: 'ri-shield-check-line', label: 'Safety Guidelines' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="flex flex-col items-center p-3 sm:p-4 bg-white rounded-xl hover:bg-red-50 hover:border-red-200 border border-gray-200 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center mb-1.5 sm:mb-2">
                  <i className={`${item.icon} text-xl sm:text-2xl text-red-500`}></i>
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-900 text-center">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Getting Started Section */}
        <section id="getting-started" className="mb-10 sm:mb-16">
          <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-5 sm:mb-8">Getting Started as a Host</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-12">
            <div className="bg-white rounded-xl shadow-lg p-5 sm:p-8">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
                  <i className="ri-home-add-line text-xl sm:text-2xl text-red-500"></i>
                </div>
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Create Your Listing</h3>
              <ul className="space-y-2 sm:space-y-3 text-gray-600">
                {[
                  'Upload high-quality photos of your cottage',
                  'Write a compelling property description',
                  'Set competitive pricing for your area',
                  'List all available amenities accurately',
                ].map((item) => (
                  <li key={item} className="flex items-start">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mt-0.5 mr-2 sm:mr-3 flex-shrink-0">
                      <i className="ri-check-line text-green-500 text-sm sm:text-base"></i>
                    </div>
                    <span className="text-xs sm:text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-5 sm:p-8">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
                  <i className="ri-shield-check-line text-xl sm:text-2xl text-blue-500"></i>
                </div>
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Verification Process</h3>
              <ul className="space-y-2 sm:space-y-3 text-gray-600">
                {[
                  'Complete identity verification',
                  'Property inspection by our team',
                  'Review and approval process',
                  'Go live and start receiving bookings',
                ].map((item) => (
                  <li key={item} className="flex items-start">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mt-0.5 mr-2 sm:mr-3 flex-shrink-0">
                      <i className="ri-check-line text-green-500 text-sm sm:text-base"></i>
                    </div>
                    <span className="text-xs sm:text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
            <div className="flex items-start">
              <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center mr-2 sm:mr-3 mt-0.5 flex-shrink-0">
                <i className="ri-lightbulb-line text-blue-500 text-sm sm:text-base"></i>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 text-sm sm:text-base mb-1 sm:mb-2">Pro Tip</h4>
                <p className="text-blue-800 text-xs sm:text-sm">Complete your listing with all details before submitting for review. Incomplete listings take longer to approve and may require additional back-and-forth communication.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Listing Tips Section */}
        <section id="listing-tips" className="mb-10 sm:mb-16">
          <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-5 sm:mb-8">Optimize Your Listing</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Photography Best Practices</h3>
              <div className="space-y-3 sm:space-y-4">
                {[
                  { num: '1', color: 'green', title: 'Natural Lighting', desc: 'Take photos during golden hour or with plenty of natural light. Avoid using flash when possible.' },
                  { num: '2', color: 'green', title: 'Wide Angles', desc: 'Use wide-angle shots to show the full space and make rooms appear larger and more inviting.' },
                  { num: '3', color: 'green', title: 'Clean & Staged', desc: 'Ensure spaces are clean, decluttered, and staged to look welcoming and comfortable.' },
                ].map(({ num, color, title, desc }) => (
                  <div key={num} className="flex items-start">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 bg-${color}-100 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0 mt-0.5`}>
                      <span className={`text-xs font-semibold text-${color}-600`}>{num}</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-0.5 sm:mb-1">{title}</h4>
                      <p className="text-gray-600 text-xs sm:text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Writing Compelling Descriptions</h3>
              <div className="space-y-3 sm:space-y-4">
                {[
                  { num: '1', color: 'blue', title: 'Tell a Story', desc: 'Share the unique history or special features that make your cottage memorable.' },
                  { num: '2', color: 'blue', title: 'Highlight Amenities', desc: 'Mention key amenities and nearby attractions that guests will find valuable.' },
                  { num: '3', color: 'blue', title: 'Be Honest', desc: 'Accurately describe your space to set proper expectations and avoid disappointment.' },
                ].map(({ num, color, title, desc }) => (
                  <div key={num} className="flex items-start">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 bg-${color}-100 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0 mt-0.5`}>
                      <span className={`text-xs font-semibold text-${color}-600`}>{num}</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-0.5 sm:mb-1">{title}</h4>
                      <p className="text-gray-600 text-xs sm:text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 sm:p-8">
            <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Pricing Strategy</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {[
                { icon: 'ri-search-line', color: 'yellow', title: 'Research Competition', desc: 'Check similar properties in your area to understand market rates and position competitively.' },
                { icon: 'ri-calendar-line', color: 'purple', title: 'Seasonal Pricing', desc: 'Adjust rates for peak seasons, holidays, and local events to maximize revenue.' },
                { icon: 'ri-star-line', color: 'green', title: 'Value-Based Pricing', desc: 'Price based on unique amenities, location benefits, and overall guest experience value.' },
              ].map(({ icon, color, title, desc }) => (
                <div key={title} className="text-center">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 bg-${color}-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4`}>
                    <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
                      <i className={`${icon} text-xl sm:text-2xl text-${color}-600`}></i>
                    </div>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-xs sm:text-sm mb-1 sm:mb-2">{title}</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Guest Communication Section */}
        <section id="guest-communication" className="mb-10 sm:mb-16">
          <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-5 sm:mb-8">Guest Communication Excellence</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8">
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Response Time Guidelines</h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between p-3 sm:p-4 bg-green-50 rounded-lg gap-2">
                  <div>
                    <h4 className="font-medium text-green-900 text-xs sm:text-sm">Booking Inquiries</h4>
                    <p className="text-xs text-green-700">Initial guest questions</p>
                  </div>
                  <span className="text-sm sm:text-lg font-bold text-green-600 whitespace-nowrap">Within 1 hour</span>
                </div>
                <div className="flex items-center justify-between p-3 sm:p-4 bg-blue-50 rounded-lg gap-2">
                  <div>
                    <h4 className="font-medium text-blue-900 text-xs sm:text-sm">Booking Requests</h4>
                    <p className="text-xs text-blue-700">Accept or decline requests</p>
                  </div>
                  <span className="text-sm sm:text-lg font-bold text-blue-600 whitespace-nowrap">Within 24 hours</span>
                </div>
                <div className="flex items-center justify-between p-3 sm:p-4 bg-yellow-50 rounded-lg gap-2">
                  <div>
                    <h4 className="font-medium text-yellow-900 text-xs sm:text-sm">General Messages</h4>
                    <p className="text-xs text-yellow-700">Ongoing communication</p>
                  </div>
                  <span className="text-sm sm:text-lg font-bold text-yellow-600 whitespace-nowrap">Within 4 hours</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8">
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Communication Templates</h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1 sm:mb-2">Welcome Message</h4>
                  <p className="text-xs text-gray-600 italic">"Welcome to [Property Name]! I'm excited to host you. Here&#39;s everything you need to know for check-in..."</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1 sm:mb-2">Check-in Instructions</h4>
                  <p className="text-xs text-gray-600 italic">"Your check-in is at 3 PM. The key is located in the lockbox by the front door. The code is..."</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1 sm:mb-2">Local Recommendations</h4>
                  <p className="text-xs text-gray-600 italic">"For the best Georgian cuisine, I recommend visiting [Restaurant Name]. It&#39;s just 10 minutes away..."</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 sm:p-8">
            <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Building Guest Relationships</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-2 sm:mb-3">Before Arrival</h4>
                <ul className="space-y-1.5 sm:space-y-2 text-gray-600">
                  {[
                    'Send welcome message with check-in details',
                    'Share local recommendations and tips',
                    'Provide emergency contact information',
                  ].map((item) => (
                    <li key={item} className="flex items-start">
                      <div className="w-4 h-4 flex items-center justify-center mt-0.5 mr-2 flex-shrink-0">
                        <i className="ri-check-line text-green-500 text-xs sm:text-sm"></i>
                      </div>
                      <span className="text-xs sm:text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-2 sm:mb-3">During Stay</h4>
                <ul className="space-y-1.5 sm:space-y-2 text-gray-600">
                  {[
                    'Check in within 24 hours of arrival',
                    'Be available for questions or issues',
                    'Respect guest privacy and space',
                  ].map((item) => (
                    <li key={item} className="flex items-start">
                      <div className="w-4 h-4 flex items-center justify-center mt-0.5 mr-2 flex-shrink-0">
                        <i className="ri-check-line text-green-500 text-xs sm:text-sm"></i>
                      </div>
                      <span className="text-xs sm:text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Safety Guidelines Section */}
        <section id="safety-guidelines" className="mb-10 sm:mb-16">
          <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-5 sm:mb-8">Safety &amp; Security Guidelines</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
            <div className="bg-white rounded-xl shadow-lg p-5 sm:p-8">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
                  <i className="ri-shield-check-line text-xl sm:text-2xl text-red-500"></i>
                </div>
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Property Safety</h3>
              <ul className="space-y-2 sm:space-y-3 text-gray-600">
                {[
                  'Install smoke and carbon monoxide detectors',
                  'Provide fire extinguisher and first aid kit',
                  'Ensure all electrical systems are up to code',
                  'Secure all windows and doors properly',
                ].map((item) => (
                  <li key={item} className="flex items-start">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mt-0.5 mr-2 sm:mr-3 flex-shrink-0">
                      <i className="ri-check-line text-green-500 text-sm sm:text-base"></i>
                    </div>
                    <span className="text-xs sm:text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-5 sm:p-8">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
                  <i className="ri-user-settings-line text-xl sm:text-2xl text-blue-500"></i>
                </div>
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Guest Verification</h3>
              <ul className="space-y-2 sm:space-y-3 text-gray-600">
                {[
                  'Review guest profiles and previous reviews',
                  'Communicate with guests before arrival',
                  'Trust your instincts about bookings',
                  'Keep records of all guest interactions',
                ].map((item) => (
                  <li key={item} className="flex items-start">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mt-0.5 mr-2 sm:mr-3 flex-shrink-0">
                      <i className="ri-check-line text-green-500 text-sm sm:text-base"></i>
                    </div>
                    <span className="text-xs sm:text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6">
            <div className="flex items-start">
              <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center mr-2 sm:mr-3 mt-0.5 flex-shrink-0">
                <i className="ri-alert-line text-yellow-500 text-sm sm:text-base"></i>
              </div>
              <div>
                <h4 className="font-semibold text-yellow-900 text-sm sm:text-base mb-1 sm:mb-2">Emergency Contacts</h4>
                <p className="text-yellow-800 text-xs sm:text-sm mb-0.5"><strong className="text-yellow-900">Police:</strong> 112</p>
                <p className="text-yellow-800 text-xs sm:text-sm mb-0.5"><strong className="text-yellow-900">Ambulance:</strong> 112</p>
                <p className="text-yellow-800 text-xs sm:text-sm"><strong className="text-yellow-900">Fire Department:</strong> 112</p>
              </div>
            </div>
          </div>
        </section>

        {/* Support Section */}
        <section className="bg-gray-50 rounded-2xl p-4 sm:p-8">
          <div className="text-center mb-5 sm:mb-8">
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Need More Help?</h2>
            <p className="text-gray-600 text-xs sm:text-base">Our hosting support team is here to assist you</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <i className="ri-mail-line text-red-500 text-lg sm:text-xl"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Contact Support</h3>
                  <p className="text-gray-600 text-xs sm:text-sm">Get help with your hosting questions</p>
                </div>
              </div>
              <button
                onClick={() => setShowContactModal(true)}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 sm:py-3 px-4 rounded-lg transition-colors text-sm cursor-pointer whitespace-nowrap"
              >
                Send Message
              </button>
            </div>

            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <i className="ri-book-line text-blue-500 text-lg sm:text-xl"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Cancellation Policy</h3>
                  <p className="text-gray-600 text-xs sm:text-sm">Learn about our host cancellation rules</p>
                </div>
              </div>
              <button
                onClick={() => setShowCancellationModal(true)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 sm:py-3 px-4 rounded-lg transition-colors text-sm cursor-pointer whitespace-nowrap"
              >
                View Policy
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-10 sm:py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div>
              <h3 className="text-sm sm:text-lg font-semibold mb-3 sm:mb-4">Support</h3>
              <ul className="space-y-1.5 sm:space-y-2">
                <li>
                  <button
                    onClick={() => setShowCancellationModal(true)}
                    className="text-xs sm:text-sm text-gray-300 hover:text-white cursor-pointer text-left"
                  >
                    Cancellation Options
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="text-xs sm:text-sm text-gray-300 hover:text-white cursor-pointer text-left"
                  >
                    Contact Us
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm sm:text-lg font-semibold mb-3 sm:mb-4">Community</h3>
              <ul className="space-y-1.5 sm:space-y-2">
                <li>
                  <a href="/become-host" className="text-xs sm:text-sm text-gray-300 hover:text-white cursor-pointer">
                    Become a Host
                  </a>
                </li>
                <li>
                  <a href="/host-resources" className="text-xs sm:text-sm text-gray-300 hover:text-white cursor-pointer">
                    Host Resources
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm sm:text-lg font-semibold mb-3 sm:mb-4">About</h3>
              <ul className="space-y-1.5 sm:space-y-2">
                <li>
                  <a href="/how-it-works" className="text-xs sm:text-sm text-gray-300 hover:text-white cursor-pointer">
                    How it Works
                  </a>
                </li>
                <li>
                  <a href="/about-georgia" className="text-xs sm:text-sm text-gray-300 hover:text-white cursor-pointer">
                    About Georgia
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm sm:text-lg font-semibold mb-3 sm:mb-4">Follow Us</h3>
              <div className="flex space-x-3 sm:space-x-4">
                <a
                  href="https://www.facebook.com/profile.php?id=61583084123461"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer"
                >
                  <i className="ri-facebook-line"></i>
                </a>
                <a
                  href="https://www.instagram.com/rentcottage.ge/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer"
                >
                  <i className="ri-instagram-line"></i>
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 sm:pt-8 flex flex-col gap-3 sm:gap-0 sm:flex-row justify-between items-center">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-0">
              <h1
                className="text-lg sm:text-xl font-bold text-red-500 sm:mr-6"
                style={{ fontFamily: '"Pacifico", serif' }}
              >
                RentCottage.Ge
              </h1>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 sm:space-x-6">
                <a href="/privacy" className="text-gray-300 hover:text-white text-xs sm:text-sm cursor-pointer">Privacy</a>
                <a href="/terms" className="text-gray-300 hover:text-white text-xs sm:text-sm cursor-pointer">Terms &amp; Conditions</a>
                <a href="/sitemap" className="text-gray-300 hover:text-white text-xs sm:text-sm cursor-pointer">Site Map</a>
                <a href="https://readdy.ai/?origin=logo" className="text-gray-300 hover:text-white text-xs sm:text-sm cursor-pointer">Made with Readdy</a>
              </div>
            </div>
            <p className="text-gray-400 text-xs sm:text-sm">© 2024 RentCottage.Ge, Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      <ContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />

      {/* Cancellation Modal */}
      {showCancellationModal && (
        <CancellationModal
          isOpen={showCancellationModal}
          onClose={() => setShowCancellationModal(false)}
        />
      )}
    </div>
  );
}
