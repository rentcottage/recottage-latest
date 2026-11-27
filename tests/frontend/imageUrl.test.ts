// Property photo URLs: never the render endpoint (Image Transformations is
// disabled on our Supabase plan → 403), and the app's variant names must be
// exactly the files scripts/optimize-images.mjs writes.
//
// Run: node --test tests/frontend/imageUrl.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPhotoUrl, variantPath, PHOTO_VARIANTS } from '../../src/lib/imageUrl.ts';
// @ts-expect-error — plain .mjs with no type declarations, by design.
import { variantPath as scriptVariantPath, PHOTO_VARIANTS as SCRIPT_VARIANTS } from '../../scripts/lib/variants.mjs';

const BASE = 'https://fkjkyzpunatzkovqxyzp.supabase.co/storage/v1/object/public/property-photos';

test('variant naming matches the backfill script', () => {
  assert.deepEqual(SCRIPT_VARIANTS, PHOTO_VARIANTS);
  for (const p of ['a.jpg', 'dir/a.jpg', 'x/activities/123.webp', '1778-689_n.jpg.webp', 'noext', 'd.ir/f']) {
    for (const { edge } of Object.values(PHOTO_VARIANTS)) {
      assert.equal(variantPath(p, edge), scriptVariantPath(p, edge), p);
    }
  }
});

test('sizes map to the right files', () => {
  assert.equal(getPhotoUrl(`${BASE}/1-a.jpg.webp`, 'thumb'), `${BASE}/1-a.jpg-400.webp`);
  assert.equal(getPhotoUrl(`${BASE}/p1/99.jpg`, 'large'), `${BASE}/p1/99-1600.webp`);
  assert.equal(getPhotoUrl(`${BASE}/p1/99.jpg`, 'original'), `${BASE}/p1/99.jpg`);
  assert.equal(getPhotoUrl(`${BASE}/p1/99.jpg?v=2`, 'thumb'), `${BASE}/p1/99-400.webp`);
  assert.equal(getPhotoUrl(`${BASE}/p1/99-400.webp`, 'thumb'), `${BASE}/p1/99-400.webp`);
});

test('non-photo URLs pass through untouched', () => {
  for (const u of ['', '/cottage-placeholder.svg', 'data:image/png;base64,x',
    'https://storage.readdy-site.link/project_files/x/y.jpg',
    'https://fkjkyzpunatzkovqxyzp.supabase.co/storage/v1/object/public/avatars/u.png']) {
    assert.equal(getPhotoUrl(u, 'thumb'), u);
  }
});

test('never builds a render URL', () => {
  for (const s of ['thumb', 'large', 'original'] as const) {
    assert.equal(getPhotoUrl(`${BASE}/a.jpg`, s).includes('/render/image/'), false);
  }
});
