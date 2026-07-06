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

/** Rewrites a Supabase Storage URL to a resized, CDN-cached variant. */
export function optimizedImageUrl(url: string, width: number, quality = 70): string {
  if (!url || !url.includes(OBJECT_PATH)) return url;
  const rewritten = url.replace(OBJECT_PATH, RENDER_PATH);
  const sep = rewritten.includes('?') ? '&' : '?';
  return `${rewritten}${sep}width=${width}&quality=${quality}`;
}

/** Standard widths so the CDN cache stays hot (one variant per use case). */
export const IMG_CARD = 640;      // listing cards (~350 CSS px, retina-ready)
export const IMG_HERO = 1600;     // property page main gallery image
export const IMG_THUMB = 320;     // thumbnail strips
