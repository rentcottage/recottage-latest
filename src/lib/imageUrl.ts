/**
 * Supabase Storage image optimizer.
 *
 * Host photos are uploaded at full camera resolution (measured up to 3.6 MB
 * per JPEG) and the public object endpoint serves them raw with
 * `cache-control: no-cache`. The storage *render* endpoint resizes on the
 * fly, auto-converts to WebP when the browser accepts it, and is cached by
 * the CDN (measured: 3.27 MB JPEG → 208 KB WebP at width=640).
 *
 * Only Supabase Storage public-object URLs are rewritten — placeholders
 * (`/cottage-placeholder.svg`), data URIs, and external images pass through
 * untouched, so callers can use this on any `src` unconditionally.
 */

const OBJECT_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

/**
 * Rewrites a Supabase Storage URL to a resized, CDN-cached variant.
 *
 * BOTH dimensions + an explicit `resize` mode are mandatory: with only
 * `width` the endpoint keeps the source height and center-CROPS the width —
 * measured: 1290×745 original → 640×745 vertical strip.
 *
 * fit='cover'   → exactly box.w×box.h, center-cropped server-side (cards).
 * fit='contain' → whole image fitted inside the box, no crop (gallery, and
 *                 the few covers whose host picked a top/bottom crop — the
 *                 browser then applies object-cover with their position).
 */
export function optimizedImageUrl(
  url: string,
  box: ImageBox,
  quality = 70,
  fit: 'cover' | 'contain' = 'contain',
): string {
  if (!url || !url.includes(OBJECT_PATH)) return url;
  const rewritten = url.replace(OBJECT_PATH, RENDER_PATH);
  const sep = rewritten.includes('?') ? '&' : '?';
  return `${rewritten}${sep}width=${box.w}&height=${box.h}&resize=${fit}&quality=${quality}`;
}

export interface ImageBox { w: number; h: number }

/** Standard boxes so the CDN cache stays hot (one variant per use case). */
export const IMG_CARD: ImageBox = { w: 640, h: 440 };    // listing cards, 16:11 box
export const IMG_HERO: ImageBox = { w: 1600, h: 900 };   // property gallery, 16:9 box
export const IMG_THUMB: ImageBox = { w: 320, h: 240 };   // thumbnail strips, 4:3 box
