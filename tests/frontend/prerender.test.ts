// The prerendered listing pages must say exactly what the app says.
//
// scripts/lib/seo.mjs builds a listing's <title>, description and og:image at
// BUILD time; src/pages/property/page.tsx builds the same three at RUNTIME and
// SEO.tsx writes them over the served HTML during hydration. If the two ever
// disagree, a crawler indexes one string and the reader is shown another —
// which is the exact failure this whole change set exists to remove.
//
// The build script cannot import the app's TypeScript (it has to run under
// whatever Node the deploy platform provides, with no type-stripping loader),
// so the small overlap is duplicated. These tests are what stop the duplicate
// drifting: they import BOTH sides and compare.
//
// Run: node --test tests/frontend/prerender.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OG,
  OG_BOX as SEO_OG_BOX,
  OG_QUALITY,
  firstPhoto,
  listingDescription,
  listingKeywords,
  listingRoute,
  listingTitle,
  ogImageUrl,
  // @ts-expect-error — plain .mjs with no type declarations, by design.
} from '../../scripts/lib/seo.mjs';
import { OG_BOX, optimizedImageUrl } from '../../src/lib/imageUrl.ts';

type Listing = {
  id: string;
  title: string;
  location: string;
  price_per_night: number;
  bedrooms: number | null;
  cover_photo_url?: string | null;
  photo_urls?: string[] | null;
};

const STORAGE = 'https://fkjkyzpunatzkovqxyzp.supabase.co/storage/v1/object/public/property-photos';

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: '26269de3-dd0f-4272-802c-139646a93180',
  title: 'Vakhrama',
  location: 'Abastumani, Samtskhe-Javakheti',
  price_per_night: 220,
  bedrooms: 4,
  cover_photo_url: `${STORAGE}/cover.jpg`,
  photo_urls: [`${STORAGE}/a.jpg`, `${STORAGE}/b.jpg`],
  ...over,
});

/**
 * The property page's own expression, transcribed. Keeping it here rather than
 * importing the page means this file does not need React or a DOM; if the page
 * changes, the assertion below is what fails.
 */
function pageTitle(l: Listing): string {
  return `${l.title} — ${l.location} Cottage Rental | RentCottage.Ge`;
}
function pageDescription(l: Listing, reviews = 0, rating = 5): string {
  const ratingPart = reviews > 0 ? ` · Rating ${rating}` : '';
  return (
    `Book ${l.title} in ${l.location}, Georgia. ₾${Number(l.price_per_night)}/night · ` +
    `${l.bedrooms || 1} bedrooms${ratingPart}. ` +
    'Authentic Georgian cottage experience with verified host.'
  );
}

// ── Title and description parity ─────────────────────────────────────────────

test('PARITY the build-time title is the page title, character for character', () => {
  for (const l of [
    listing(),
    listing({ title: 'Cottage Tobani/კოტეჯი თობანი', location: 'Kazbegi, Mtskheta-Mtianeti' }),
    listing({ title: 'აბიესი N2', location: 'Ambrolauri, Racha-Lechkhumi' }),
    listing({ title: 'A & B "Cottage" <3', location: 'Keda, Adjara' }),
  ]) {
    assert.equal(listingTitle(l), pageTitle(l), l.title);
  }
});

test('PARITY the build-time description is the page description', () => {
  for (const l of [
    listing(),
    listing({ price_per_night: 360, bedrooms: 3 }),
    listing({ bedrooms: null }),          // falls back to 1 on both sides
    listing({ bedrooms: 0 }),             // 0 is falsy: also 1, on both sides
    listing({ price_per_night: 99.5 }),   // Number() drops nothing meaningful
    listing({ price_per_night: 220.0 }),  // 220.00 must render "220", not "220.00"
  ]) {
    assert.equal(listingDescription(l), pageDescription(l), JSON.stringify(l.price_per_night));
  }
});

test('PARITY keywords match the page', () => {
  const l = listing();
  assert.equal(
    listingKeywords(l),
    `${l.location} cottage rental, Georgian cottage ${l.location}, rent cottage Georgia`,
  );
});

// ── The fabricated rating ────────────────────────────────────────────────────

