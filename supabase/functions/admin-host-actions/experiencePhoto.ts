/**
 * Validation for the admin's experience-photo uploads.
 *
 * The experience-photos bucket no longer accepts anon writes (migration
 * 20260918130000): the admin panel asks this function for a short-lived signed
 * upload URL instead. The path and the content type are decided HERE, from a
 * validated filename — never taken from the client — so a caller who somehow
 * gets past the password gate still cannot choose where the file lands or what
 * it claims to be.
 *
 * Pure and dependency-free so it can be unit-tested with `node --test`.
 */

export const EXPERIENCE_BUCKET = 'experience-photos';

/** Content types the bucket is meant to hold. */
export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/** Extension per content type — the extension is derived, not trusted. */
const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Everything uploaded through this action lives under one prefix. */
export const EXPERIENCE_PREFIX = 'experiences/';

export type PathResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * A safe object path for one upload.
 *
 * `filename` only contributes a slug: separators, dots and anything outside
 * [A-Za-z0-9-_] are dropped, so "../../etc/passwd" cannot escape the prefix and
 * ".." cannot appear at all. Uniqueness comes from the caller-supplied
 * timestamp and random suffix, so an upload can never overwrite an existing
 * object (the signed URL is minted without upsert).
 */
export function buildExperiencePhotoPath(
  filename: unknown,
  contentType: unknown,
  now: number,
  random: string,
): PathResult {
  if (typeof contentType !== 'string' || !(contentType in EXTENSION)) {
    return { ok: false, error: 'Unsupported content type' };
  }
  if (typeof filename !== 'string' || filename.length === 0 || filename.length > 200) {
    return { ok: false, error: 'Invalid filename' };
  }
  const base = filename.replace(/\.[^.]*$/, '');
  const slug = base.replace(/[^A-Za-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const rand = random.replace(/[^a-z0-9]/g, '').slice(0, 6) || '000000';
  const ext = EXTENSION[contentType];
  return { ok: true, path: `${EXPERIENCE_PREFIX}${now}-${rand}-${slug || 'photo'}.${ext}` };
}
