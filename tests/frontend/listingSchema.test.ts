// The structured data one cottage publishes.
//
// This object is emitted twice — into the prerendered HTML during `vite build`
// and again by SEO.tsx after hydration — from this one builder, so what these
// tests pin holds on both sides at once.
//
// Run: node --test tests/frontend/listingSchema.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFER_AVAILABILITY,
  PRICE_CURRENCY,
  buildListingSchema,
  type SchemaListing,
} from '../../src/lib/listingSchema.ts';

const URL_ = 'https://rentcottage.ge/property/26269de3-dd0f-4272-802c-139646a93180';
const IMG = 'https://cdn.example.test/render/cover.jpg?width=1200&height=630';

const listing = (over: Partial<SchemaListing> = {}): SchemaListing => ({
  id: '26269de3-dd0f-4272-802c-139646a93180',
  title: 'Vakhrama',
  description: 'A quiet wooden cottage with a garden.',
  location: 'Abastumani, Samtskhe-Javakheti',
  address: '12 Mountain Road',
  price_per_night: 220,
  bedrooms: 4,
  max_guests: 8,
  amenities: ['WiFi', 'Parking'],
  latitude: 41.75,
  longitude: 42.84,
  ...over,
});

const build = (over: Partial<SchemaListing> = {}, opts = {}) =>
  buildListingSchema(listing(over), { url: URL_, image: IMG, reviews: 0, rating: null, ...opts });

// ── The honesty rule ─────────────────────────────────────────────────────────

test('RATING no aggregateRating without reviews behind it', () => {
  for (const opts of [{ reviews: 0, rating: 5 }, { reviews: 0, rating: null }, { reviews: undefined }]) {
    const s = build({}, opts);
    assert.equal('aggregateRating' in s, false, JSON.stringify(opts));
  }
  // Every listing in production is reviews: 0 today, so this is the live case.
  assert.equal('aggregateRating' in build(), false);
});

test('RATING a rating is published once real reviews exist', () => {
  const s = build({}, { reviews: 12, rating: 4.8 });
  assert.deepEqual(s.aggregateRating, {
    '@type': 'AggregateRating', ratingValue: 4.8, reviewCount: 12,
  });
});

// ── Offer ────────────────────────────────────────────────────────────────────

