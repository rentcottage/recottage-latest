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
