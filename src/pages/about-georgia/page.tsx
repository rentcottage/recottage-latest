import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import ContactModal from '../../components/feature/ContactModal';
import CancellationModal from '../../components/feature/CancellationModal';
import SEO from '../../components/feature/SEO';

export default function AboutGeorgia() {
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const navigate = useNavigate();

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'About Georgia — Travel Guide to Georgian Culture, Wine & Landscapes',
      description: "Explore Georgia's 8,000-year history, UNESCO World Heritage sites, ancient wine traditions and stunning Caucasus landscapes. Your complete guide to traveling in Georgia.",
      url: `${siteUrl}/about-georgia`,
      isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'TouristDestination',
      name: 'Georgia (Country)',
      description: "A land where ancient traditions meet stunning natural beauty. Georgia offers 8,000 years of winemaking, UNESCO World Heritage sites, Caucasus mountain landscapes and legendary hospitality.",
      url: `${siteUrl}/about-georgia`,
      touristType: ['Cultural Tourism', 'Eco Tourism', 'Wine Tourism', 'Adventure Tourism'],
      includesAttraction: [
        { '@type': 'TouristAttraction', name: 'Kazbegi National Park', address: { '@type': 'PostalAddress', addressCountry: 'GE' } },
        { '@type': 'TouristAttraction', name: 'Mtskheta — UNESCO World Heritage Site', address: { '@type': 'PostalAddress', addressCountry: 'GE' } },
        { '@type': 'TouristAttraction', name: 'Kakheti Wine Region', address: { '@type': 'PostalAddress', addressCountry: 'GE' } },
        { '@type': 'TouristAttraction', name: 'Upper Svaneti — UNESCO World Heritage Site', address: { '@type': 'PostalAddress', addressCountry: 'GE' } },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="About Georgia — Travel Guide to Georgian Culture, Wine & Landscapes | RentCottage.Ge"
        description="Explore Georgia's 8,000-year history, UNESCO World Heritage sites, ancient wine traditions and stunning Caucasus landscapes. Your complete guide to traveling in Georgia."
        keywords="Georgia travel guide, Georgian culture, Caucasus mountains, Georgian wine, Kakheti, Kazbegi, UNESCO Georgia, Georgian cuisine, visit Georgia"
        canonical="/about-georgia"
        ogImage="https://readdy.ai/api/search-image?query=Breathtaking%20panoramic%20view%20of%20Kazbegi%20Georgia%20with%20Gergeti%20Trinity%20Church%20on%20hilltop%20surrounded%20by%20dramatic%20snow-capped%20Caucasus%20mountain%20peaks%2C%20green%20alpine%20meadows%2C%20golden%20hour%20light&width=1200&height=630&seq=og-about-georgia&orientation=landscape"
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero Section */}
      <section className="relative w-full h-[220px] sm:h-[260px] md:h-[500px] overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=ultra%20wide%20panoramic%20pure%20nature%20photograph%20of%20Greater%20Caucasus%20mountain%20range%20Georgia%2C%20massive%20snow-capped%20peaks%20framing%20both%20sides%20of%20the%20image%2C%20vast%20open%20empty%20green%20alpine%20valley%20meadow%20in%20the%20center%20with%20absolutely%20no%20buildings%20no%20structures%20no%20churches%20no%20towers%20no%20people%2C%20wide%20open%20clear%20blue%20sky%20with%20soft%20white%20clouds%20filling%20the%20upper%20center%2C%20calm%20serene%20wilderness%2C%20natural%20realistic%20colors%2C%20golden%20afternoon%20light%2C%20minimalist%20open%20composition%2C%20empty%20center%20for%20text%20overlay%2C%20landscape%20photography&width=1600&height=700&seq=georgia-hero-empty-center-mountains-v4&orientation=landscape"
          alt="Greater Caucasus mountain range Georgia — open alpine valley"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4">
          <h1 className="text-2xl sm:text-3xl md:text-6xl font-bold text-white mb-2 md:mb-4">
            Discover Georgia
          </h1>
          <p className="text-xs sm:text-sm md:text-xl text-white/90 mb-3 md:mb-8 max-w-3xl">
            A land where ancient traditions meet stunning natural beauty, offering unforgettable experiences at every turn
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-6 sm:py-8 md:py-16">

        {/* Quick Navigation */}
        <div className="bg-gray-50 rounded-2xl p-4 md:p-8 mb-6 sm:mb-8 md:mb-16">
          <h2 className="text-base md:text-2xl font-bold text-gray-900 text-center mb-3 sm:mb-4 md:mb-8">Explore Georgia</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { id: 'culture', icon: 'ri-building-2-line', label: 'Culture & History' },
              { id: 'nature', icon: 'ri-mountain-line', label: 'Natural Beauty' },
              { id: 'cuisine', icon: 'ri-restaurant-line', label: 'Cuisine & Wine' },
              { id: 'regions', icon: 'ri-map-pin-line', label: 'Regions to Visit' }
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

        {/* Introduction */}
        <section className="mb-6 sm:mb-8 md:mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 md:gap-12 items-center">
            <div>
              <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-6">Welcome to Georgia</h2>
              <p className="text-xs sm:text-sm md:text-lg text-gray-600 leading-relaxed mb-3 md:mb-6">
                Nestled between Europe and Asia, Georgia is a country of extraordinary diversity and ancient heritage.
                From the snow-capped peaks of the Caucasus Mountains to the subtropical Black Sea coast, Georgia offers
                landscapes that will take your breath away.
              </p>
              <p className="text-xs sm:text-sm md:text-lg text-gray-600 leading-relaxed mb-3 md:mb-6">
                With over 3,000 years of winemaking tradition, UNESCO World Heritage sites, and a culture of legendary
                hospitality, Georgia provides experiences that connect you with both nature and history in the most
                authentic way possible.
              </p>
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 mb-1">8,000+</div>
                  <div className="text-xs sm:text-sm text-gray-600">Years of History</div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 mb-1">525+</div>
                  <div className="text-xs sm:text-sm text-gray-600">Native Grape Varieties</div>
                </div>
              </div>
            </div>
            <div>
              <img
                src="https://readdy.ai/api/search-image?query=Real%20photo%20of%20Georgian%20family%20supra%20traditional%20feast%20with%20authentic%20khachapuri%20khinkali%20dishes%20on%20wooden%20table%2C%20wine%20glasses%2C%20warm%20candlelight%2C%20stone%20wall%20interior%20of%20traditional%20Georgian%20house%2C%20genuine%20hospitality%20scene%2C%20realistic%20food%20photography&width=600&height=400&seq=georgiaIntroReal2025&orientation=landscape"
                alt="Georgian hospitality"
                className="w-full h-52 sm:h-64 md:h-96 object-cover object-top rounded-xl"
              />
            </div>
          </div>
        </section>

        {/* Culture & History Section */}
        <section id="culture" className="mb-6 sm:mb-8 md:mb-16">
          <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-gray-900 mb-4 sm:mb-5 md:mb-8">Rich Culture &amp; Ancient History</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8 md:mb-12">
            {[
              {
                img: 'https://readdy.ai/api/search-image?query=Real%20photograph%20of%20Svetitskhoveli%20Cathedral%20in%20Mtskheta%20Georgia%20ancient%20stone%20Orthodox%20church%20with%20ornate%20carvings%2C%20authentic%20medieval%20Georgian%20architecture%2C%20blue%20sky%20background%2C%20UNESCO%20world%20heritage%20site%2C%20realistic%20travel%20photo&width=400&height=250&seq=culture1Real2025&orientation=landscape',
                alt: 'Georgian Orthodox Church',
                title: 'Orthodox Christianity',
                desc: 'Georgia was one of the first countries to adopt Christianity as its state religion in 337 AD. Ancient churches and monasteries dot the landscape, each telling stories of faith and resilience.'
              },
              {
                img: 'https://static.readdy.ai/image/dfd95a2c135c1a5abfe206bdf152580a/8fcc468dd5e139aeedbef76fce631687.png',
                alt: 'Georgian Polyphonic Singing',
                title: 'Polyphonic Singing',
                desc: 'Georgian polyphonic singing is recognized by UNESCO as a Masterpiece of Oral and Intangible Heritage. This ancient tradition creates hauntingly beautiful harmonies that echo through the mountains.'
              },
              {
                img: 'https://readdy.ai/api/search-image?query=Real%20photograph%20of%20Georgian%20traditional%20Kartuli%20dance%20performance%20with%20women%20in%20elegant%20white%20dresses%20and%20men%20in%20black%20chokha%20costumes%20on%20stage%2C%20authentic%20folk%20dance%2C%20colorful%20cultural%20show%2C%20realistic%20event%20photography&width=400&height=250&seq=culture3Real2025&orientation=landscape',
                alt: 'Georgian Traditional Dance',
                title: 'Traditional Dance',
                desc: 'Georgian dance is a spectacular display of athleticism and grace. From the warrior-like Khorumi to the elegant Kartuli, each dance tells a story of Georgian history and spirit.'
              }
            ].map(({ img, alt, title, desc }) => (
              <div key={title} className="bg-white rounded-xl overflow-hidden border border-gray-100">
                <img src={img} alt={alt} className="w-full h-36 sm:h-44 md:h-48 object-cover object-top" />
                <div className="p-3 sm:p-4 md:p-6">
                  <h3 className="text-sm sm:text-base md:text-xl font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 rounded-xl p-4 md:p-8">
            <h3 className="text-sm sm:text-base md:text-2xl font-semibold text-gray-900 mb-4 md:mb-6">UNESCO World Heritage Sites</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {[
                { icon: 'ri-building-line', title: 'Mtskheta', desc: 'Ancient capital and spiritual heart of Georgia, home to Svetitskhoveli Cathedral' },
                { icon: 'ri-mountain-line', title: 'Upper Svaneti', desc: 'Medieval villages with distinctive stone towers in the Caucasus Mountains' },
                { icon: 'ri-leaf-line', title: 'Colchic Rainforests', desc: 'Ancient temperate rainforests along the Black Sea coast' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="text-center">
                  <div className="w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center">
                      <i className={`${icon} text-lg sm:text-xl md:text-2xl text-blue-600`}></i>
                    </div>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base mb-1 sm:mb-2">{title}</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Natural Beauty Section */}
        <section id="nature" className="mb-6 sm:mb-8 md:mb-16">
          <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-gray-900 mb-4 sm:mb-5 md:mb-8">Spectacular Natural Beauty</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 md:gap-8 mb-6 sm:mb-8 md:mb-12">
            <div>
              <img
                src="https://readdy.ai/api/search-image?query=Real%20photograph%20of%20Greater%20Caucasus%20mountains%20in%20Georgia%20with%20massive%20snow-covered%20peaks%2C%20deep%20green%20valleys%2C%20rocky%20ridges%2C%20clear%20blue%20sky%2C%20authentic%20highland%20wilderness%2C%20realistic%20landscape%20photography%2C%20Kazbegi%20national%20park%20scenery&width=600&height=400&seq=nature1Real2025&orientation=landscape"
                alt="Caucasus Mountains"
                className="w-full h-40 sm:h-48 md:h-80 object-cover object-top rounded-xl mb-2 sm:mb-3 md:mb-6"
              />
              <h3 className="text-sm sm:text-base md:text-2xl font-semibold text-gray-900 mb-1.5 sm:mb-2 md:mb-4">Caucasus Mountains</h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 leading-relaxed">
                The Greater Caucasus range forms Georgia's northern border, offering some of Europe's most pristine wilderness.
                From the glacial peaks of Kazbegi to the alpine meadows of Tusheti, these mountains provide endless opportunities
                for hiking, mountaineering, and connecting with nature.
              </p>
            </div>

            <div>
              <img
                src="https://readdy.ai/api/search-image?query=Real%20photo%20of%20Batumi%20Georgia%20Black%20Sea%20coastline%20with%20pebble%20beach%2C%20turquoise%20sea%20water%2C%20palm%20trees%20along%20boulevard%2C%20modern%20city%20skyline%20in%20background%2C%20subtropical%20coastal%20scenery%2C%20realistic%20travel%20photography&width=600&height=400&seq=nature2Real2025&orientation=landscape"
                alt="Black Sea Coast"
                className="w-full h-40 sm:h-48 md:h-80 object-cover object-top rounded-xl mb-2 sm:mb-3 md:mb-6"
              />
              <h3 className="text-sm sm:text-base md:text-2xl font-semibold text-gray-900 mb-1.5 sm:mb-2 md:mb-4">Black Sea Coast</h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 leading-relaxed">
                Georgia's 310-kilometer Black Sea coastline features a subtropical climate with lush vegetation,
                beautiful beaches, and charming coastal towns. From the vibrant city of Batumi to the ancient
                fortress of Gonio, the coast offers a perfect blend of relaxation and exploration.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[
              { icon: 'ri-mountain-line', title: 'Mountain Peaks', description: '5,047m Shkhara - highest peak in Georgia', color: 'blue' },
              { icon: 'ri-water-line', title: 'Mineral Springs', description: '2,000+ natural hot and cold springs', color: 'green' },
              { icon: 'ri-tree-line', title: 'Protected Areas', description: '20% of territory under protection', color: 'emerald' },
              { icon: 'ri-sun-line', title: 'Climate Zones', description: 'From subtropical to alpine climates', color: 'yellow' }
            ].map((item, index) => (
              <div key={index} className="text-center p-3 sm:p-4 md:p-6 bg-white rounded-xl border border-gray-100">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-${item.color}-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4`}>
                  <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex items-center justify-center">
                    <i className={`${item.icon} text-base sm:text-lg md:text-2xl text-${item.color}-600`}></i>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 text-xs sm:text-sm mb-1">{item.title}</h4>
                <p className="text-gray-600 text-xs">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cuisine & Wine Section */}
        <section id="cuisine" className="mb-6 sm:mb-8 md:mb-16">
          <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-gray-900 mb-4 sm:mb-5 md:mb-8">World-Renowned Cuisine &amp; Wine</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 md:gap-12 items-center mb-6 sm:mb-8 md:mb-12">
            <div>
              <h3 className="text-sm sm:text-base md:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3 md:mb-6">Culinary Traditions</h3>
              <p className="text-xs sm:text-sm md:text-lg text-gray-600 leading-relaxed mb-3 md:mb-6">
                Georgian cuisine is a unique fusion of European and Asian influences, featuring fresh herbs,
                bold spices, and time-honored cooking techniques. Every meal is a celebration, often accompanied
                by heartfelt toasts and traditional songs.
              </p>
              <div className="space-y-2 sm:space-y-3 md:space-y-4">
                {[
                  { name: 'Khachapuri', description: 'Cheese-filled bread, Georgia\'s national dish' },
                  { name: 'Khinkali', description: 'Soup dumplings with meat or cheese filling' },
                  { name: 'Mtsvadi', description: 'Grilled meat skewers with Georgian spices' },
                  { name: 'Churchkhela', description: 'Traditional candy made with grape juice and nuts' }
                ].map((dish, index) => (
                  <div key={index} className="flex items-start">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mt-0.5 mr-2 sm:mr-3 flex-shrink-0">
                      <i className="ri-restaurant-line text-red-500 text-xs sm:text-sm"></i>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 text-xs sm:text-sm">{dish.name}</h4>
                      <p className="text-gray-600 text-xs">{dish.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <img
                src="https://readdy.ai/api/search-image?query=Real%20photo%20of%20authentic%20Georgian%20food%20spread%20with%20freshly%20baked%20khachapuri%20cheese%20bread%2C%20steaming%20khinkali%20dumplings%2C%20grilled%20mtsvadi%20skewers%2C%20fresh%20herbs%2C%20pomegranate%2C%20traditional%20ceramic%20plates%20on%20rustic%20wooden%20table%2C%20realistic%20food%20photography&width=600&height=400&seq=cuisine1Real2025&orientation=landscape"
                alt="Georgian Cuisine"
                className="w-full h-52 sm:h-64 md:h-96 object-cover object-top rounded-xl"
              />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-red-50 rounded-xl p-4 md:p-8">
            <h3 className="text-sm sm:text-base md:text-2xl font-semibold text-gray-900 mb-4 md:mb-6 text-center">The Cradle of Wine</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              {[
                {
                  img: 'https://readdy.ai/api/search-image?query=Real%20photograph%20of%20traditional%20Georgian%20qvevri%20large%20clay%20wine%20vessels%20buried%20in%20earth%20floor%20of%20wine%20cellar%2C%20authentic%20ancient%20winemaking%20method%2C%20Kakheti%20Georgia%20winery%2C%20realistic%20documentary%20photography&width=300&height=200&seq=wine1Real2025&orientation=landscape',
                  alt: 'Qvevri Wine Making',
                  title: '8,000 Years of Winemaking',
                  desc: 'Archaeological evidence shows Georgia has been making wine for over 8,000 years, making it the birthplace of wine.'
                },
                {
                  img: 'https://readdy.ai/api/search-image?query=Real%20photo%20of%20Kakheti%20Georgia%20vineyard%20rows%20with%20ripe%20grape%20clusters%20in%20autumn%2C%20Alazani%20valley%20landscape%2C%20traditional%20Georgian%20wine%20country%2C%20golden%20fall%20colors%2C%20Caucasus%20mountains%20in%20distance%2C%20realistic%20agricultural%20photography&width=300&height=200&seq=wine2Real2025&orientation=landscape',
                  alt: 'Georgian Vineyards',
                  title: '525 Native Grape Varieties',
                  desc: 'Georgia has more indigenous grape varieties than any other country, creating unique wines found nowhere else.'
                },
                {
                  img: 'https://readdy.ai/api/search-image?query=Real%20photograph%20of%20Georgian%20amber%20orange%20wine%20in%20traditional%20horn%20cup%20and%20glass%20on%20wooden%20table%2C%20authentic%20natural%20wine%20tasting%2C%20Kakheti%20winery%20interior%2C%20warm%20candlelight%2C%20realistic%20wine%20photography&width=300&height=200&seq=wine3Real2025&orientation=landscape',
                  alt: 'Wine Tasting',
                  title: 'UNESCO Heritage Method',
                  desc: 'The traditional qvevri winemaking method is recognized by UNESCO as an Intangible Cultural Heritage.'
                }
              ].map(({ img, alt, title, desc }) => (
                <div key={title} className="text-center">
                  <img src={img} alt={alt} className="w-full h-32 sm:h-40 md:h-48 object-cover object-top rounded-lg mb-2 sm:mb-3 md:mb-4" />
                  <h4 className="text-xs sm:text-sm md:text-base font-semibold text-gray-900 mb-1 sm:mb-2">{title}</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Regions Section */}
        <section id="regions" className="mb-6 sm:mb-8 md:mb-16">
          <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-gray-900 mb-4 sm:mb-5 md:mb-8">Regions to Explore</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[
              {
                name: 'Kakheti',
                description: 'Georgia\'s premier wine region with rolling vineyards and historic towns',
                highlights: ['Sighnaghi - City of Love', 'Bodbe Monastery', 'Wine tastings', 'Alazani Valley'],
                image: 'https://readdy.ai/api/search-image?query=Real%20photo%20of%20Sighnaghi%20city%20of%20love%20in%20Kakheti%20Georgia%20with%20colorful%20traditional%20houses%20on%20hilltop%2C%20panoramic%20view%20of%20Alazani%20valley%20and%20Caucasus%20mountains%2C%20authentic%20Georgian%20town%2C%20realistic%20travel%20photography&width=400&height=300&seq=kakhetiReal2025&orientation=landscape'
              },
              {
                name: 'Svaneti',
                description: 'Medieval mountain region with distinctive stone towers and pristine nature',
                highlights: ['Mestia town', 'Ushguli village', 'Svan towers', 'Hiking trails'],
                image: 'https://static.readdy.ai/image/dfd95a2c135c1a5abfe206bdf152580a/c485ec9b8bfc20897469273058c626f2.png'
              },
              {
                name: 'Adjara',
                description: 'Subtropical coastal region with beaches, mountains, and unique culture',
                highlights: ['Batumi city', 'Black Sea beaches', 'Botanical Garden', 'Mountain villages'],
                image: 'https://readdy.ai/api/search-image?query=Real%20photo%20of%20Batumi%20Georgia%20seafront%20boulevard%20with%20modern%20architecture%20alphabet%20tower%2C%20Black%20Sea%20coast%2C%20palm%20trees%2C%20colorful%20buildings%2C%20vibrant%20coastal%20city%2C%20realistic%20urban%20travel%20photography&width=400&height=300&seq=adjaraReal2025&orientation=landscape'
              },
              {
                name: 'Samtskhe-Javakheti',
                description: 'Historic region with ancient fortresses and volcanic landscapes',
                highlights: ['Vardzia cave city', 'Rabati Castle', 'Javakheti Plateau', 'Borjomi springs'],
                image: 'https://readdy.ai/api/search-image?query=Real%20photograph%20of%20Vardzia%20cave%20monastery%20complex%20carved%20into%20volcanic%20cliff%20face%20in%20Georgia%2C%20ancient%20rock-hewn%20city%2C%20multiple%20cave%20rooms%20and%20tunnels%2C%20dramatic%20rocky%20landscape%2C%20authentic%20historical%20site%2C%20realistic%20documentary%20photo&width=400&height=300&seq=samtskhReal2025&orientation=landscape'
              },
              {
                name: 'Mtskheta-Mtianeti',
                description: 'Ancient capital region with UNESCO sites and mountain adventures',
                highlights: ['Mtskheta city', 'Jvari Monastery', 'Kazbegi National Park', 'Gergeti Trinity'],
                image: 'https://readdy.ai/api/search-image?query=Real%20photo%20of%20Gergeti%20Trinity%20Church%20perched%20on%20rocky%20hilltop%20in%20Kazbegi%20Georgia%20with%20massive%20Mount%20Kazbek%20glacier%20peak%20behind%2C%20dramatic%20clouds%2C%20green%20slopes%2C%20iconic%20Georgian%20landmark%2C%20realistic%20landscape%20photography&width=400&height=300&seq=mtskhReal2025&orientation=landscape'
              },
              {
                name: 'Imereti',
                description: 'Central region known for caves, canyons, and cultural treasures',
                highlights: ['Kutaisi city', 'Prometheus Cave', 'Gelati Monastery', 'Okatse Canyon'],
                image: 'https://readdy.ai/api/search-image?query=Real%20photograph%20of%20Prometheus%20Cave%20in%20Imereti%20Georgia%20with%20illuminated%20colorful%20stalactites%20and%20stalagmites%2C%20underground%20river%2C%20dramatic%20cave%20formations%2C%20natural%20wonder%2C%20realistic%20cave%20photography&width=400&height=300&seq=imeretReal2025&orientation=landscape'
              }
            ].map((region, index) => (
              <div key={index} className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-gray-200 transition-all">
                <img
                  src={region.image}
                  alt={region.name}
                  className="w-full h-36 sm:h-44 md:h-48 object-cover object-top"
                />
                <div className="p-3 sm:p-4 md:p-6">
                  <h3 className="text-sm sm:text-base md:text-xl font-semibold text-gray-900 mb-1.5 sm:mb-2 md:mb-3">{region.name}</h3>
                  <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3 md:mb-4">{region.description}</p>
                  <div>
                    <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1.5">Must-See Highlights:</h4>
                    <ul className="space-y-1">
                      {region.highlights.map((highlight, highlightIndex) => (
                        <li key={highlightIndex} className="flex items-center text-xs text-gray-600">
                          <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center mr-1.5 sm:mr-2 flex-shrink-0">
                            <i className="ri-map-pin-line text-red-500 text-xs"></i>
                          </div>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Travel Tips */}
        <section className="bg-gray-50 rounded-2xl p-4 md:p-8 mb-6 sm:mb-8 md:mb-16">
          <h2 className="text-base sm:text-lg md:text-3xl font-bold text-gray-900 text-center mb-4 sm:mb-5 md:mb-8">Essential Travel Information</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-8">
            {[
              { icon: 'ri-calendar-line', color: 'blue', title: 'Best Time to Visit', desc: 'May-October for hiking, December-March for skiing, year-round for wine tours' },
              { icon: 'ri-money-dollar-circle-line', color: 'green', title: 'Currency', desc: 'Georgian Lari (GEL). Credit cards widely accepted in cities' },
              { icon: 'ri-global-line', color: 'purple', title: 'Language', desc: 'Georgian (official), Russian and English widely spoken in tourist areas' },
              { icon: 'ri-passport-line', color: 'red', title: 'Visa Requirements', desc: 'Visa-free for 95+ countries. Check requirements for your nationality' },
            ].map(({ icon, color, title, desc }) => (
              <div key={title} className="text-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-${color}-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4`}>
                  <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex items-center justify-center">
                    <i className={`${icon} text-base sm:text-lg md:text-2xl text-${color}-600`}></i>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 text-xs sm:text-sm mb-1">{title}</h3>
                <p className="text-gray-600 text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center">
          <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">Ready to Experience Georgia?</h2>
          <p className="text-xs sm:text-sm md:text-lg text-gray-600 mb-4 sm:mb-6 md:mb-8 max-w-2xl mx-auto">
            Discover the magic of Georgia by staying in authentic cottages that connect you with local culture and stunning landscapes
          </p>
          <button
            onClick={() => navigate('/search')}
            className="bg-red-500 hover:bg-red-600 text-white px-6 md:px-8 py-2.5 md:py-4 rounded-lg font-medium text-sm md:text-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Find Your Georgian Cottage
          </button>
        </section>
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
                <a href="/corporate" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">Corporate</a>
              </div>
            </div>
            <p className="text-gray-400 text-xs md:text-sm">© 2024 RentCottage.Ge, Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
      <CancellationModal isOpen={showCancellationModal} onClose={() => setShowCancellationModal(false)} />
    </div>
  );
}
