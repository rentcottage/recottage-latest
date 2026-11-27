/**
 * Property photo URLs.
 *
 * Supabase Image Transformations (`/storage/v1/render/image/…`) is NOT enabled
 * on our plan: every render URL answers 403 FeatureNotEnabled. So nothing here
 * may ever build a render URL. We serve plain public objects instead, and keep
 * pre-generated WebP variants next to each original in the bucket:
 *
 *   property-photos/<dir>/<name>.<ext>          the original (never deleted)
 *   property-photos/<dir>/<name>-1600.webp      longest edge ≤1600, q≈78
 *   property-photos/<dir>/<name>-400.webp       longest edge ≤400,  q≈70
 *
 * The variants are written by scripts/optimize-images.mjs (existing photos)
 * and by uploadPropertyPhoto() in src/lib/photoUpload.ts (new uploads). A
 * photo whose variants don't exist yet still works: <StoragePhoto> falls back
 * to the original on the first load error.
 *
 * Only objects in the property-photos bucket get variant URLs. Placeholders
 * (`/cottage-placeholder.svg`), data URIs, other buckets and external images
 * pass through untouched, so callers can use this on any `src`.
 *
 * scripts/lib/variants.mjs holds the same naming rule for the Node scripts;
 * tests/frontend/imageUrl.test.ts asserts the two agree.
 */

export const PHOTO_BUCKET = 'property-photos';
const OBJECT_PREFIX = `/storage/v1/object/public/${PHOTO_BUCKET}/`;

/** Use case → stored size. 'original' is the untouched upload. */
export type PhotoSize = 'thumb' | 'large' | 'original';

export const PHOTO_VARIANTS = {
  thumb: { edge: 400, quality: 70 },  // cards, search, mosaic tiles, thumb strips, host dashboard
  large: { edge: 1600, quality: 78 }, // property gallery hero + lightbox
} as const;

/** Is this one of our property-photos objects (so variants can exist)? */
export function isPhotoObjectUrl(url: string): boolean {
  return typeof url === 'string' && url.includes(OBJECT_PREFIX);
}

/** A variant already? Never derive a variant of a variant. */
const VARIANT_RE = /-(400|1600)\.webp$/i;

/**
 * `<dir>/<name>.<ext>` → `<dir>/<name>-<edge>.webp`. Only the LAST extension is
 * replaced, so `a.jpg.webp` (compressed uploads) → `a.jpg-400.webp`.
 */
export function variantPath(path: string, edge: number): string {
  const slash = path.lastIndexOf('/');
  const dir = path.slice(0, slash + 1);
  const file = path.slice(slash + 1);
  const dot = file.lastIndexOf('.');
  const base = dot > 0 ? file.slice(0, dot) : file;
  return `${dir}${base}-${edge}.webp`;
}

/**
 * The URL to show for a photo at a given use-case size. Plain public object
 * URLs only — never the render endpoint.
 */
export function getPhotoUrl(url: string, size: PhotoSize): string {
  if (!url || size === 'original' || !isPhotoObjectUrl(url)) return url;
  const [noQuery] = url.split(/[?#]/);
  if (VARIANT_RE.test(noQuery)) return noQuery;
  return variantPath(noQuery, PHOTO_VARIANTS[size].edge);
}
