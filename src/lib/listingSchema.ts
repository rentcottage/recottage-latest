/**
 * The structured data for one cottage.
 *
 * WHY IT IS ITS OWN MODULE. This object is emitted twice: into the prerendered
 * HTML at build time (via the Vite plugin in vite.config.ts, which can import
 * TypeScript, and scripts/prerender.mjs, which cannot), and again by SEO.tsx
 * after React mounts. A crawler reads the first, a reader's browser ends up
 * with the second. If the two disagree, the page says one thing to Google and
 * another to anything inspecting the live DOM — so both call this function.
 *
 * SHAPE. `VacationRental` is a `LodgingBusiness`, so it carries priceRange,
 * makesOffer, amenityFeature and aggregateRating directly. `occupancy` and
 * `numberOfRooms` are Accommodation properties, not LodgingBusiness ones, so
 * they hang off `containsPlace` as schema.org and Google's vacation-rental
 * guidance both do it — not on the top node, where they would be invalid.
 *
 * HONESTY. aggregateRating appears only when real reviews exist. Every listing
 * currently has reviews: 0, so today it never appears, and that is correct:
 * the site has no ratings to publish.
 */

export interface SchemaListing {
  id: string;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  address?: string | null;
  price_per_night?: number | string | null;
  bedrooms?: number | null;
  max_guests?: number | null;
  amenities?: string[] | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  cover_photo_url?: string | null;
  photo_urls?: string[] | null;
}

export interface SchemaOptions {
  /** Absolute page URL for this listing. */
  url: string;
  /** Absolute, already-resized image URL. */
  image: string;
  /** Real review count. A rating is published only when this is > 0. */
  reviews?: number;
  /** The average rating those reviews produced. */
  rating?: number | null;
}

/** Georgian lari. The only currency the site prices in. */
export const PRICE_CURRENCY = 'GEL';
/**
 * The listing is offered for booking. It is deliberately NOT a claim about any
 * particular night — per-date availability lives in get_unavailable_ranges and
 * is not what this field means.
 */
export const OFFER_AVAILABILITY = 'https://schema.org/InStock';

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

export function buildListingSchema(listing: SchemaListing, opts: SchemaOptions): Json {
  const price = num(listing.price_per_night);
  const bedrooms = num(listing.bedrooms);
  const guests = num(listing.max_guests);
  const lat = num(listing.latitude);
  const lon = num(listing.longitude);
  const locality = text(listing.location);
  const street = text(listing.address);
  const reviews = num(opts.reviews) ?? 0;
  const rating = num(opts.rating);

  const schema: Json = {
    '@context': 'https://schema.org',
    '@type': 'VacationRental',
    '@id': opts.url,
    name: text(listing.title) ?? 'Cottage',
    url: opts.url,
    image: opts.image,
  };

  const description = text(listing.description);
  if (description) schema.description = description;

  const address: Json = { '@type': 'PostalAddress', addressCountry: 'GE' };
  if (locality) address.addressLocality = locality;
  if (street) address.streetAddress = street;
  schema.address = address;

  if (lat != null && lon != null) {
    schema.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lon };
  }

  // numberOfRooms and occupancy describe the ACCOMMODATION, not the business.
  const accommodation: Json = { '@type': 'Accommodation', name: schema.name };
  if (bedrooms != null) accommodation.numberOfRooms = bedrooms;
  if (guests != null) {
    accommodation.occupancy = {
      '@type': 'QuantitativeValue',
      maxValue: guests,
      unitCode: 'C62', // UN/CEFACT: "one", i.e. a count of people
    };
  }
  if (bedrooms != null || guests != null) schema.containsPlace = accommodation;

  const amenities = Array.isArray(listing.amenities) ? listing.amenities.filter((a) => text(a)) : [];
  if (amenities.length) {
    schema.amenityFeature = amenities.map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    }));
  }

  if (price != null) {
    schema.priceRange = `₾${price}`;
    schema.makesOffer = {
      '@type': 'Offer',
      url: opts.url,
      price,
      priceCurrency: PRICE_CURRENCY,
      availability: OFFER_AVAILABILITY,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price,
        priceCurrency: PRICE_CURRENCY,
        unitCode: 'DAY', // the price is per night
      },
    };
  }

  // Only ever with reviews behind it.
  if (reviews > 0 && rating != null) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating,
      reviewCount: reviews,
    };
  }

  return schema;
}
