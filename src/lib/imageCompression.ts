/**
 * Client-side image compression for host photo uploads.
 *
 * Host cameras produce large JPEGs (measured up to ~3.6 MB each). We re-encode
 * them in the browser BEFORE upload to cut permanent storage: downscale to a
 * sane maximum edge and re-encode as high-quality WebP — perceptually lossless
 * for photos, yet typically 60–85% smaller than the raw camera file. The
 * Supabase Storage render endpoint still resizes per use case on top of this;
 * this only shrinks what we permanently store (and what the lightbox, which
 * serves the raw object, has to download).
 *
 * Guarantees:
 * - Fail-safe: any unsupported type, decode error, or non-improving result
 *   returns the ORIGINAL file, so compression can never block a valid upload.
 * - Orientation-correct: EXIF orientation is baked into the pixels, because
 *   canvas encoding strips EXIF metadata — otherwise re-encoded phone photos
 *   would appear rotated.
 * - No upscaling: images already within `maxEdge` keep their resolution.
 */

/** Raster photo formats we re-encode. GIF (animation), SVG (vector), HEIC, … pass through untouched. */
const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface CompressImageOptions {
  /** Longest edge in px; larger images scale down (never up). Default 2560 — crisp for the full-screen lightbox on 4K/retina. */
  maxEdge?: number;
  /** WebP/JPEG quality, 0–1. Default 0.85 — perceptually lossless for photos. */
  quality?: number;
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/**
 * Returns a compressed copy of `file`, or the original file unchanged when
 * compression isn't applicable or wouldn't help. Never throws.
 */
export async function compressImage(file: File, options: CompressImageOptions = {}): Promise<File> {
  const maxEdge = options.maxEdge ?? 2560;
  const quality = options.quality ?? 0.85;

  if (!COMPRESSIBLE.has(file.type)) return file;

  let decoded: DecodedImage | null = null;
  try {
    decoded = await decodeImage(file);
    if (decoded.width === 0 || decoded.height === 0) return file;

    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(decoded.source, 0, 0, width, height);

    // Prefer WebP; fall back to JPEG when the browser can't encode WebP.
    let blob = await encode(canvas, 'image/webp', quality);
    let outType = 'image/webp';
    if (!blob) {
      // JPEG has no alpha — composite onto white so transparency isn't black.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      blob = await encode(canvas, 'image/jpeg', quality);
      outType = 'image/jpeg';
    }

    // Keep the original if re-encoding didn't actually save bytes.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], swapExtension(file.name, outType), {
      type: outType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    decoded?.release();
  }
}

/** Decodes a file to a drawable source with EXIF orientation applied. */
async function decodeImage(file: File): Promise<DecodedImage> {
  // Preferred: createImageBitmap bakes in EXIF orientation and decodes off the
  // main thread. Falls back to an <img> element (also honors EXIF in modern
  // browsers) when unavailable or when the orientation option is rejected.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      /* fall through to the <img> path */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.decoding = 'async';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image decode failed'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Encodes a canvas to `type`. Resolves null when the browser can't produce that
 * type — `toBlob` silently falls back to PNG, which we detect via the blob's
 * own type so the caller can try the next format.
 */
function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob && blob.type === type ? blob : null), type, quality);
  });
}

/** Replaces a filename's extension to match the encoded output type. */
function swapExtension(name: string, type: string): string {
  const ext = type === 'image/webp' ? 'webp' : 'jpg';
  const base = name.replace(/\.[^./\\]+$/, '').trim() || 'photo';
  return `${base}.${ext}`;
}
