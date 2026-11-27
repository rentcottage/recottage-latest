// In-browser compression of new property photo uploads (src/lib/imageCompression.ts,
// used by src/lib/photoUpload.ts). The canvas encode itself needs a browser;
// these cover every decision around it, and the "if compression fails, upload
// as-is" guarantee, which is exactly what happens in Node (no DOM).
//
// Run: node --test tests/frontend/photoCompression.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compressImage, scaleToFit, hasTransparentPixel, pickOutputType, swapExtension,
} from '../../src/lib/imageCompression.ts';

test('scaleToFit caps the long side at 2000px and never upscales', () => {
  assert.deepEqual(scaleToFit(8188, 5461, 2000), { width: 2000, height: 1334 });
  assert.deepEqual(scaleToFit(1366, 2048, 2000), { width: 1334, height: 2000 });
  assert.deepEqual(scaleToFit(1024, 768, 2000), { width: 1024, height: 768 });
  assert.deepEqual(scaleToFit(2000, 2000, 2000), { width: 2000, height: 2000 });
  assert.deepEqual(scaleToFit(10000, 1, 2000), { width: 2000, height: 1 });
});

test('transparency means any pixel below full alpha', () => {
  const opaque = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]);
  const clear = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 254]);
  assert.equal(hasTransparentPixel(opaque), false);
  assert.equal(hasTransparentPixel(clear), true);
  assert.equal(hasTransparentPixel(new Uint8ClampedArray([])), false);
});

test('JPEG output, except a really transparent PNG/WebP stays PNG', () => {
  assert.equal(pickOutputType('jpeg', 'image/jpeg', false), 'image/jpeg');
  assert.equal(pickOutputType('jpeg', 'image/png', false), 'image/jpeg');   // opaque PNG → JPEG
  assert.equal(pickOutputType('jpeg', 'image/png', true), 'image/png');     // transparent PNG kept
  assert.equal(pickOutputType('jpeg', 'image/webp', true), 'image/png');
  assert.equal(pickOutputType('jpeg', 'image/jpeg', true), 'image/jpeg');   // JPEG can't be transparent
  assert.equal(pickOutputType('webp', 'image/png', true), 'image/webp');    // admin path unchanged
});

test('the file name follows the encoded type', () => {
  assert.equal(swapExtension('IMG_3060.HEIC.png', 'image/jpeg'), 'IMG_3060.HEIC.jpg');
  assert.equal(swapExtension('logo.png', 'image/png'), 'logo.png');
  assert.equal(swapExtension('a.jpeg', 'image/webp'), 'a.webp');
  assert.equal(swapExtension('.jpg', 'image/jpeg'), 'photo.jpg');
});

test('if compression fails, the original file is uploaded as-is', async () => {
  // No canvas/Image in Node: decoding throws inside compressImage, which must
  // hand back the very same File rather than throw or return nothing.
  const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'cottage.jpg', { type: 'image/jpeg' });
  assert.equal(await compressImage(jpeg, { maxEdge: 2000, quality: 0.8, format: 'jpeg' }), jpeg);
  // Types we never re-encode pass straight through.
  const heic = new File([new Uint8Array([1, 2, 3])], 'IMG.heic', { type: 'image/heic' });
  assert.equal(await compressImage(heic, { format: 'jpeg' }), heic);
});
