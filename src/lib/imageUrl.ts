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
 * BOTH dimensions + `resize=contain` are mandatory: with only `width` the
 * endpoint keeps the source height and center-CROPS the width (default
 * resize=cover against a width×sourceHeight box) — measured: 1290×745
 * original → 640×745 vertical strip. `resize=contain` fits the image inside
 * width×height preserving aspect ratio with no crop and no padding
 * (1290×745 → 640×370; 1200×1600 → 330×440 — both verified).
 */
export function optimizedImageUrl(url: string, box: ImageBox, quality = 70): string {
  if (!url || !url.includes(OBJECT_PATH)) return url;
  const rewritten = url.replace(OBJECT_PATH, RENDER_PATH);
  const sep = rewritten.includes('?') ? '&' : '?';
  return `${rewritten}${sep}width=${box.w}&height=${box.h}&resize=contain&quality=${quality}`;
}

export interface ImageBox { w: number; h: number }

/** Standard boxes so the CDN cache stays hot (one variant per use case). */
export const IMG_CARD: ImageBox = { w: 640, h: 440 };    // listing cards, 16:11 box
export const IMG_HERO: ImageBox = { w: 1600, h: 900 };   // property gallery, 16:9 box
export const IMG_THUMB: ImageBox = { w: 320, h: 240 };   // thumbnail strips, 4:3 box
