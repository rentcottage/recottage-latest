// The map pin's coordinates, on the way to a numeric(10,7) column.
//
// Run: node --test tests/frontend/coords.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COORD_DECIMALS,
  MAX_LATITUDE,
  MAX_LONGITUDE,
  formatCoord,
  parseCoord,
} from '../../src/lib/coords.ts';

test('FORMAT never emits more precision than the column keeps', () => {
  assert.equal(COORD_DECIMALS, 7);
  // Leaflet hands back full float precision; the column is numeric(10,7), so
  // anything beyond seven decimals would be rounded away after saving and the
  // host would see a different number than the one they placed.
  const formatted = formatCoord(41.123456789123);
  assert.equal(formatted, '41.1234568');
  assert.ok(formatted.split('.')[1].length <= COORD_DECIMALS);
});

test('FORMAT trailing zeros are trimmed, and a whole number stays whole', () => {
  assert.equal(formatCoord(42), '42');
  assert.equal(formatCoord(42.5), '42.5');
  assert.equal(formatCoord(42.1000000), '42.1');
  assert.equal(formatCoord(-42.25), '-42.25');
  assert.equal(formatCoord(0), '0');
});

test('FORMAT a real Georgian coordinate round-trips', () => {
  // The one listing that already carries a pin.
  assert.equal(formatCoord(43.0757344), '43.0757344');
  assert.equal(formatCoord(42.6021015), '42.6021015');
  assert.equal(Number(formatCoord(43.0757344)), 43.0757344);
});

test('PARSE empty means no pin, not zero', () => {
  // 0,0 is in the Atlantic. An empty field must never become a coordinate.
  for (const v of ['', '   ', '\t']) assert.equal(parseCoord(v, MAX_LATITUDE), null, JSON.stringify(v));
});

test('PARSE junk is rejected rather than coerced', () => {
  for (const v of ['abc', 'NaN', '4 1', '--3', 'Infinity', '1,5']) {
    assert.equal(parseCoord(v, MAX_LATITUDE), null, v);
  }
});

test('PARSE out-of-range values are refused, not clamped', () => {
  // A typo is a typo. Clamping would silently move the pin to the pole or the
  // date line and look deliberate.
  assert.equal(parseCoord('91', MAX_LATITUDE), null);
  assert.equal(parseCoord('-90.5', MAX_LATITUDE), null);
  assert.equal(parseCoord('181', MAX_LONGITUDE), null);
  assert.equal(parseCoord('-180.1', MAX_LONGITUDE), null);
  // The exact bounds are valid.
  assert.equal(parseCoord('90', MAX_LATITUDE), 90);
  assert.equal(parseCoord('-180', MAX_LONGITUDE), -180);
});

test('PARSE accepts the values a host would actually place in Georgia', () => {
  assert.equal(parseCoord('41.7151', MAX_LATITUDE), 41.7151);
  assert.equal(parseCoord('44.8271', MAX_LONGITUDE), 44.8271);
  assert.equal(parseCoord(' 42.0 ', MAX_LATITUDE), 42);
});

test('PARSE and FORMAT compose without drift', () => {
  for (const n of [41.7151, -0.0000001, 43.0757344, 90, -180, 0]) {
    const parsed = parseCoord(formatCoord(n), 180);
    assert.equal(parsed, Number(n.toFixed(COORD_DECIMALS)), String(n));
  }
});
