import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import PropertyCard from '../../components/feature/PropertyCard';
import SearchBar from '../../components/feature/SearchBar';
import SEO from '../../components/feature/SEO';
import { useApprovedProperties } from '../../hooks/useApprovedProperties';
import { locationMatches, regionMatches } from '../../lib/locationNormalizer';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { fetchActivePromos, findPromoForLocation, type Promo } from '../../lib/promos';
import { useT } from '../../i18n';

// Georgian regions for the Region filter. Values stay in English — they're
// matched bilingually against stored listings via `regionMatches()` — only the
// on-screen label is translated (see REGION_LABEL_KEY below).
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

const REGION_LABEL_KEY: Record<string, string> = {
  'Adjara': 'search.regionAdjara',
  'Guria': 'search.regionGuria',
  'Imereti': 'search.regionImereti',
  'Kakheti': 'search.regionKakheti',
  'Kvemo Kartli': 'search.regionKvemoKartli',
  'Mtskheta-Mtianeti': 'search.regionMtskhetaMtianeti',
  'Racha-Lechkhumi': 'search.regionRachaLechkhumi',
  'Samegrelo-Zemo Svaneti': 'search.regionSamegreloZemoSvaneti',
  'Samtskhe-Javakheti': 'search.regionSamtskheJavakheti',
  'Shida Kartli': 'search.regionShidaKartli',
  'Svaneti': 'search.regionSvaneti',
  'Tbilisi': 'search.regionTbilisi',
};

const PAGE_SIZE = 12;

// Quick-filter chips — each maps to a real value in `amenitiesList` so a chip
// toggle drives the existing amenity filter state (no new filter logic). The
// `amenity` value stays in English (matched against stored listing data);
// only the rendered `labelKey` is translated.
const QUICK_FILTERS: { labelKey: string; amenity: string }[] = [
  { labelKey: 'search.amenityHotTub', amenity: 'Hot Tub' },
  { labelKey: 'search.amenityFireplace', amenity: 'Fireplace' },
  { labelKey: 'search.amenitySwimmingPool', amenity: 'Swimming Pool' },
  { labelKey: 'search.amenityPetFriendly', amenity: 'Pet Friendly' },
  { labelKey: 'search.amenityWifi', amenity: 'WiFi' },
  { labelKey: 'search.amenityKitchen', amenity: 'Kitchen' },
  { labelKey: 'search.amenityBbqGrill', amenity: 'BBQ Grill' },
  { labelKey: 'search.amenityMountainView', amenity: 'Mountain View' },
];

// Amenity + property-type filter VALUES stay in English (matched against
// stored listing data via includes()/comparison) — only the displayed label
// is translated, via these lookup maps.
const AMENITY_LABEL_KEY: Record<string, string> = {
  'WiFi': 'search.amenityWifi',
  'Kitchen': 'search.amenityKitchen',
  'Fireplace': 'search.amenityFireplace',
  'Mountain View': 'search.amenityMountainView',
  'Lake Access': 'search.amenityLakeAccess',
  'Pet Friendly': 'search.amenityPetFriendly',
  'BBQ Grill': 'search.amenityBbqGrill',
  'Hot Tub': 'search.amenityHotTub',
  'Parking': 'search.amenityParking',
  'Swimming Pool': 'search.amenitySwimmingPool',
};

const PROPERTY_TYPES = ['Cottage', 'Cabin', 'House', 'Farmhouse', 'Winery'];
const TYPE_LABEL_KEY: Record<string, string> = {
  'Cottage': 'search.typeCottage',
  'Cabin': 'search.typeCabin',
  'House': 'search.typeHouse',
  'Farmhouse': 'search.typeFarmhouse',
  'Winery': 'search.typeWinery',
};

