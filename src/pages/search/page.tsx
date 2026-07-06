import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/feature/Header';
import PropertyCard from '../../components/feature/PropertyCard';
import SearchBar from '../../components/feature/SearchBar';
import SEO from '../../components/feature/SEO';
import { useApprovedProperties } from '../../hooks/useApprovedProperties';
import { locationMatches, regionMatches } from '../../lib/locationNormalizer';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { fetchActivePromos, findPromoForLocation, type Promo } from '../../lib/promos';

// Georgian regions for the Region filter
const GEORGIAN_REGIONS = [
  'Adjara',
  'Guria',
  'Imereti',
  'Kakheti',
  'Kvemo Kartli',
  'Mtskheta-Mtianeti',
  'Racha-Lechkhumi',
  'Samegrelo-Zemo Svaneti',
  'Samtskhe-Javakheti',
  'Shida Kartli',
  'Svaneti',
  'Tbilisi',
];

const PAGE_SIZE = 12;

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { dbProperties, loading: dbLoading } = useApprovedProperties();


  // Full sorted+filtered result set (all matching items)
  const [sortedFilteredProperties, setSortedFilteredProperties] = useState<typeof dbProperties>([]);
  // How many items are currently visible (display-slice pagination)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [showFilters, setShowFilters] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [activePromos, setActivePromos] = useState<Promo[]>([]);

  // Offers & Promos — dormant until FEATURE_FLAGS.ENABLE_PROMOS is flipped on.
  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_PROMOS) return;
    let cancelled = false;
    fetchActivePromos().then((p) => { if (!cancelled) setActivePromos(p); });
    return () => { cancelled = true; };
  }, []);

  // ── Filters live in the URL so they survive navigating into a property and back ──
  // (and make filtered searches shareable/bookmarkable)
  const sortBy = searchParams.get('sort') || 'alphabetical';
  const amenitiesParam = searchParams.get('amenities') || '';
  const typesParam = searchParams.get('types') || '';
  const regionsParam = searchParams.get('regions') || '';
  const priceParam = searchParams.get('price');

  // Memoized so their array identity is stable across renders (keeps the filter effect from looping)
  const selectedAmenities = useMemo(() => (amenitiesParam ? amenitiesParam.split(',') : []), [amenitiesParam]);
  const selectedPropertyTypes = useMemo(() => (typesParam ? typesParam.split(',') : []), [typesParam]);
  const selectedRegions = useMemo(() => (regionsParam ? regionsParam.split(',') : []), [regionsParam]);
  // No price param means "no upper limit" → upper bound tracks the dynamic maxPrice
  const priceRange = useMemo<[number, number]>(
    () => [0, priceParam !== null ? parseInt(priceParam, 10) : maxPrice],
    [priceParam, maxPrice]
  );

  // Write one filter value into the URL. `replace` so each toggle doesn't add a
  // history step, and so the latest filters ride along when navigating to a property.
  const updateFilterParam = (key: string, value: string | string[]) => {
    const next = new URLSearchParams(searchParams);
    if (!value || (Array.isArray(value) && value.length === 0)) next.delete(key);
    else next.set(key, Array.isArray(value) ? value.join(',') : value);
    setSearchParams(next, { replace: true });
  };

  // Derived: the slice currently shown on screen
  const filteredProperties = sortedFilteredProperties.slice(0, visibleCount);
  const hasMore = visibleCount < sortedFilteredProperties.length;
  const totalCount = sortedFilteredProperties.length;

  // Update max price dynamically when properties load
  useEffect(() => {
    if (dbProperties.length > 0) {
      const highest = Math.max(...dbProperties.map((p) => p.price));
      const newMax = Math.ceil(highest / 100) * 100 + 100; // round up to next 100
      setMaxPrice(newMax);
      // No setPriceRange needed: with no `price` param the upper bound derives from maxPrice
    }
  }, [dbProperties]);

  // Mobile search modal local state
  const [modalLocation, setModalLocation] = useState('');
  const [modalCheckIn, setModalCheckIn] = useState('');
  const [modalCheckOut, setModalCheckOut] = useState('');
  const [modalGuests, setModalGuests] = useState('2');

  const location = searchParams.get('location') || '';
  const checkIn = searchParams.get('checkIn') || '';
  const checkOut = searchParams.get('checkOut') || '';
  const guests = searchParams.get('guests') || '2';
  const category = searchParams.get('category') || '';

  // Sync modal state with URL params
  useEffect(() => {
    setModalLocation(location);
    setModalCheckIn(checkIn);
    setModalCheckOut(checkOut);
    setModalGuests(guests);
  }, [checkIn, checkOut, guests, location]);

  const amenitiesList = [
    'WiFi', 'Kitchen', 'Fireplace', 'Mountain View', 'Lake Access', 
    'Pet Friendly', 'BBQ Grill', 'Hot Tub', 'Parking', 'Swimming Pool'
  ];

  useEffect(() => {
    let filtered = [...dbProperties];

    // Filter by location — bilingual matching (Georgian ↔ English)
    if (location) {
      filtered = filtered.filter(property =>
        locationMatches(property.location, location)
      );
    }

    // Filter by category if present — uses the real categories[] field saved during host registration
    if (category) {
      const categoryNormalized = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      filtered = filtered.filter(property => {
        const cats = property.categories || [];
        return cats.some(c => c.toLowerCase() === categoryNormalized.toLowerCase());
      });
    }

    // Filter by guest count — only show properties that can accommodate the selected guests
    if (guests) {
      const guestCount = parseInt(guests, 10);
      filtered = filtered.filter(property =>
        !property.maxGuests || property.maxGuests >= guestCount
      );
    }

    // Filter by price range — only apply upper bound if user has moved the slider below max
    filtered = filtered.filter(property =>
      property.price >= priceRange[0] && (priceRange[1] >= maxPrice || property.price <= priceRange[1])
    );

    // Filter by amenities
    if (selectedAmenities.length > 0) {
      filtered = filtered.filter(property =>
        selectedAmenities.some(amenity => 
          property.amenities.some(propAmenity => 
            propAmenity.toLowerCase().includes(amenity.toLowerCase())
          )
        )
      );
    }

    // Filter by property types
    if (selectedPropertyTypes.length > 0) {
      filtered = filtered.filter(property =>
        selectedPropertyTypes.includes(property.propertyType)
      );
    }

    // Filter by region — bilingual matching (Georgian ↔ English)
    // regionMatches() expands both the filter value and the stored location
    // through all known aliases so Georgian-saved regions match English filters
    // and vice versa.
    if (selectedRegions.length > 0) {
      filtered = filtered.filter(property =>
        selectedRegions.some(region => regionMatches(property.location, region))
      );
    }

    // ── Sort the ENTIRE filtered set BEFORE pagination ──
    // This ensures "Load More" always continues from the globally sorted list.
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'reviews':
        filtered.sort((a, b) => b.reviews - a.reviews);
        break;
      default:
        // Default: always show listings alphabetically (A→Z) by name so search
        // and filter results have a stable, predictable order. Explicit 'ka'
        // locale keeps ordering identical across browsers/SSR; base sensitivity
        // makes it case-insensitive and numeric handles "2" before "10".
        filtered.sort((a, b) =>
          (a.title || '').localeCompare(b.title || '', 'ka', { sensitivity: 'base', numeric: true })
        );
        break;
    }

    // Store the full sorted+filtered set; reset display slice to first page
    setSortedFilteredProperties(filtered);
    setVisibleCount(PAGE_SIZE);
  }, [location, guests, category, priceRange, maxPrice, selectedAmenities, selectedPropertyTypes, selectedRegions, sortBy, dbProperties]);

  const handleAmenityToggle = (amenity: string) => {
    updateFilterParam(
      'amenities',
      selectedAmenities.includes(amenity)
        ? selectedAmenities.filter(a => a !== amenity)
        : [...selectedAmenities, amenity]
    );
  };

  const handlePropertyTypeToggle = (type: string) => {
    updateFilterParam(
      'types',
      selectedPropertyTypes.includes(type)
        ? selectedPropertyTypes.filter(t => t !== type)
        : [...selectedPropertyTypes, type]
    );
  };

  const handleRegionToggle = (region: string) => {
    updateFilterParam(
      'regions',
      selectedRegions.includes(region)
        ? selectedRegions.filter(r => r !== region)
        : [...selectedRegions, region]
    );
  };

  const clearFilters = () => {
    // Drop all filter params, keep only core search criteria
    const newParams = new URLSearchParams();
    if (location) newParams.set('location', location);
    if (checkIn) newParams.set('checkIn', checkIn);
    if (checkOut) newParams.set('checkOut', checkOut);
    if (guests) newParams.set('guests', guests);

    setSearchParams(newParams, { replace: true });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleMobileSearch = () => {
    const newParams = new URLSearchParams(searchParams);
    if (modalLocation) newParams.set('location', modalLocation);
    else newParams.delete('location');
    if (modalCheckIn) newParams.set('checkIn', modalCheckIn);
    else newParams.delete('checkIn');
    if (modalCheckOut) newParams.set('checkOut', modalCheckOut);
    else newParams.delete('checkOut');
    if (modalGuests) newParams.set('guests', modalGuests);
    setSearchParams(newParams);
    setShowSearchModal(false);
  };

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const pageTitle = location
    ? `Cottage Rentals in ${location} — RentCottage.Ge`
    : 'Search Georgian Cottage Rentals — RentCottage.Ge';

  const pageDescription = location
    ? `Browse verified Georgian cottage rentals in ${location}. Filter by price, amenities and property type. Book authentic Georgian cottages and mountain retreats.`
    : 'Browse hundreds of verified Georgian cottages, mountain retreats and lakeside properties. Filter by location, price and amenities. Find your perfect cottage rental in Georgia.';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    description: pageDescription,
    url: `${siteUrl}/search`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={pageTitle}
        description={pageDescription}
        keywords="Georgian cottage search, rent cottage Georgia, vacation rental Georgia, mountain cottage Georgia, traditional Georgian home rental"
        canonical="/search"
        jsonLd={jsonLd}
      />
      <Header />
      
      {/* Search Header — shared background image for ALL screen sizes */}
      <section className="relative z-20">
        {/* Background image — same on mobile and desktop */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://readdy.ai/api/search-image?query=aerial%20view%20of%20Georgian%20Caucasus%20mountain%20valley%20with%20green%20meadows%2C%20soft%20morning%20mist%2C%20pine%20forests%2C%20gentle%20rolling%20hills%2C%20warm%20golden%20light%2C%20very%20soft%20and%20minimal%2C%20no%20people%2C%20wide%20landscape&width=1400&height=220&seq=search-header-bg-v2&orientation=landscape')",
          }}
        />
        {/* Warm gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-stone-800/70 via-stone-700/60 to-amber-900/55" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/20 to-transparent" />

        {/* Desktop: full SearchBar */}
        <div className="hidden md:block relative z-10 max-w-6xl mx-auto px-6 py-7">
          <p className="text-white/80 text-xs font-medium tracking-widest uppercase mb-3 flex items-center gap-2">
            <i className="ri-search-line text-white/60"></i>
            {location
              ? `Showing results for "${location}"`
              : category
              ? `Browsing ${category.charAt(0).toUpperCase() + category.slice(1)} cottages`
              : 'Find your perfect Georgian cottage'}
          </p>
          <SearchBar />
        </div>

        {/* Mobile: compact chips row on top of the same image */}
        <div className="md:hidden relative z-10 px-3 py-4">
          <p className="text-white/70 text-[10px] font-medium tracking-widest uppercase mb-2.5 flex items-center gap-1.5">
            <i className="ri-search-line text-white/50 text-[10px]"></i>
            {location ? `Results for "${location.split(',')[0]}"` : 'Find your perfect cottage'}
          </p>
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full flex items-center bg-white/95 backdrop-blur-sm border border-white/30 rounded-xl overflow-hidden cursor-pointer"
          >
            {/* Where */}
            <div className="flex-1 min-w-0 px-2.5 py-2.5 text-left border-r border-gray-200">
              <div className="text-[10px] font-bold text-gray-500 leading-none mb-0.5">Where</div>
              <div className="text-[10px] font-medium text-gray-800 truncate leading-none">
                {location ? location.split(',')[0] : 'Any'}
              </div>
            </div>
            {/* Check-in */}
            <div className="flex-1 min-w-0 px-2.5 py-2.5 text-left border-r border-gray-200">
              <div className="text-[10px] font-bold text-gray-500 leading-none mb-0.5">Check-in</div>
              <div className="text-[10px] font-medium text-gray-800 truncate leading-none">
                {checkIn ? formatDate(checkIn) : 'Add'}
              </div>
            </div>
            {/* Check-out */}
            <div className="flex-1 min-w-0 px-2.5 py-2.5 text-left border-r border-gray-200">
              <div className="text-[10px] font-bold text-gray-500 leading-none mb-0.5">Check-out</div>
              <div className="text-[10px] font-medium text-gray-800 truncate leading-none">
                {checkOut ? formatDate(checkOut) : 'Add'}
              </div>
            </div>
            {/* Guests */}
            <div className="flex-1 min-w-0 px-2.5 py-2.5 text-left">
              <div className="text-[10px] font-bold text-gray-500 leading-none mb-0.5">Guests</div>
              <div className="text-[10px] font-medium text-gray-800 truncate leading-none" translate="no">
                {`${guests} ${guests === '1' ? 'guest' : 'guests'}`}
              </div>
            </div>
            {/* Search icon */}
            <div className="px-2.5 py-2.5 shrink-0 flex items-center">
              <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center">
                <i className="ri-search-line text-white text-xs"></i>
              </div>
            </div>
          </button>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search Summary */}
        <div className="mb-8">
          <h1 className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
            {category && !location
              ? `${category.charAt(0).toUpperCase() + category.slice(1)} Cottages`
              : location
              ? `Cottages in ${location}${category ? ` — ${category.charAt(0).toUpperCase() + category.slice(1)}` : ''}`
              : 'All Cottages'}
          </h1>
          <div className="flex flex-wrap items-center text-sm text-gray-600 gap-4">
            {checkIn && checkOut && (
              <span>{formatDate(checkIn)} - {formatDate(checkOut)}</span>
            )}
            <span translate="no">{`${guests} ${guests === '1' ? 'guest' : 'guests'}`}</span>
            {selectedRegions.map(region => (
              <button
                key={region}
                onClick={() => handleRegionToggle(region)}
                className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs font-medium px-2.5 py-1 rounded-full border border-red-200 hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-map-pin-line text-xs"></i>
                {region}
                <i className="ri-close-line text-xs"></i>
              </button>
            ))}
            {dbLoading ? (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-3 flex items-center justify-center animate-spin">
                  <i className="ri-loader-4-line"></i>
                </span>
                Loading live listings…
              </span>
            ) : (() => {
              const isFiltered = !!(location || category || selectedAmenities.length > 0 || selectedPropertyTypes.length > 0 || priceRange[1] < maxPrice);
              const displayCount = totalCount;
              const label = isFiltered
                ? `${displayCount} cottage${displayCount !== 1 ? 's' : ''} found`
                : `${displayCount} cottage${displayCount !== 1 ? 's' : ''} available`;
              return (
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
                  {label}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Active promo for the searched location — discount auto-applies at checkout */}
        {FEATURE_FLAGS.ENABLE_PROMOS && location && (() => {
          const searchPromo = findPromoForLocation(activePromos, location);
          if (!searchPromo) return null;
          return (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3.5 mb-6">
              <div className="flex-shrink-0 w-9 h-9 bg-green-500 rounded-lg flex items-center justify-center">
                <i className="ri-price-tag-3-line text-white text-lg"></i>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-green-800 leading-snug">
                  −{searchPromo.discount_percent}% · {searchPromo.title}
                </p>
                <p className="text-xs text-green-700 mt-0.5 leading-snug">
                  Discount applied automatically at checkout on eligible cottages
                  {searchPromo.ends_at && (
                    <> · until {new Date(searchPromo.ends_at + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</>
                  )}
                </p>
              </div>
            </div>
          );
        })()}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar — Desktop only */}
          <div className="hidden lg:block lg:w-72 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl p-5 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm md:text-lg font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-red-500 hover:text-red-600 cursor-pointer"
                >
                  Clear all
                </button>
              </div>

              {/* Price Range */}
              <div className="mb-8">
                <h4 className="font-medium text-gray-900 mb-4">Price Range</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">₾0</span>
                    <span className="text-sm text-gray-600">₾{maxPrice}+</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={maxPrice}
                    value={priceRange[1]}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      updateFilterParam('price', v >= maxPrice ? '' : String(v));
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">₾{priceRange[0]}</span>
                    <span className="font-medium">
                      {priceRange[1] >= maxPrice ? `₾${maxPrice}+` : `₾${priceRange[1]}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="mb-8">
                <h4 className="font-medium text-gray-900 mb-4">Amenities</h4>
                <div className="space-y-3">
                  {amenitiesList.map((amenity) => (
                    <label key={amenity} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAmenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Property Type */}
              <div className="mb-8">
                <h4 className="font-medium text-gray-900 mb-4">Property Type</h4>
                <div className="space-y-3">
                  {['Cottage', 'Cabin', 'House', 'Farmhouse', 'Winery'].map((type) => (
                    <label key={type} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPropertyTypes.includes(type)}
                        onChange={() => handlePropertyTypeToggle(type)}
                        className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Region */}
              <div>
                <h4 className="font-medium text-gray-900 mb-4">Region</h4>
                <div className="space-y-3">
                  {GEORGIAN_REGIONS.map((region) => (
                    <label key={region} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRegions.includes(region)}
                        onChange={() => handleRegionToggle(region)}
                        className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">{region}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="flex-1 min-w-0">
            {/* Sort and View Options */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                {/* Single filter button — mobile only */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap text-gray-900"
                >
                  <div className="w-4 h-4 flex items-center justify-center mr-2 text-gray-900">
                    <i className="ri-filter-line"></i>
                  </div>
                  Filters
                </button>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => updateFilterParam('sort', e.target.value === 'alphabetical' ? '' : e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer pr-8"
                >
                  <option value="alphabetical">Alphabetical (A–Z)</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="reviews">Most Reviews</option>
                </select>
              </div>
            </div>

            {/* Results Grid */}
            {filteredProperties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredProperties.map((property) => (
                  <PropertyCard key={property.id} {...property} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <div className="w-12 h-12 flex items-center justify-center">
                    <i className="ri-search-line text-3xl text-gray-400"></i>
                  </div>
                </div>
                <h3 className="text-base md:text-xl font-semibold text-gray-900 mb-2">
                  {category ? `No ${category} properties available right now.` : 'No cottages found'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {category
                    ? `Check back soon — hosts with ${category.toLowerCase()} properties will appear here once registered.`
                    : 'Try adjusting your search criteria or filters to find more options.'}
                </p>
                <button
                  onClick={clearFilters}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {hasMore && (
              <div className="text-center mt-12">
                <button
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-2"
                >
                  Load More Cottages
                </button>
              </div>
            )}
            {!hasMore && filteredProperties.length > 0 && sortedFilteredProperties.length > PAGE_SIZE && (
              <p className="text-center mt-10 text-sm text-gray-400">All cottages loaded</p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Modal */}
      {showSearchModal && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl">
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-gray-900">Search Details</h3>
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>

              <div className="space-y-4">
                {/* Where */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Where</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <input
                      type="text"
                      value={modalLocation}
                      onChange={(e) => setModalLocation(e.target.value)}
                      placeholder="Search destinations"
                      className="text-sm text-gray-800 bg-transparent border-none outline-none w-full placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Check-in */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Check-in</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <input
                      type="date"
                      value={modalCheckIn}
                      onChange={(e) => setModalCheckIn(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="text-sm text-gray-800 bg-transparent border-none outline-none w-full cursor-pointer"
                    />
                  </div>
                </div>

                {/* Check-out */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Check-out</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <input
                      type="date"
                      value={modalCheckOut}
                      onChange={(e) => setModalCheckOut(e.target.value)}
                      min={modalCheckIn || new Date().toISOString().split('T')[0]}
                      className="text-sm text-gray-800 bg-transparent border-none outline-none w-full cursor-pointer"
                    />
                  </div>
                </div>

                {/* Guests */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Guests</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-800" translate="no">
                      {`${modalGuests} ${modalGuests === '1' ? 'guest' : 'guests'}`}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setModalGuests(Math.max(1, parseInt(modalGuests) - 1).toString())}
                        disabled={modalGuests === '1'}
                        className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer ${
                          modalGuests === '1'
                            ? 'border-gray-200 text-gray-300'
                            : 'border-gray-400 text-gray-600 hover:border-gray-800'
                        }`}
                      >
                        <i className="ri-subtract-line text-sm"></i>
                      </button>
                      <span className="w-6 text-center text-sm font-medium text-gray-900" translate="no">{modalGuests}</span>
                      <button
                        onClick={() => setModalGuests(Math.min(15, parseInt(modalGuests) + 1).toString())}
                        disabled={modalGuests === '15'}
                        className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer ${
                          modalGuests === '15'
                            ? 'border-gray-200 text-gray-300'
                            : 'border-gray-400 text-gray-600 hover:border-gray-800'
                        }`}
                      >
                        <i className="ri-add-line text-sm"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Apply */}
              <button
                onClick={handleMobileSearch}
                className="mt-6 w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-semibold text-sm cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-search-line"></i>
                Search
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filters Modal */}
      {showFilters && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full max-h-[80vh] overflow-y-auto rounded-t-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm md:text-lg font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>

              <div className="space-y-8">
                {/* Price Range */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Price Range</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">₾0</span>
                      <span className="text-sm text-gray-600">₾{maxPrice}+</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={maxPrice}
                      value={priceRange[1]}
                      onChange={(e) => {
                      const v = parseInt(e.target.value);
                      updateFilterParam('price', v >= maxPrice ? '' : String(v));
                    }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">₾{priceRange[0]}</span>
                      <span className="font-medium">
                        {priceRange[1] >= maxPrice ? `₾${maxPrice}+` : `₾${priceRange[1]}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Amenities</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {amenitiesList.map((amenity) => (
                      <label key={amenity} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAmenities.includes(amenity)}
                          onChange={() => handleAmenityToggle(amenity)}
                          className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="ml-3 text-sm text-gray-700">{amenity}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Property Type */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Property Type</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {['Cottage', 'Cabin', 'House', 'Farmhouse', 'Winery'].map((type) => (
                      <label key={type} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPropertyTypes.includes(type)}
                          onChange={() => handlePropertyTypeToggle(type)}
                          className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="ml-3 text-sm text-gray-700">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Region */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Region</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {GEORGIAN_REGIONS.map((region) => (
                      <label key={region} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(region)}
                          onChange={() => handleRegionToggle(region)}
                          className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 leading-tight">{region}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={clearFilters}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex-1 bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Show Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer">Cancellation Options</a></li>
                <li><a href="#" className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer">Contact Us</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-4">Community</h3>
              <ul className="space-y-2">
                <li><a href="/become-host" className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer">Become a Host</a></li>
                <li><a href="#" className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer">Host Resources</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-4">About</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer">How it Works</a></li>
                <li><a href="#" className="text-xs md:text-base text-gray-300 hover:text-white cursor-pointer">About Georgia</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-4">Follow Us</h3>
              <div className="flex space-x-4">
                <a href="https://www.facebook.com/profile.php?id=61583084123461" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer">
                  <i className="ri-facebook-line"></i>
                </a>
                <a href="#" className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer">
                  <i className="ri-instagram-line"></i>
                </a>
                <a href="#" className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer">
                  <i className="ri-twitter-line"></i>
                </a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <h1 className="text-sm md:text-xl font-bold text-red-500 mr-6" style={{ fontFamily: '"Pacifico", serif' }}>
                RentCottage.Ge
              </h1>
              <div className="flex space-x-4 md:space-x-6">
                <a href="/privacy" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">Privacy</a>
                <a href="/terms" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">Terms &amp; Conditions</a>
                <a href="/sitemap" className="text-gray-300 hover:text-white text-xs md:text-sm cursor-pointer">Site Map</a>
              </div>
            </div>
            <p className="text-gray-400 text-xs md:text-sm">© 2024 RentCottage.Ge, Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
