import { supabase } from './supabase';
import { compressImage, resizeToWebp } from './imageCompression';
import { PHOTO_BUCKET, PHOTO_VARIANTS, variantPath } from './imageUrl';

/** Every upload gets a new path (timestamped), so nothing is ever overwritten: cache for a year. */
const CACHE_SECONDS = '31536000';

/**
 * How the stored original is compressed in the browser: longest edge 2000px,
 * JPEG q0.8 (PNG kept only when it has real transparency) — the same as
 * scripts/compress-originals.mjs did to the existing photos, so the bucket
 * stays under the Free-plan 1 GB. If compression fails or doesn't shrink the
 * file, the original is uploaded as-is.
 */
export const ORIGINAL_COMPRESSION = { maxEdge: 2000, quality: 0.8, format: 'jpeg' } as const;

/**
 * Compresses and uploads one property photo to `path` in the property-photos
 * bucket, then writes its -400 and -1600 WebP display variants next to it
 * (the same files scripts/optimize-images.mjs makes for older photos).
 *
 * Returns the ORIGINAL's public URL — that is what gets stored in photo_urls;
 * getPhotoUrl() derives the variant URLs from it. A failed variant upload is
 * logged and ignored: <StoragePhoto> falls back to the original, and the
 * script can backfill it later.
 *
 * `buildPath` receives the compressed file, because compression can change
 * the extension (to .jpg, or .png for a transparent image).
 */
export async function uploadPropertyPhoto(
  file: File,
  buildPath: (compressed: File) => string,
): Promise<{ url: string; path: string } | { error: unknown }> {
  const uploadFile = await compressImage(file, ORIGINAL_COMPRESSION);
  const path = buildPath(uploadFile);
  const bucket = supabase.storage.from(PHOTO_BUCKET);

  const { error } = await bucket.upload(path, uploadFile, { contentType: uploadFile.type, cacheControl: CACHE_SECONDS, upsert: false });
  if (error) return { error };

  await Promise.all(
    Object.values(PHOTO_VARIANTS).map(async ({ edge, quality }) => {
      const blob = await resizeToWebp(uploadFile, edge, quality / 100);
      if (!blob) return;
      const { error: vErr } = await bucket.upload(variantPath(path, edge), blob, {
        contentType: 'image/webp',
        cacheControl: CACHE_SECONDS,
        upsert: false,
      });
      if (vErr) console.warn(`Photo variant ${edge} upload failed (original is fine):`, vErr);
    }),
  );

  const { data } = bucket.getPublicUrl(path);
  return { url: data.publicUrl, path };
}