test('RATING no listing description claims a rating without reviews', () => {
  const l = listing();
  const d = listingDescription(l);
  assert.equal(/Rating/.test(d), false, d);
  assert.equal(/Rating 5/.test(d), false, d);
  // Every listing in production has reviews: 0, so this is the branch that runs.
  assert.equal(listingDescription(l, { rating: 5, reviews: 0 }), d);
  assert.equal(pageDescription(l, 0).includes('Rating'), false);
});

test('RATING a rating appears once, and only once, real reviews exist', () => {
  const l = listing();
  const withReviews = listingDescription(l, { rating: 4.8, reviews: 12 });
  assert.ok(withReviews.includes('· Rating 4.8.'), withReviews);
  assert.equal(withReviews, pageDescription(l, 12, 4.8));
  // A rating with no reviews behind it is still refused.
  assert.equal(listingDescription(l, { rating: 4.8, reviews: 0 }).includes('Rating'), false);
});

// ── og:image parity ──────────────────────────────────────────────────────────

test('OGIMAGE the build script and the app produce the same URL', () => {
  assert.deepEqual(SEO_OG_BOX, OG_BOX, 'the two OG boxes must be the same box');
  for (const l of [
    listing(),
    listing({ cover_photo_url: null }),                       // falls back to photo_urls[0]
    listing({ cover_photo_url: '   ' }),                      // blank counts as absent
    listing({ cover_photo_url: `${STORAGE}/x.jpg?v=2` }),     // existing query string
    listing({ cover_photo_url: 'https://legacy.example.test/a.jpg' }), // not our storage
  ]) {
    const raw = firstPhoto(l);
    if (!raw) continue;
    assert.equal(ogImageUrl(l), optimizedImageUrl(raw, OG_BOX, OG_QUALITY, 'cover'), raw);
  }
});

test('OGIMAGE it is the resized render endpoint, never the raw original', () => {
  const url = ogImageUrl(listing());
  assert.ok(url.includes('/storage/v1/render/image/public/'), url);
  assert.equal(url.includes('/storage/v1/object/public/'), false, url);
  assert.ok(url.includes(`width=${OG_BOX.w}`) && url.includes(`height=${OG_BOX.h}`), url);
  assert.ok(url.includes('resize=cover') && url.includes(`quality=${OG_QUALITY}`), url);
  assert.deepEqual(OG_BOX, { w: 1200, h: 630 });
});

test('OGIMAGE a listing with no usable photo falls back to the site card', () => {
  for (const l of [
    listing({ cover_photo_url: null, photo_urls: [] }),
    listing({ cover_photo_url: null, photo_urls: null }),
    listing({ cover_photo_url: '', photo_urls: ['', '  '] }),
  ]) {
    assert.equal(ogImageUrl(l), DEFAULT_OG);
  }
  // A relative path or a data: URI is not a usable og:image, so it becomes the
  // site card rather than a link a preview bot cannot resolve.
  assert.equal(ogImageUrl(listing({ cover_photo_url: '/cottage-placeholder.svg' })), DEFAULT_OG);
  assert.equal(ogImageUrl(listing({ cover_photo_url: 'data:image/png;base64,iVBOR' })), DEFAULT_OG);
});

test('OGIMAGE an absolute URL on another host passes through, as the app does', () => {
  // A few listings still point at a legacy image host. There is nothing to
  // resize, and the app renders that URL as-is, so the served tag must too.
  const external = 'https://storage.readdy-site.link/project_files/x/y.jpg';
  const l = listing({ cover_photo_url: external });
  assert.equal(ogImageUrl(l), external);
  assert.equal(ogImageUrl(l), optimizedImageUrl(external, OG_BOX, OG_QUALITY, 'cover'));
});

// ── The route object the writer consumes ─────────────────────────────────────

test('ROUTE a listing route carries every field the document needs', () => {
  const l = listing();
  const r = listingRoute(l);
  assert.deepEqual(Object.keys(r).sort(), ['description', 'keywords', 'ogImage', 'ogType', 'path', 'title']);
  assert.equal(r.path, `property/${l.id}`, 'the path must be the existing URL, unchanged');
  assert.equal(r.ogType, 'product');
  assert.equal(r.title, pageTitle(l));
  assert.equal(r.description, pageDescription(l));
  assert.equal(r.path.startsWith('/'), false, 'paths are relative; the writer joins them');
});
