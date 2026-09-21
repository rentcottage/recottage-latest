// Shared build-time SEO helpers for scripts/prerender.mjs.
//
// WHY THIS FILE EXISTS. The React app sets every SEO tag from a useEffect
// (src/components/feature/SEO.tsx), so a crawler that does not run JavaScript
// sees only what the served HTML already contains. For /property/<id> that
// used to be the homepage document verbatim — homepage title, homepage
// description, and canonical pointing at "/". prerender.mjs now writes a real
// file per listing, and these are the pieces it needs.
//
// THE PARITY RULE. Everything here must produce byte-identical strings to what
// the property page produces after hydration, or the two fight: the crawler
// indexes one title and the rendered page swaps in another. The duplication is
// therefore pinned by tests/frontend/prerender.test.ts, which imports BOTH this
// module and the app's own src/lib/imageUrl.ts and asserts they agree. That
// test is the reason this file may be edited only in step with the page.
//
// The listing text is deliberately NOT localised. listingText() returns the
// original `title`/`description` whenever the reader's language is `ka`, and
// `ka` is DEFAULT_LANG and the `lang` on the served <html>. So the raw columns
// are exactly what a default-language visitor hydrates to.

import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

export const SITE = 'https://rentcottage.ge';
/** The site-wide share image, and the fallback for a listing with no photo. */
export const DEFAULT_OG = `${SITE}/og-image.png`;

/**
 * Populates process.env from a local .env when the platform has not already.
 * Vercel injects these itself; this is only for `npm run build` on a laptop.
 * Mirrors the loader in scripts/generate-sitemap.mjs, which is deliberately
 * left untouched so the sitemap's behaviour cannot change.
 */
export function loadEnv(repoRoot) {
  const envPath = `${repoRoot}/.env`;
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

/**
 * Every approved listing, from the same PII-free view the sitemap and the
 * public site read. Returns null — never throws and never exits — when the
 * credentials are absent: a laptop build without .env should still produce the
 * static routes rather than fail, exactly as the sitemap script does.
 */
export async function fetchApprovedListings() {
  const url = process.env.VITE_PUBLIC_SUPABASE_URL;
  const key = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('public_properties')
    .select('id, title, location, price_per_night, bedrooms, cover_photo_url, photo_urls');
  if (error) throw new Error(`public_properties read failed: ${error.message}`);
  return data ?? [];
}

// ── Image ────────────────────────────────────────────────────────────────────

const OBJECT_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

/** The Open Graph box. 1200x630 is what Facebook, X, LinkedIn and Slack crop to. */
export const OG_BOX = { w: 1200, h: 630 };
/**
 * Quality 75 measured at 57-145 KB across the catalogue — inside the 300 KB
 * budget with room to spare, and the same quality the property gallery uses.
 */
export const OG_QUALITY = 75;

/**
 * A listing's share image: the storage RENDER endpoint, resized and re-encoded.
 *
 * Never the raw object URL. Originals are full-resolution camera JPEGs
 * (measured up to 6.7 MB); handing one to a link-preview bot means a share
 * card that renders slowly or not at all. The render endpoint also serves
 * WebP to clients that accept it, and is CDN-cached.
 *
 * This is the same rewrite as optimizedImageUrl() in src/lib/imageUrl.ts, kept
 * separate only because this file must run under whatever Node the deploy
 * platform provides, with no TypeScript loader. The two are asserted equal in
 * tests/frontend/prerender.test.ts.
 */
export function ogImageUrl(listing) {
  const raw = firstPhoto(listing);
  if (!raw) return DEFAULT_OG;
  if (!raw.includes(OBJECT_PATH)) {
    // Not one of our storage objects, so there is nothing to resize. A handful
    // of listings still carry absolute URLs on a legacy image host; the app
    // passes those through untouched (optimizedImageUrl does the same), so
    // this does too, or the served tag and the hydrated tag would disagree.
    // Anything that is not an absolute http(s) URL — a relative placeholder
    // like /cottage-placeholder.svg, a data: URI — is not a valid og:image at
    // all, and becomes the site card.
    return /^https?:\/\//i.test(raw) ? raw : DEFAULT_OG;
  }
  const rewritten = raw.replace(OBJECT_PATH, RENDER_PATH);
  const sep = rewritten.includes('?') ? '&' : '?';
  return `${rewritten}${sep}width=${OG_BOX.w}&height=${OG_BOX.h}&resize=cover&quality=${OG_QUALITY}`;
}

/** The cover, or the first photo, or nothing. Mirrors the property page. */
export function firstPhoto(listing) {
  const cover = typeof listing?.cover_photo_url === 'string' ? listing.cover_photo_url.trim() : '';
  if (cover) return cover;
  const photos = Array.isArray(listing?.photo_urls) ? listing.photo_urls : [];
  const first = photos.find((u) => typeof u === 'string' && u.trim());
  return first ? first.trim() : '';
}

// ── Text ─────────────────────────────────────────────────────────────────────

/** `<title>` for a listing — the string src/pages/property/page.tsx builds. */
export function listingTitle(listing) {
  return `${listing.title} — ${listing.location} Cottage Rental | RentCottage.Ge`;
}

/**
 * The meta description for a listing.
 *
 * NO RATING. This used to end "· Rating 5", from a `rating: 5.0` literal in the
 * property page next to a `reviews: 0` literal — a five-star claim on a listing
 * with no reviews, on all 101 listings. A rating appears only when real reviews
 * exist, which is the rule the AggregateRating JSON-LD already followed.
 * `reviews` is 0 for every listing today, so this branch is the one that runs;
 * it is written out in full so the day reviews arrive, prerender and page still
 * agree.
 */
export function listingDescription(listing, { rating = null, reviews = 0 } = {}) {
  const price = Number(listing.price_per_night);
  const bedrooms = listing.bedrooms || 1;
  const ratingPart = reviews > 0 && rating != null ? ` · Rating ${rating}` : '';
  return `Book ${listing.title} in ${listing.location}, Georgia. ₾${price}/night · ${bedrooms} bedrooms${ratingPart}. Authentic Georgian cottage experience with verified host.`;
}

/** `keywords`, matching the property page. */
export function listingKeywords(listing) {
  return `${listing.location} cottage rental, Georgian cottage ${listing.location}, rent cottage Georgia`;
}

/** Everything prerender.mjs needs to write one listing's document. */
export function listingRoute(listing) {
  return {
    path: `property/${listing.id}`,
    title: listingTitle(listing),
    description: listingDescription(listing),
    keywords: listingKeywords(listing),
    ogType: 'product',
    ogImage: ogImageUrl(listing),
  };
}