export default function SearchResults() {
  const { t, plural } = useT();
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

  // Values stay in English (matched against stored listing data); AMENITY_LABEL_KEY translates the display.
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

  // SEO meta stays hardcoded English (matches convention on every other wired page).
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
      
      {/* Search zone — white compact bar + quick-filter chips (mockup "new look") */}
      <section className="bg-white border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          {/* Desktop: full SearchBar */}
          <div className="hidden md:block">
            <SearchBar />
          </div>

          {/* Mobile: compact search trigger → opens the search modal */}
          <div className="md:hidden">
            <button
              onClick={() => setShowSearchModal(true)}
              className="w-full flex items-center bg-white border border-line shadow-card rounded-full overflow-hidden cursor-pointer"
            >
              {/* Where */}
              <div className="flex-1 min-w-0 px-3 py-2.5 text-left border-r border-line">
                <div className="text-[10px] font-bold text-gray-500 leading-none mb-0.5">{t('search.whereLabel')}</div>
                <div className="text-[10px] font-medium text-gray-800 truncate leading-none">
                  {location ? location.split(',')[0] : t('search.any')}
                </div>
              </div>
              {/* Check-in */}
              <div className="flex-1 min-w-0 px-3 py-2.5 text-left border-r border-line">
                <div className="text-[10px] font-bold text-gray-500 leading-none mb-0.5">{t('search.checkInLabel')}</div>
                <div className="text-[10px] font-medium text-gray-800 truncate leading-none">
                  {checkIn ? formatDate(checkIn) : t('search.add')}
                </div>
              </div>
              {/* Check-out */}
              <div className="flex-1 min-w-0 px-3 py-2.5 text-left border-r border-line">
                <div className="text-[10px] font-bold text-gray-500 leading-none mb-0.5">{t('search.checkOutLabel')}</div>
                <div className="text-[10px] font-medium text-gray-800 truncate leading-none">
                  {checkOut ? formatDate(checkOut) : t('search.add')}
                </div>
              </div>
              {/* Guests */}
              <div className="flex-1 min-w-0 px-3 py-2.5 text-left">
                <div className="text-[10px] font-bold text-gray-500 leading-none mb-0.5">{t('search.guestsLabel')}</div>
                <div className="text-[10px] font-medium text-gray-800 truncate leading-none" translate="no">
                  {plural('searchBar.guest', parseInt(guests, 10) || 0)}
                </div>
              </div>
              {/* Search icon */}
              <div className="px-2.5 shrink-0 self-stretch flex items-center bg-red-500">
                <i className="ri-search-line text-white text-sm"></i>
              </div>
            </button>
          </div>

          {/* Quick-filter chips — wired to the existing amenity filter */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-0.5 -mx-1 px-1">
            {QUICK_FILTERS.map((f) => {
              const on = selectedAmenities.includes(f.amenity);
              return (
                <button
                  key={f.amenity}
                  onClick={() => handleAmenityToggle(f.amenity)}
                  className={`shrink-0 border-[1.5px] rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    on
                      ? 'bg-red-50 border-red-500 text-red-500'
                      : 'bg-white border-line text-gray-700 hover:border-red-500 hover:text-red-500'
                  }`}
                >
                  {t(f.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search Summary */}
        <div className="mb-8">
          <h1 className="text-xl md:text-[26px] font-extrabold text-ink tracking-tight mb-2">
            {category && !location
              ? t('search.categoryCottages', { category: category.charAt(0).toUpperCase() + category.slice(1) })
              : location
              ? category
                ? t('search.cottagesInCategory', { location, category: category.charAt(0).toUpperCase() + category.slice(1) })
                : t('search.cottagesIn', { location })
              : t('search.allCottages')}
          </h1>
          <div className="flex flex-wrap items-center text-sm text-gray-600 gap-4">
            {checkIn && checkOut && (
              <span>{formatDate(checkIn)} - {formatDate(checkOut)}</span>
            )}
            <span translate="no">{plural('searchBar.guest', parseInt(guests, 10) || 0)}</span>
            {selectedRegions.map(region => (
              <button
                key={region}
                onClick={() => handleRegionToggle(region)}
                className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs font-medium px-2.5 py-1 rounded-full border border-red-200 hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-map-pin-line text-xs"></i>
                {t(REGION_LABEL_KEY[region] || region)}
                <i className="ri-close-line text-xs"></i>
              </button>
            ))}
            {dbLoading ? (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-3 flex items-center justify-center animate-spin">
                  <i className="ri-loader-4-line"></i>
                </span>
                {t('search.loadingLive')}
              </span>
            ) : (() => {
              const isFiltered = !!(location || category || selectedAmenities.length > 0 || selectedPropertyTypes.length > 0 || priceRange[1] < maxPrice);
              const displayCount = totalCount;
              const label = isFiltered
                ? plural('search.cottagesFoundCount', displayCount)
                : plural('search.cottagesAvailableCount', displayCount);
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
                  {t('search.promoNote')}
                  {searchPromo.ends_at && (
                    <> · {t('search.promoUntil', { date: new Date(searchPromo.ends_at + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) })}</>
                  )}
                </p>
              </div>
            </div>
          );
        })()}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar — Desktop only */}
          <div className="hidden lg:block lg:w-72 flex-shrink-0">
            <div className="bg-white border border-line rounded-card p-[22px] sticky top-24">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[17px] font-extrabold text-ink">{t('search.filtersTitle')}</h3>
                <button
                  onClick={clearFilters}
                  className="text-[13px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
                >
                  {t('search.clearAll')}
                </button>
              </div>

              {/* Price Range */}
              <div className="pb-5">
                <h4 className="text-sm font-bold text-ink mb-3">{t('search.priceRangeTitle')}</h4>
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
              <div className="border-t border-line pt-4 pb-1">
                <h4 className="text-sm font-bold text-ink mb-3">{t('search.amenitiesTitle')}</h4>
                <div className="space-y-3">
                  {amenitiesList.map((amenity) => (
                    <label key={amenity} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAmenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">{t(AMENITY_LABEL_KEY[amenity] || amenity)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Property Type */}
              <div className="border-t border-line pt-4 pb-1">
                <h4 className="text-sm font-bold text-ink mb-3">{t('search.propertyTypeTitle')}</h4>
                <div className="space-y-3">
                  {PROPERTY_TYPES.map((type) => (
                    <label key={type} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPropertyTypes.includes(type)}
                        onChange={() => handlePropertyTypeToggle(type)}
                        className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">{t(TYPE_LABEL_KEY[type] || type)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Region */}
              <div className="border-t border-line pt-4">
                <h4 className="text-sm font-bold text-ink mb-3">{t('search.regionTitle')}</h4>
                <div className="space-y-3">
                  {GEORGIAN_REGIONS.map((region) => (
                    <label key={region} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRegions.includes(region)}
                        onChange={() => handleRegionToggle(region)}
                        className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">{t(REGION_LABEL_KEY[region] || region)}</span>
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
                  className="lg:hidden flex items-center px-4 py-2 border-[1.5px] border-ink rounded-[10px] font-bold text-sm text-ink hover:bg-ink hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  <div className="w-4 h-4 flex items-center justify-center mr-2">
                    <i className="ri-filter-line"></i>
                  </div>
                  {t('search.filtersTitle')}
                </button>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-sm text-soft hidden sm:inline">{t('search.sortByLabel')}</span>
                <select
                  value={sortBy}
                  onChange={(e) => updateFilterParam('sort', e.target.value === 'alphabetical' ? '' : e.target.value)}
                  className="border-[1.5px] border-line rounded-[10px] px-3 py-2 text-sm text-ink bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer pr-8"
                >
                  <option value="alphabetical">{t('search.sortAlphabetical')}</option>
                  <option value="price-low">{t('search.sortPriceLow')}</option>
                  <option value="price-high">{t('search.sortPriceHigh')}</option>
                  <option value="rating">{t('search.sortRating')}</option>
                  <option value="reviews">{t('search.sortReviews')}</option>
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
                  {category ? t('search.noResultsCategoryTitle', { category }) : t('search.noResultsTitle')}
                </h3>
                <p className="text-gray-600 mb-6">
                  {category
                    ? t('search.noResultsCategoryDesc', { category: category.toLowerCase() })
                    : t('search.noResultsDesc')}
                </p>
                <button
                  onClick={clearFilters}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('search.clearFiltersBtn')}
                </button>
              </div>
            )}

            {hasMore && (
              <div className="text-center mt-12">
                <button
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="bg-white border-[1.5px] border-line text-ink px-8 py-3 rounded-[10px] font-bold hover:border-red-500 hover:text-red-500 transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-2"
                >
                  {t('search.loadMore')}
                </button>
              </div>
            )}
            {!hasMore && filteredProperties.length > 0 && sortedFilteredProperties.length > PAGE_SIZE && (
              <p className="text-center mt-10 text-sm text-gray-400">{t('search.allLoaded')}</p>
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
                <h3 className="text-sm font-semibold text-gray-900">{t('search.searchDetails')}</h3>
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{t('search.whereLabel')}</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <input
                      type="text"
                      value={modalLocation}
                      onChange={(e) => setModalLocation(e.target.value)}
                      placeholder={t('search.wherePlaceholder')}
                      className="text-sm text-gray-800 bg-transparent border-none outline-none w-full placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Check-in */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{t('search.checkInLabel')}</label>
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{t('search.checkOutLabel')}</label>
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{t('search.guestsLabel')}</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-800" translate="no">
                      {plural('searchBar.guest', parseInt(modalGuests, 10) || 0)}
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
                {t('search.searchBtn')}
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
                <h3 className="text-sm md:text-lg font-semibold text-gray-900">{t('search.filtersTitle')}</h3>
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
                  <h4 className="font-medium text-gray-900 mb-4">{t('search.priceRangeTitle')}</h4>
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
                  <h4 className="font-medium text-gray-900 mb-4">{t('search.amenitiesTitle')}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {amenitiesList.map((amenity) => (
                      <label key={amenity} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAmenities.includes(amenity)}
                          onChange={() => handleAmenityToggle(amenity)}
                          className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="ml-3 text-sm text-gray-700">{t(AMENITY_LABEL_KEY[amenity] || amenity)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Property Type */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">{t('search.propertyTypeTitle')}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {PROPERTY_TYPES.map((type) => (
                      <label key={type} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPropertyTypes.includes(type)}
                          onChange={() => handlePropertyTypeToggle(type)}
                          className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="ml-3 text-sm text-gray-700">{t(TYPE_LABEL_KEY[type] || type)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Region */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">{t('search.regionTitle')}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {GEORGIAN_REGIONS.map((region) => (
                      <label key={region} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(region)}
                          onChange={() => handleRegionToggle(region)}
                          className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 leading-tight">{t(REGION_LABEL_KEY[region] || region)}</span>
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
                  {t('search.clearAllBtn')}
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex-1 bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('search.showResults')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer — shared component */}
      <Footer />
    </div>
  );
}