test('OFFER price, GEL and a schema.org availability enum', () => {
  const offer = build().makesOffer;
  assert.equal(offer['@type'], 'Offer');
  assert.equal(offer.price, 220);
  assert.equal(offer.priceCurrency, 'GEL');
  assert.equal(PRICE_CURRENCY, 'GEL');
  assert.equal(offer.availability, OFFER_AVAILABILITY);
  assert.match(offer.availability, /^https:\/\/schema\.org\//);
  assert.equal(offer.url, URL_);
});

test('OFFER the price is per night, stated as a unit price', () => {
  const ps = build().makesOffer.priceSpecification;
  assert.equal(ps['@type'], 'UnitPriceSpecification');
  assert.equal(ps.unitCode, 'DAY');
  assert.equal(ps.price, 220);
  assert.equal(ps.priceCurrency, 'GEL');
});

test('OFFER a price that arrived as a string is still a number in the schema', () => {
  // PostgREST returns numeric as "220.00" in some paths; a string price would
  // be dropped by the Rich Results Test.
  const s = build({ price_per_night: '220.00' as unknown as number });
  assert.equal(s.makesOffer.price, 220);
  assert.equal(typeof s.makesOffer.price, 'number');
});

test('OFFER no price means no Offer at all, rather than a free cottage', () => {
  const s = build({ price_per_night: null });
  assert.equal('makesOffer' in s, false);
  assert.equal('priceRange' in s, false);
});

// ── Accommodation facts hang off the right node ──────────────────────────────

test('ACCOMMODATION occupancy and numberOfRooms are on containsPlace, not the business', () => {
  const s = build();
  // These are Accommodation properties. On a LodgingBusiness they are invalid,
  // which is exactly the kind of thing the Rich Results Test flags.
  assert.equal('occupancy' in s, false);
  assert.equal(s.containsPlace['@type'], 'Accommodation');
  assert.equal(s.containsPlace.numberOfRooms, 4);
  assert.deepEqual(s.containsPlace.occupancy, {
    '@type': 'QuantitativeValue', maxValue: 8, unitCode: 'C62',
  });
});

test('ACCOMMODATION absent facts are omitted, never guessed', () => {
  const s = build({ bedrooms: null, max_guests: null });
  assert.equal('containsPlace' in s, false);
  const partial = build({ bedrooms: null });
  assert.equal('numberOfRooms' in partial.containsPlace, false);
  assert.ok(partial.containsPlace.occupancy);
});

// ── Place ────────────────────────────────────────────────────────────────────

test('PLACE the address always names the country, and the locality when known', () => {
  const s = build();
  assert.equal(s.address['@type'], 'PostalAddress');
  assert.equal(s.address.addressCountry, 'GE');
  assert.equal(s.address.addressLocality, 'Abastumani, Samtskhe-Javakheti');
  assert.equal(s.address.streetAddress, '12 Mountain Road');

  // 94 of 101 listings have no street address; the field is dropped, not faked.
  const noStreet = build({ address: null });
  assert.equal('streetAddress' in noStreet.address, false);
  assert.equal(noStreet.address.addressCountry, 'GE');
});

test('PLACE coordinates are numbers, or the geo node is absent', () => {
  const s = build();
  assert.deepEqual(s.geo, { '@type': 'GeoCoordinates', latitude: 41.75, longitude: 42.84 });

  // 100 of 101 listings have no coordinates. Omitting geo is correct;
  // inventing a point for a cottage would be worse than saying nothing.
  for (const over of [{ latitude: null }, { longitude: null }, { latitude: null, longitude: null }]) {
    assert.equal('geo' in build(over), false, JSON.stringify(over));
  }
  // Strings from the database still land as numbers.
  const str = build({ latitude: '41.75' as unknown as number, longitude: '42.84' as unknown as number });
  assert.equal(typeof str.geo.latitude, 'number');
});

test('PLACE amenities become LocationFeatureSpecification, and empty means absent', () => {
  const s = build();
  assert.equal(s.amenityFeature.length, 2);
  assert.deepEqual(s.amenityFeature[0], {
    '@type': 'LocationFeatureSpecification', name: 'WiFi', value: true,
  });
  assert.equal('amenityFeature' in build({ amenities: [] }), false);
  assert.equal('amenityFeature' in build({ amenities: null }), false);
});

// ── Document shape ───────────────────────────────────────────────────────────

test('SHAPE the node is a VacationRental with a stable @id and the page url', () => {
  const s = build();
  assert.equal(s['@context'], 'https://schema.org');
  assert.equal(s['@type'], 'VacationRental');
  assert.equal(s['@id'], URL_);
  assert.equal(s.url, URL_);
  assert.equal(s.image, IMG);
  assert.equal(s.name, 'Vakhrama');
  assert.equal(s.description, 'A quiet wooden cottage with a garden.');
});

test('SHAPE a listing with no description simply has none', () => {
  assert.equal('description' in build({ description: null }), false);
  assert.equal('description' in build({ description: '   ' }), false);
});

test('SHAPE the builder is pure: same input, identical output', () => {
  assert.deepEqual(build(), build());
  assert.equal(JSON.stringify(build()), JSON.stringify(build()));
});

test('SHAPE nothing in the output is undefined, which JSON.stringify would drop silently', () => {
  const walk = (v: unknown, path: string): void => {
    assert.notEqual(v, undefined, `undefined at ${path}`);
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, `${path}.${k}`);
    }
  };
  walk(build(), '$');
  walk(build({ bedrooms: null, max_guests: null, latitude: null, longitude: null, address: null }), '$');
});
