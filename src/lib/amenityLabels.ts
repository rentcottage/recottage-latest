/**
 * Display labels for the amenity vocabulary.
 *
 * Amenity VALUES stay in English everywhere — they're stored verbatim in the DB
 * and matched with includes()/comparison — so only the on-screen label is
 * translated, through the shared `search.*` catalog keys. Search filters, the
 * property page and the listing cards therefore read identically.
 */
export const AMENITY_LABEL_KEY: Record<string, string> = {
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
  'Heating': 'search.amenityHeating',
  'Air Conditioning': 'search.amenityAirConditioning',
};

/**
 * Translated label for one amenity. Unmapped amenities (a host typed their own)
 * fall through to the stored text rather than disappearing.
 */
export function amenityLabel(amenity: string, t: (key: string) => string): string {
  return t(AMENITY_LABEL_KEY[amenity] || amenity);
}

/** Remix line icon per amenity, for the compact icon row on listing cards. */
export const AMENITY_ICON: Record<string, string> = {
  'Hot Tub': 'ri-bubble-chart-line',
  'Swimming Pool': 'ri-drop-line',
  'Fireplace': 'ri-fire-line',
  'Mountain View': 'ri-landscape-line',
  'Lake Access': 'ri-sailboat-line',
  'BBQ Grill': 'ri-knife-line',
  'Pet Friendly': 'ri-bear-smile-line',
  'WiFi': 'ri-wifi-line',
  'Kitchen': 'ri-fridge-line',
  'Parking': 'ri-parking-box-line',
  'Heating': 'ri-temp-hot-line',
  'Air Conditioning': 'ri-snowflake-line',
};

/** Generic icon for a host-typed amenity outside the vocabulary. */
export const AMENITY_ICON_FALLBACK = 'ri-checkbox-circle-line';

/**
 * Amenities in card order: the ones a guest chooses a cottage for come first
 * (the order of AMENITY_ICON), then host-typed ones in their stored order.
 * Duplicates and blanks are dropped.
 */
export function cardAmenityOrder(amenities: string[]): string[] {
  const keys = Object.keys(AMENITY_ICON);
  const rank = (a: string) => (keys.includes(a) ? keys.indexOf(a) : Number.MAX_SAFE_INTEGER);
  return [...new Set(amenities.filter((a) => a && a.trim()))]
    .map((a, i) => ({ a, i }))
    .sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i)
    .map(({ a }) => a);
}
