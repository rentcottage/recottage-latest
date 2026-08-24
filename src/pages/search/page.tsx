import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import PropertyCard from '../../components/feature/PropertyCard';
import SearchBar from '../../components/feature/SearchBar';
import SEO from '../../components/feature/SEO';
import { useApprovedProperties } from '../../hooks/useApprovedProperties';
import { locationMatches, regionMatches } from '../../lib/locationNormalizer';
import { titleMatches } from '../../lib/propertyNameSearch';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { fetchActivePromos, findPromoForLocation, type Promo } from '../../lib/promos';
import { fetchOfferedProperties, type OfferByProperty } from '../../lib/hostOffers';
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

const PAGE_SIZE = 9;

// Quick-filter chips — curated set mirroring the "new look" mockup.
//
// `amenity`  → drives the existing amenity filter (real data).
// `type`     → drives the existing property-type filter (real data).
// Every chip drives a real filter — nothing here is decorative.
type QuickFilter = { labelKey: string; amenity?: string; type?: string };
const QUICK_FILTERS: QuickFilter[] = [
  { labelKey: 'search.chipHotTub', amenity: 'Hot Tub' },
  { labelKey: 'search.chipFireplace', amenity: 'Fireplace' },
  { labelKey: 'search.chipPool', amenity: 'Swimming Pool' },
  { labelKey: 'search.chipPets', amenity: 'Pet Friendly' },
  { labelKey: 'search.chipWinery', type: 'Winery' },
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

  const [showFilters, setShowFilters] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [activePromos, setActivePromos] = useState<Promo[]>([]);
  const [offeredProperties, setOfferedProperties] = useState<OfferByProperty>({});

  // Offers & Promos — dormant until FEATURE_FLAGS.ENABLE_PROMOS is flipped on.
  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_PROMOS) return;
    let cancelled = false;
    fetchActivePromos().then((p) => { if (!cancelled) setActivePromos(p); });
    return () => { cancelled = true; };
  }, []);

  // Free-night offers, keyed by property — powers both the `?offers=1` filter
  // and the badge stamped on every card that has one.
  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_HOST_OFFERS) return;
    let cancelled = false;
    fetchOfferedProperties().then((o) => { if (!cancelled) setOfferedProperties(o); });
    return () => { cancelled = true; };
  }, []);

  // ── Filters live in the URL so they survive navigating into a property and back ──
  // (and make filtered searches shareable/bookmarkable)
  const sortBy = searchParams.get('sort') || 'alphabetical';
  const amenitiesParam = searchParams.get('amenities') || '';
  const typesParam = searchParams.get('types') || '';
  const regionsParam = searchParams.get('regions') || '';
  const priceParam = searchParams.get('price');
  /** `?offers=1` — the hero's "Stay longer, pay less" pill lands here. */
  const offersOnly = searchParams.get('offers') === '1';
  /** `?promos=1` — the deal chip for location discounts. */
  const promosOnly = searchParams.get('promos') === '1';

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
  const totalCount = sortedFilteredProperties.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  // The pager lives in the URL for the same reason the filters do: open a
  // cottage from page 2 and come back, and you land on page 2 again.
  // Clamped (not stored) so a stale/hand-typed `?page=99` settles on the last
  // real page, and so the value is still right while the results load in.
  const requestedPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const filteredProperties = sortedFilteredProperties.slice(pageStart, pageStart + PAGE_SIZE);

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
  // Order mirrors the mockup so the first six (the un-collapsed rows) read:
  // Wi-Fi, Kitchen, Hot Tub, Fireplace, Pool, Parking.
  const amenitiesList = [
    'WiFi', 'Kitchen', 'Hot Tub', 'Fireplace', 'Swimming Pool', 'Parking',
    'Mountain View', 'Lake Access', 'Pet Friendly', 'BBQ Grill'
  ];

  useEffect(() => {
    let filtered = [...dbProperties];

    // Filter by location — bilingual matching (Georgian ↔ English).
    // The same box also searches listing names, so typing a cottage's name
    // finds that cottage instead of returning nothing.
    // regionMatches() is part of the OR because a location can name a whole
    // region ("რაჭა-ლეჩხუმი", reached from the hero discount pill): its
    // cottages are stored by town ("ამბროლაური", "ონი, სოფ. შქმერი") and
    // never repeat the region, so plain text matching drops them. This is the
    // same rule the region facet and findPromoForLocation() already use, so a
    // cottage that is badged with a discount is always inside the results the
    // discount links to. For a non-region query regionMatches() falls back to
    // locationMatches(), so city searches are unchanged.
    if (location) {
      filtered = filtered.filter(property =>
        locationMatches(property.location, location) ||
        regionMatches(property.location, location) ||
        titleMatches(property.title, location)
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

    // Filter to cottages carrying a live free-night offer (`?offers=1`).
    // Waits for the lookup to land: filtering against an empty map would flash
    // "no results" before the offers arrive.
    if (offersOnly && Object.keys(offeredProperties).length > 0) {
      filtered = filtered.filter(property => Boolean(offeredProperties[property.id]));
    }

    // Filter to cottages covered by an active location discount (`?promos=1`).
    // Same wait-for-the-lookup rule as offers above.
    if (promosOnly && activePromos.length > 0) {
      filtered = filtered.filter(property => Boolean(findPromoForLocation(activePromos, property.location)));
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

    // Store the full sorted+filtered set. Resetting to page 1 is handled by the
    // effect below, which fires only when the filters actually change — this one
    // also runs on mount, and would throw away a `?page=` restored from the URL.
    setSortedFilteredProperties(filtered);
  }, [location, guests, category, priceRange, maxPrice, selectedAmenities, selectedPropertyTypes, selectedRegions, sortBy, dbProperties, offersOnly, offeredProperties, promosOnly, activePromos]);

  // A new result set means the old page number is meaningless, so drop it —
  // but only when the filters really changed. Signature is built from the raw
  // URL values, not the derived ones (priceRange moves on its own when
  // maxPrice settles after the listings load, which isn't a filter change).
  const filterSignature = [
    location, guests, category, priceParam ?? '', amenitiesParam, typesParam,
    regionsParam, sortBy, offersOnly ? '1' : '', promosOnly ? '1' : '',
  ].join('|');
  const lastFilterSignature = useRef(filterSignature);
  useEffect(() => {
    if (lastFilterSignature.current === filterSignature) return;
    lastFilterSignature.current = filterSignature;
    setSearchParams((prev) => {
      if (!prev.get('page')) return prev;
      const next = new URLSearchParams(prev);
      next.delete('page');
      return next;
    }, { replace: true });
  }, [filterSignature, setSearchParams]);

  // ── Facet counts (REAL data) ──────────────────────────────────────────────
  // How many listings each option would match, using the same predicates the
  // filters themselves use. Counted over the whole approved set, so a count
  // doesn't shrink as you tick other boxes.
  const facetCounts = useMemo(() => {
    const amenity: Record<string, number> = {};
    const type: Record<string, number> = {};
    const region: Record<string, number> = {};
    amenitiesList.forEach((a) => {
      amenity[a] = dbProperties.filter((p) =>
        p.amenities.some((pa) => pa.toLowerCase().includes(a.toLowerCase()))
      ).length;
    });
    PROPERTY_TYPES.forEach((ty) => {
      type[ty] = dbProperties.filter((p) => p.propertyType === ty).length;
    });
    GEORGIAN_REGIONS.forEach((r) => {
      region[r] = dbProperties.filter((p) => regionMatches(p.location, r)).length;
    });
    return { amenity, type, region };
  }, [dbProperties]);

  // Mockup collapses long filter lists to six rows behind a "show more" link.
  const FILTER_COLLAPSE_AT = 6;
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);

  // Pager: jump to a page and scroll the results back into view.
  // `replace` matches the filters: paging doesn't pile up history steps, but
  // the page number rides along when you navigate into a property.
  const goToPage = (page: number) => {
    const next = Math.min(Math.max(1, page), totalPages);
    if (next === currentPage) return;
    const params = new URLSearchParams(searchParams);
    if (next === 1) params.delete('page');
    else params.set('page', String(next));
    setSearchParams(params, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Page buttons with ellipsis: 1 … n-1 [n] n+1 … last (mockup's "1 2 3 … 15").
  const pageItems = useMemo<(number | 'gap')[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    if (currentPage <= 3) [2, 3, 4].forEach((n) => set.add(n));
    if (currentPage >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((n) => set.add(n));
    const pages = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    const out: (number | 'gap')[] = [];
    pages.forEach((n, i) => {
      if (i > 0 && n - pages[i - 1] > 1) out.push('gap');
      out.push(n);
    });
    return out;
  }, [currentPage, totalPages]);

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

  /** Local calendar date as YYYY-MM-DD — see the note in SearchBar: toISOString()
   *  shifts to UTC and returns the previous day in Georgia's timezone. */
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const todayStr = () => toDateStr(new Date());

  /** The day after `date` — a stay has to end later than it starts. */
  const dayAfterStr = (date: string) => {
    if (!date) return todayStr();
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return toDateStr(d);
  };

  /**
   * Same rule as the header search bar: a check-in that moves past the chosen
   * check-out clears it, because `min` only limits the next pick and never
   * re-checks a date chosen earlier.
   */
  const handleModalCheckIn = (value: string) => {
    setModalCheckIn(value);
    setModalCheckOut((prev) => (prev && prev <= value ? '' : prev));
  };

  const handleMobileSearch = () => {
    const newParams = new URLSearchParams(searchParams);
    if (modalLocation) newParams.set('location', modalLocation);
    else newParams.delete('location');
    if (modalCheckIn) newParams.set('checkIn', modalCheckIn);
    else newParams.delete('checkIn');
    // Typing straight into a date field bypasses `min`, so re-check the range.
    if (modalCheckOut && (!modalCheckIn || modalCheckOut > modalCheckIn)) newParams.set('checkOut', modalCheckOut);
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
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
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

          {/* Quick-filter chips — mockup's curated set (10px gap, 7px/15px padding) */}
          <div className="flex flex-wrap justify-center gap-2.5 mt-3 pb-0.5">
            {QUICK_FILTERS.map((f) => {
              const on = f.type
                ? selectedPropertyTypes.includes(f.type)
                : selectedAmenities.includes(f.amenity!);
              return (
                <button
                  key={f.labelKey}
                  onClick={() => {
                    if (f.type) handlePropertyTypeToggle(f.type);
                    else handleAmenityToggle(f.amenity!);
                  }}
                  className={`shrink-0 border-[1.5px] rounded-full px-[15px] py-[7px] text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    on
                      ? 'bg-red-50 border-red-500 text-red-500'
                      : 'bg-white border-line text-gray-700 hover:border-red-500 hover:text-red-500'
                  }`}
                >
                  {t(f.labelKey)}
                </button>
              );
            })}

            {/* Deal chips. Kept in the same row as the amenity chips so that
                clearing the filters still leaves a visible way back to the
                deals, but coloured green rather than red — they filter by
                price advantage, not by feature. Each renders only when that
                kind of deal actually exists, so a chip can never lead to an
                empty result set. */}
            {FEATURE_FLAGS.ENABLE_PROMOS && activePromos.length > 0 && (
              <button
                onClick={() => updateFilterParam('promos', promosOnly ? '' : '1')}
                className={`shrink-0 inline-flex items-center gap-1.5 border-[1.5px] rounded-full px-[15px] py-[7px] text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  promosOnly
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-white border-green-500 text-green-700 hover:bg-green-50'
                }`}
              >
                <i className="ri-price-tag-3-line text-[15px]"></i>
                {t('search.chipPromos')}
              </button>
            )}
            {FEATURE_FLAGS.ENABLE_HOST_OFFERS && Object.keys(offeredProperties).length > 0 && (
              <button
                onClick={() => updateFilterParam('offers', offersOnly ? '' : '1')}
                className={`shrink-0 inline-flex items-center gap-1.5 border-[1.5px] rounded-full px-[15px] py-[7px] text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  offersOnly
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-emerald-500 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <i className="ri-gift-line text-[15px]"></i>
                {t('search.chipOffers')}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-6 py-8">
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

              {/* Amenities — collapsed to 6 rows (mockup) */}
              <div className="border-t border-line pt-4 pb-1">
                <h4 className="text-sm font-bold text-ink mb-3">{t('search.amenitiesTitle')}</h4>
                <div className="space-y-2.5">
                  {(showAllAmenities ? amenitiesList : amenitiesList.slice(0, FILTER_COLLAPSE_AT)).map((amenity) => (
                    <label key={amenity} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAmenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className="w-[17px] h-[17px] accent-red-500 text-red-500 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="ml-2.5 text-sm text-gray-700">{t(AMENITY_LABEL_KEY[amenity] || amenity)}</span>
                      <span className="ml-auto text-xs text-soft" translate="no">{facetCounts.amenity[amenity] ?? 0}</span>
                    </label>
                  ))}
                </div>
                {amenitiesList.length > FILTER_COLLAPSE_AT && (
                  <button
                    onClick={() => setShowAllAmenities((v) => !v)}
                    className="mt-3 text-[13px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
                  >
                    {showAllAmenities ? t('search.showLess') : t('search.showMore')}
                  </button>
                )}
              </div>

              {/* Property Type */}
              <div className="border-t border-line pt-4 pb-1">
                <h4 className="text-sm font-bold text-ink mb-3">{t('search.propertyTypeTitle')}</h4>
                <div className="space-y-2.5">
                  {PROPERTY_TYPES.map((type) => (
                    <label key={type} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPropertyTypes.includes(type)}
                        onChange={() => handlePropertyTypeToggle(type)}
                        className="w-[17px] h-[17px] accent-red-500 text-red-500 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="ml-2.5 text-sm text-gray-700">{t(TYPE_LABEL_KEY[type] || type)}</span>
                      <span className="ml-auto text-xs text-soft" translate="no">{facetCounts.type[type] ?? 0}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Region — collapsed to 6 rows (mockup) */}
              <div className="border-t border-line pt-4 pb-1">
                <h4 className="text-sm font-bold text-ink mb-3">{t('search.regionTitle')}</h4>
                <div className="space-y-2.5">
                  {(showAllRegions ? GEORGIAN_REGIONS : GEORGIAN_REGIONS.slice(0, FILTER_COLLAPSE_AT)).map((region) => (
                    <label key={region} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRegions.includes(region)}
                        onChange={() => handleRegionToggle(region)}
                        className="w-[17px] h-[17px] accent-red-500 text-red-500 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="ml-2.5 text-sm text-gray-700">{t(REGION_LABEL_KEY[region] || region)}</span>
                      <span className="ml-auto text-xs text-soft" translate="no">{facetCounts.region[region] ?? 0}</span>
                    </label>
                  ))}
                </div>
                {GEORGIAN_REGIONS.length > FILTER_COLLAPSE_AT && (
                  <button
                    onClick={() => setShowAllRegions((v) => !v)}
                    className="mt-3 text-[13px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
                  >
                    {showAllRegions ? t('search.showLess') : t('search.showAllRegions')}
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Results Section — pulled up on desktop so the sort control lines up
              with the guests / available-cottages line above the filter panel. */}
          <div className="flex-1 min-w-0 lg:-mt-16">
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

            {/* Deal banners. They live INSIDE the results column, below the
                sort row: the column carries lg:-mt-16 to lift that row up
                beside the page heading, and a full-width banner above it
                landed underneath the sort control.

                One flex row so both deals sit side by side, each only as wide
                as its own text. They wrap to their own line on narrow screens,
                and a lone banner simply takes the width it needs. */}
            <div className="flex flex-wrap items-stretch gap-3 mb-6 empty:hidden">
            {FEATURE_FLAGS.ENABLE_PROMOS && (location || promosOnly) && (() => {
              // With a location, the promo covering it; with only the chip on,
              // the best active promo (fetchActivePromos sorts best-first).
              const searchPromo = location
                ? findPromoForLocation(activePromos, location)
                : activePromos[0] ?? null;
              if (!searchPromo) return null;
              return (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <i className="ri-price-tag-3-line text-white text-base"></i>
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

            {/* `?offers=1` is on — say so, and give a one-click way back out. */}
            {FEATURE_FLAGS.ENABLE_HOST_OFFERS && offersOnly && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <i className="ri-gift-line text-white text-base"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-800 leading-snug">{t('search.offersFilterTitle')}</p>
                  <p className="text-xs text-emerald-700 mt-0.5 leading-snug">{t('search.offersFilterSub')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete('offers');
                    setSearchParams(next);
                  }}
                  className="flex-shrink-0 ml-1 text-xs font-bold text-emerald-800 underline hover:no-underline cursor-pointer whitespace-nowrap"
                >
                  {t('search.offersFilterClear')}
                </button>
              </div>
            )}
            </div>

            {/* Results Grid */}
            {filteredProperties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[22px]">
                {filteredProperties.map((property) => (
                  <PropertyCard
                    key={property.id}
                    {...property}
                    promoPercent={findPromoForLocation(activePromos, property.location)?.discount_percent ?? null}
                    offerNights={offeredProperties[property.id] ?? null}
                  />
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

            {/* Numbered pager (mockup) — real pagination over the result set */}
            {totalPages > 1 && (
              <nav className="flex justify-center gap-2 mt-[38px]" aria-label="Pagination">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label={t('search.pagerPrev')}
                  className="w-10 h-10 rounded-[10px] border-[1.5px] border-line bg-white text-sm font-bold text-gray-700 cursor-pointer transition-colors hover:border-red-500 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-line disabled:hover:text-gray-700"
                >
                  ‹
                </button>

                {pageItems.map((item, i) =>
                  item === 'gap' ? (
                    <span key={`gap-${i}`} className="w-10 h-10 flex items-center justify-center text-sm font-bold text-gray-400 select-none">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => goToPage(item)}
                      aria-current={item === currentPage ? 'page' : undefined}
                      className={`w-10 h-10 rounded-[10px] border-[1.5px] text-sm font-bold cursor-pointer transition-colors ${
                        item === currentPage
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'bg-white border-line text-gray-700 hover:border-red-500 hover:text-red-500'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label={t('search.pagerNext')}
                  className="w-10 h-10 rounded-[10px] border-[1.5px] border-line bg-white text-sm font-bold text-gray-700 cursor-pointer transition-colors hover:border-red-500 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-line disabled:hover:text-gray-700"
                >
                  ›
                </button>
              </nav>
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
                      onChange={(e) => handleModalCheckIn(e.target.value)}
                      min={todayStr()}
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
                      min={modalCheckIn ? dayAfterStr(modalCheckIn) : todayStr()}
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
