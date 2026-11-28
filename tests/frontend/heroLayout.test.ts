// Phone offer banner: shown on the hero's snow only where it clears the porch.
// Run: node --test tests/frontend/heroLayout.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offerFitsBelowPorch } from '../../src/lib/heroLayout.ts';

test('fits on common phone screens', () => {
  for (const [w, h] of [[390, 844], [430, 932], [375, 667], [360, 780], [414, 896]]) {
    assert.equal(offerFitsBelowPorch(w, h), true, `${w}x${h}`);
  }
});

test('does not fit when the hero is too short or too wide for the clip', () => {
  // Landscape phone / very short hero: the 9:16 clip is scaled by width, so
  // the porch is pushed down to (or past) the bottom edge.
  assert.equal(offerFitsBelowPorch(740, 360), false);
  assert.equal(offerFitsBelowPorch(600, 700), false);
});
