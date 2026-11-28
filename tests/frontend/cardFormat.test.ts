// Listing card: the "REGION · VILLAGE" label and the amenity icon order.
// Run: node --test tests/frontend/cardFormat.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locationEyebrow } from '../../src/lib/locationNormalizer.ts';
import { cardAmenityOrder, AMENITY_ICON } from '../../src/lib/amenityLabels.ts';

test('location label is REGION · VILLAGE', () => {
  assert.equal(locationEyebrow('ქვედა ლუჰა, სამეგრელო-ზემო სვანეთი'), 'სამეგრელო-ზემო სვანეთი · ქვედა ლუჰა');
  assert.equal(locationEyebrow('Borjomi, Samtskhe-Javakheti'), 'Samtskhe-Javakheti · Borjomi');
  assert.equal(locationEyebrow('Village, Town, Region'), 'Region · Village');
  assert.equal(locationEyebrow('Kazbegi'), 'Kazbegi');
  assert.equal(locationEyebrow('Kazbegi, Kazbegi'), 'Kazbegi');
  assert.equal(locationEyebrow(' , Tianeti ,'), 'Tianeti');
  assert.equal(locationEyebrow(''), '');
});

test('amenities: guest favourites first, host-typed last, no duplicates or blanks', () => {
  assert.deepEqual(
    cardAmenityOrder(['WiFi', 'My sauna', 'Hot Tub', 'Parking', 'WiFi', '', ' ', 'Fireplace']),
    ['Hot Tub', 'Fireplace', 'WiFi', 'Parking', 'My sauna'],
  );
  assert.deepEqual(cardAmenityOrder([]), []);
});

test('every amenity icon is a Remix line icon', () => {
  for (const icon of Object.values(AMENITY_ICON)) assert.match(icon, /^ri-[a-z0-9-]+-line$/);
});
