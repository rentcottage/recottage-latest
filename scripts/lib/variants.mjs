// The property-photo variant naming rule, for Node scripts.
// Must match variantPath()/PHOTO_VARIANTS in src/lib/imageUrl.ts —
// tests/frontend/imageUrl.test.ts asserts the two agree.

export const PHOTO_BUCKET = 'property-photos';

export const PHOTO_VARIANTS = {
  thumb: { edge: 400, quality: 70 },
  large: { edge: 1600, quality: 78 },
};

export const VARIANT_RE = /-(400|1600)\.webp$/i;

/** `<dir>/<name>.<ext>` → `<dir>/<name>-<edge>.webp` (last extension only). */
export function variantPath(path, edge) {
  const slash = path.lastIndexOf('/');
  const dir = path.slice(0, slash + 1);
  const file = path.slice(slash + 1);
  const dot = file.lastIndexOf('.');
  const base = dot > 0 ? file.slice(0, dot) : file;
  return `${dir}${base}-${edge}.webp`;
}
