import { supabase } from './supabase';
import { compressImage, resizeToWebp } from './imageCompression';
import { PHOTO_BUCKET, PHOTO_VARIANTS, variantPath } from './imageUrl';

/** Variants never change once written (new photo → new path), so cache for a year. */
const VARIANT_CACHE_SECONDS = '31536000';

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
 * the extension (to .webp).
 */
export async function uploadPropertyPhoto(
  file: File,
  buildPath: (compressed: File) => string,
): Promise<{ url: string; path: string } | { error: unknown }> {
  const uploadFile = await compressImage(file);
  const path = buildPath(uploadFile);
  const bucket = supabase.storage.from(PHOTO_BUCKET);

  const { error } = await bucket.upload(path, uploadFile, { contentType: uploadFile.type, upsert: false });
  if (error) return { error };

  await Promise.all(
    Object.values(PHOTO_VARIANTS).map(async ({ edge, quality }) => {
      const blob = await resizeToWebp(uploadFile, edge, quality / 100);
      if (!blob) return;
      const { error: vErr } = await bucket.upload(variantPath(path, edge), blob, {
        contentType: 'image/webp',
        cacheControl: VARIANT_CACHE_SECONDS,
        upsert: false,
      });
      if (vErr) console.warn(`Photo variant ${edge} upload failed (original is fine):`, vErr);
    }),
  );

  const { data } = bucket.getPublicUrl(path);
  return { url: data.publicUrl, path };
}
