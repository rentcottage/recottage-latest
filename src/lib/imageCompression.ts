/**
 * Client-side image compression for host photo uploads.
 *
 * Host cameras produce large JPEGs (measured up to ~3.6 MB each). We re-encode
 * them in the browser BEFORE upload to cut permanent storage: downscale to a
 * sane maximum edge and re-encode. Host uploads (src/lib/photoUpload.ts) use
 * JPEG q0.8 at ≤2000px, like the existing originals; the admin Photo Manager
 * uses the WebP default. Typically 60–90% smaller than the raw camera file. The
 * smaller display sizes (-400 / -1600 WebP) are stored next to the original by
 * src/lib/photoUpload.ts; see src/lib/imageUrl.ts.
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
  /**
   * Output format. 'webp' (default, the admin Photo Manager relies on it) or
   * 'jpeg' — host uploads, matching what scripts/compress-originals.mjs did to
   * the existing originals. With 'jpeg', an image with real transparency
   * (any pixel not fully opaque) is kept as PNG instead.
   */
  format?: 'webp' | 'jpeg';
}

/** Width/height scaled so the longest edge is at most `maxEdge`; never upscales. */
export function scaleToFit(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** True if any pixel in RGBA data is not fully opaque. */
export function hasTransparentPixel(rgba: ArrayLike<number>): boolean {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) return true;
  return false;
}

/** The MIME type to encode to, given the requested format and the input. */
export function pickOutputType(format: 'webp' | 'jpeg', inputType: string, transparent: boolean): 'image/webp' | 'image/jpeg' | 'image/png' {
  if (format === 'webp') return 'image/webp';
  // JPEG has no alpha. Only formats that can carry alpha are checked.
  if (transparent && (inputType === 'image/png' || inputType === 'image/webp')) return 'image/png';
  return 'image/jpeg';
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
  const format = options.format ?? 'webp';

  if (!COMPRESSIBLE.has(file.type)) return file;

  let decoded: DecodedImage | null = null;
  try {
    decoded = await decodeImage(file);
    if (decoded.width === 0 || decoded.height === 0) return file;

    const { width, height } = scaleToFit(decoded.width, decoded.height, maxEdge);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, width, height);

    let blob: Blob | null;
    let outType: string;
    if (format === 'jpeg') {
      const canHaveAlpha = file.type === 'image/png' || file.type === 'image/webp';
      const transparent = canHaveAlpha && hasTransparentPixel(ctx.getImageData(0, 0, width, height).data);
      outType = pickOutputType('jpeg', file.type, transparent);
      if (outType === 'image/jpeg') flattenOnWhite(ctx, width, height);
      blob = await encode(canvas, outType, quality);
    } else {
      // Prefer WebP; fall back to JPEG when the browser can't encode WebP.
      blob = await encode(canvas, 'image/webp', quality);
      outType = 'image/webp';
      if (!blob) {
        flattenOnWhite(ctx, width, height);
        blob = await encode(canvas, 'image/jpeg', quality);
        outType = 'image/jpeg';
      }
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

/** JPEG has no alpha — composite onto white so transparency isn't black. */
function flattenOnWhite(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Re-encodes `file` as WebP with its longest edge capped at `maxEdge` (never
 * upscaled). Used for the stored -400 / -1600 display variants. Resolves null
 * when the type isn't compressible, decoding fails, or this browser can't
 * encode WebP — callers treat that as "no variant", which the display side
 * already handles by falling back to the original. Never throws.
 */
export async function resizeToWebp(file: File, maxEdge: number, quality: number): Promise<Blob | null> {
  if (!COMPRESSIBLE.has(file.type)) return null;
  let decoded: DecodedImage | null = null;
  try {
    decoded = await decodeImage(file);
    if (decoded.width === 0 || decoded.height === 0) return null;
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    return await encode(canvas, 'image/webp', quality);
  } catch {
    return null;
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
export function swapExtension(name: string, type: string): string {
  const ext = type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg';
  const base = name.replace(/\.[^./\\]+$/, '').trim() || 'photo';
  return `${base}.${ext}`;
}
