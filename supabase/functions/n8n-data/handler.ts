// n8n-data — the only endpoint the n8n Cloud automations may call.
//
// WHAT IT IS FOR
// Phase 1 of the marketing automation: a weekly report and social-media posts.
// Both are built from LISTING data and aggregates, which the public website
// already shows. Guest and host contact data is out of scope for this
// function — not "filtered out", but never selected in the first place.
//
// Phase 2 adds automated Instagram Reels. The video is rendered by a GitHub
// Actions job in a separate private repo, which holds NO Supabase credential:
// it receives one single-use signed upload URL per run and PUTs the MP4 to it.
// `reel-upload-url` mints that URL for a path this function chooses, and
// `reel-cleanup` deletes reels older than three days. Both touch exactly one
// bucket (social-videos) under exactly one prefix (reels/).
//
// SECURITY
// - n8n holds NO database credential and NOT the service-role key: it sends an
//   HTTP secret and gets shaped JSON back. The service-role client stays inside
//   Supabase (index.ts wires it in).
// - The secret is read from the `x-n8n-secret` header ONLY. A secret in the
//   body is ignored, because bodies land in logs and proxies far more often
//   than headers do.
// - Comparison is SHA-256 + constant time (_shared/adminAuth.ts), with no
//   length check and no early return; an unset N8N_DATA_SECRET denies
//   everything; every failure gets the same generic 401.
// - Failed attempts are throttled at 10 per client per 15 minutes → 429, using
//   the same admin_auth_failures table but under a SEPARATE KEY NAMESPACE.
//   See clientBucket() for why that matters.
// - Four actions exist, all on an explicit whitelist. The two that read data
//   read purpose-built PII-free sources only: marketing_weekly_stats
//   (aggregates) and public_properties (the same view the public site reads).
//   No base table is ever queried here. The two reel actions read nothing but
//   a listing id and touch nothing but the social-videos bucket.
// - The listing description is never returned as written: short_description
//   strips e-mails, phones, URLs, domains and @handles from it first.
// - Database errors are never echoed; the caller gets a generic 500.
//
// No Deno globals and no network imports, so it unit-tests with `node --test`
// (handler.test.ts).
import { isThrottled, passwordMatches, recordFailure, sha256Hex } from '../_shared/adminAuth.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

/**
 * The slice of the service-role Storage client the reel actions use. Narrowed
 * to four methods so the fake in handler.test.ts is the whole surface: nothing
 * here can reach a bucket or a method this type does not name.
 */
export interface StorageBucket {
  createSignedUploadUrl: (path: string) => Promise<{
    data: { signedUrl: string; token?: string; path?: string } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any;
  }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
  list: (prefix: string, options: { limit: number; offset: number }) => Promise<{
    data: Row[] | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remove: (paths: string[]) => Promise<{ data: Row[] | null; error: any }>;
}
export type Storage = { from: (bucket: string) => StorageBucket };

export interface N8nDataDeps {
  /** Service-role Supabase client. Never leaves this function. */
  db: Db;
  /** Service-role Storage client, for the two reel actions only. */
  storage?: Storage;
  /** Server-side N8N_DATA_SECRET. Empty/undefined denies every request. */
  secret: string | undefined;
  /** Diagnostics: action names and counts only, never payloads. */
  log?: (event: string, fields?: Record<string, string | number | boolean>) => void;
  /** Injectable clock, so the rotation and generated_at are testable. */
  now?: () => Date;
  /**
   * Injectable randomness for the reel object name. The caller never gets to
   * influence it — see reelPath(). Only handler.test.ts ever passes one.
   */
  randomId?: () => string;
}

export const FUNCTION_NAME = 'n8n-data';
export const STATS_VIEW = 'marketing_weekly_stats';
export const LISTINGS_VIEW = 'public_properties';
export const SITE_ORIGIN = 'https://rentcottage.ge';

/** Ceiling on how many listings one social call may take. */
export const MAX_LISTINGS = 10;

// ── Reels ────────────────────────────────────────────────────────────────────
//
// Phase 2: two Instagram Reels a week, rendered by a GitHub Actions job in a
// separate private repo. GitHub never holds a Supabase key — it is handed one
// single-use signed upload URL per run and PUTs the finished MP4 to it.
//
// The whole security argument rests on the PATH being chosen here:
// `reel-upload-url` takes a listing id and nothing else, and the signed URL it
// mints is scoped by Storage to that one object name. A caller (n8n, or
// anything that got hold of the n8n secret) cannot ask for a path, cannot
// overwrite an existing object, and cannot reach another bucket.

export const REELS_BUCKET = 'social-videos';
/** Every reel lives directly under this prefix. Nothing else is ever deleted. */
export const REELS_PREFIX = 'reels';
/** Supabase mints signed upload URLs with a two-hour life. Documented, not set. */
export const UPLOAD_URL_TTL_SECONDS = 7200;
/** A reel is published within minutes; after three days it is litter. */
export const REEL_RETENTION_DAYS = 3;
/** Objects examined per cleanup run: 20 pages of 100. */
export const CLEANUP_PAGE_SIZE = 100;
export const CLEANUP_MAX_PAGES = 20;
/** Storage takes a bounded list of names per delete call. */
export const CLEANUP_DELETE_BATCH = 100;

/**
 * The object name a reel may have: one flat segment of safe characters ending
 * in .mp4. This is both what reelPath() produces and what reel-cleanup will
 * agree to delete, so a name that somehow arrived by another route — a slash,
 * a "..", a leading dot — is never passed to remove().
 */
export const REEL_NAME_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9]{8,32}\.mp4$/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Exactly the listing columns a social post needs. This list is the second
 * security boundary (public_properties is the first): host_last_name does not
 * exist in the view at all, and host_last_initial is as much of a name as any
 * response here may carry — the same "First L." the public site shows.
 */
export const LISTING_COLUMNS =
  'id, title, location, property_type, price_per_night, max_guests, bedrooms, bathrooms, description, ' +
  'categories, cover_photo_url, photo_urls, host_first_name, host_last_initial, created_at';

/** Hard ceiling on short_description, "…" included (UTF-16 code units). */
export const SHORT_DESCRIPTION_MAX = 200;

/** Aggregate columns, mirroring marketing_weekly_stats. */
export const STATS_COLUMNS =
  'approved_listings, new_listings_7d, new_listings_30d, distinct_regions, listings_by_region, ' +
  'listings_by_category, price_min, price_avg, price_max, bookings_7d, bookings_30d, bookings_90d, ' +
  'confirmed_bookings_all_time, avg_booking_value';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/**
 * The throttle bucket for one n8n client.
 *
 * WHY THIS IS NAMESPACED. _shared/adminAuth.ts counts failures by `ip_hash`
 * alone — the budget is per client address and is shared by every function
 * that uses it. Two ways that could bite here:
 *   1. a caller with no x-forwarded-for falls into the shared constant bucket
 *      (sha256('unknown')), so a misconfigured n8n workflow retrying without
 *      that header could burn the budget that the admin panel's own
 *      no-header requests land in, and 429 the owner out of their admin;
 *   2. n8n Cloud runs on shared egress addresses, so in principle another
 *      tenant's address could collide with something else we throttle.
 * Hashing a namespaced preimage gives n8n a provably disjoint set of buckets
 * (different input → different digest) while leaving _shared/adminAuth.ts and
 * the three admin functions completely untouched. n8n can only ever throttle
 * n8n, and the admin can only ever throttle the admin.
 */
export async function clientBucket(req: Request): Promise<string> {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const first = xff.split(',')[0]?.trim() ?? '';
  return await sha256Hex(`${FUNCTION_NAME}:${first || 'unknown'}`);
}

/** The secret as this function accepts it: header only. */
export function providedSecret(req: Request): string {
  return req.headers.get('x-n8n-secret') ?? '';
}

/**
 * Deterministic per-day rotation.
 *
 * The catalogue is small (~100 listings) and a social workflow runs on a
 * schedule, so the selection must (a) differ from day to day, or the same
 * cottages get posted forever, and (b) be stable WITHIN a day, so a retry or a
 * second run of the same workflow posts the same thing instead of spamming a
 * fresh set. So: score every candidate with a cheap hash of its id plus the
 * current UTC day number, sort by that score, take the first `count`. Each day
 * is a different shuffle of the whole catalogue, every listing comes up over
 * time, and nothing needs to be stored between runs. `exclude_ids` lets the
 * caller drop what it posted recently, which is what makes consecutive runs
 * walk through the catalogue rather than revisit it.
 */
export function rotationSeed(now: Date): number {
  return Math.floor(now.getTime() / 86_400_000);
}

/**
 * FNV-1a plus a final avalanche mix — not cryptography, just a stable, well
 * spread score. The seed leads the preimage so that a one-day change alters
 * every subsequent step of the hash: with the seed trailing, consecutive days
 * produced visibly similar orderings and the rotation kept re-picking the same
 * few listings.
 */
export function rotationScore(id: string, seed: number): number {
  let h = 0x811c9dc5;
  const input = `${seed}:${id}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function pickRotating<T extends { id: string }>(rows: T[], count: number, seed: number): T[] {
  return [...rows]
    .map((row) => ({ row, score: rotationScore(row.id, seed) }))
    .sort((a, b) => (a.score - b.score) || (a.row.id < b.row.id ? -1 : 1))
    .slice(0, count)
    .map((s) => s.row);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// ── short_description ────────────────────────────────────────────────────────
//
// Hosts write descriptions freely, and some put their phone, e-mail, website or
// Instagram in them. The public site shows that text, but n8n turns it into
// social posts, so the contact data is removed here, server-side, before
// anything leaves the function — together with the sentence or line it sat in.
// The full description is never returned.
//
// Stripping errs towards removing too much: a missing-space typo like
// "sea.and" reads as a domain and is dropped, and any run of 7+ digits (a date
// like 12.05.2024 or a year range 2019-2023) reads as a phone. Losing a few
// words of a marketing blurb is harmless; posting a host's number is not.

/** Stands in for a removed contact; never survives into a response. */
export const CONTACT_MARK = '\u0000';
const MARK = CONTACT_MARK;
const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const URL_RE = /(?:\b(?:https?|ftp):\/\/|\bwww\.)[^\s<>"'«»]+/giu;
// ASCII labels + an all-lowercase or all-uppercase TLD: "something.ge",
// "Booking.com", "t.me/handle", "SITE.GE". A mixed-case TLD ("sea.It") is
// prose with a missing space and is left alone.
const DOMAIN_RE = /(?<![\p{L}\p{N}_-])(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+(?:[a-z]{2,24}|[A-Z]{2,24})(?![\p{L}\p{N}_-])(?:[/?#][^\s]*)?/gu;
const HANDLE_RE = /@[\p{L}\p{N}_.]+/gu;
// Digits joined by spaces, dashes, slashes, brackets or a dot that is directly
// followed by a digit (so "2019. 150 m²" is two numbers, not one phone).
// Counted afterwards: 7+ digits is a phone.
const PHONE_RUN_RE = /\+?\(?\+?\d(?:(?:[ ()\-‐‑–—/]|\.(?=\d))*\d)+\)?/gu;
const PHONE_MIN_DIGITS = 7;
// A contact label left dangling once its value is gone ("Tel:", "ტელ:", "Почта:").
const LABEL_RE = new RegExp(
  '(?<![\\p{L}\\p{N}])(?:tel|phone|mob|mobile|whatsapp|viber|telegram|e-?mail|mail|web|website|site|instagram|insta|facebook|fb|' +
  'contacts?|call|ტელ|ტელეფონი|მობ|მობილური|ელ-?ფოსტა|ფოსტა|საიტი|კონტაქტი|тел|телефон|моб|почта|эл\\. ?почта|' +
  'сайт|контакты|звоните)\\.?(?: (?:us|me|on|at|нам|по))*\\s*[:：\\-–]?\\s*' + MARK,
  'giu',
);

function stripPhones(text: string): string {
  return text.replace(PHONE_RUN_RE, (run) =>
    run.replace(/\D/g, '').length >= PHONE_MIN_DIGITS ? MARK : run);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const room = max - 1; // leave space for "…"
  let window = text.slice(0, room);
  if (/[\uD800-\uDBFF]$/.test(window)) window = window.slice(0, -1); // never split an emoji
  // Prefer a whole sentence, if that keeps at least half the room.
  const sentenceEnd = Math.max(...[...window.matchAll(/[.!?](?= )/g)].map((m) => m.index ?? -1), -1);
  if (sentenceEnd >= room / 2) {
    return window.slice(0, sentenceEnd + 1).replace(/\.$/, '') + '…';
  }
  const space = window.lastIndexOf(' ');
  const cut = space >= room / 2 ? window.slice(0, space) : window;
  return cut.replace(/[\s,;:\-–—(]+$/u, '') + '…';
}

/**
 * Every e-mail, URL, domain, @handle and phone number (and a contact label
 * left in front of one) replaced by CONTACT_MARK. Line breaks survive.
 * Each rule is applied separately — and tested separately — even though the
 * later ones would often catch what an earlier one missed.
 */
export function redactContacts(description: string): string {
  let text = description.replace(/[^\S\n]+/gu, ' ').replace(/ *\n */g, '\n');
  text = text.replace(EMAIL_RE, MARK);
  text = text.replace(URL_RE, MARK);
  text = text.replace(DOMAIN_RE, MARK);
  text = text.replace(HANDLE_RE, MARK);
  text = stripPhones(text);
  text = text.replace(/@/g, ''); // whatever is left of an address or a handle
  return text.replace(LABEL_RE, MARK);
}

/**
 * The description as a social post may use it: contact data removed, one line,
 * at most SHORT_DESCRIPTION_MAX characters, or null if nothing is left.
 */
export function shortDescription(description: unknown): string | null {
  if (typeof description !== 'string') return null;
  // A sentence or line that carried contact data is a "call us / write to us"
  // sentence: removing only the number leaves "Call or write to!". Drop it.
  const text = redactContacts(description)
    .split(/\n+|(?<=[.!?…]) +/u)
    .filter((segment) => !segment.includes(MARK))
    .join(' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+/gu, ' ')
    .replace(/^[\s,.;:|/\-–—·•]+|[\s,;:|/\-–—·•]+$/gu, '');
  // "Meaningful" = at least three letters in any script.
  if ((text.match(/\p{L}/gu) ?? []).length < 3) return null;
  return truncate(text, SHORT_DESCRIPTION_MAX);
}

/** "Nino" + "P" → "Nino P." — the display name the public site uses. */
export function displayName(first: unknown, initial: unknown): string {
  const f = asString(first);
  const i = asString(initial);
  if (!f) return 'Host';
  return i ? `${f} ${i[0].toUpperCase()}.` : f;
}

// ── Reel helpers ─────────────────────────────────────────────────────────────

/** UTC calendar date, so the path sorts and reads the same wherever it is run. */
function isoDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The object path for a new reel: `reels/<UTC date>-<random>.mp4`.
 *
 * Note what is NOT an argument: anything from the request body. The date comes
 * from the injected clock and the suffix from the injected RNG, so the only way
 * to change the path is to change this function. The result is asserted against
 * REEL_NAME_RE before it is used, which makes a future edit that let a caller's
 * string in fail loudly instead of quietly minting a URL for `../avatars/x`.
 */
export function reelPath(now: Date, randomId: () => string): string {
  const suffix = String(randomId()).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
  const name = `${isoDate(now)}-${suffix}.mp4`;
  if (!REEL_NAME_RE.test(name)) throw new HttpError(500, 'Request failed');
  return `${REELS_PREFIX}/${name}`;
}

/** 16 hex characters from the platform CSPRNG (Deno and Node both have it). */
export function defaultRandomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Whether one entry returned by `list('reels', …)` may be deleted.
 *
 * Three independent conditions, each of which alone would prevent a mistake:
 *   1. it is an object, not a folder or Storage's `.emptyFolderPlaceholder`
 *      (folders come back with a null id);
 *   2. its name is a single reel-shaped segment — no slash, no `..`, so the
 *      path handed to remove() cannot climb out of `reels/`;
 *   3. it is strictly older than REEL_RETENTION_DAYS, by its own created_at.
 *      An unparseable or missing created_at is treated as "too young", because
 *      the safe failure here is to keep a file, not to delete one.
 */
export function isExpiredReel(entry: Row, now: Date): boolean {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.id !== 'string' || entry.id === '') return false;
  const name = typeof entry.name === 'string' ? entry.name : '';
  if (!REEL_NAME_RE.test(name)) return false;
  const created = Date.parse(String(entry.created_at ?? ''));
  if (!Number.isFinite(created)) return false;
  return now.getTime() - created > REEL_RETENTION_DAYS * 86_400_000;
}

/**
 * How many distinct photos a listing has: the cover plus photo_urls, trimmed
 * and de-duplicated, because the cover is usually also the first of the
 * photo_urls and would otherwise be counted twice. This is the number
 * `min_photos` filters on, and it is the number the renderer actually has to
 * work with.
 */
export function photoCount(row: Row): number {
  const urls = [
    row.cover_photo_url,
    ...(Array.isArray(row.photo_urls) ? row.photo_urls : []),
  ];
  const seen = new Set<string>();
  for (const u of urls) {
    const s = asString(u);
    if (s) seen.add(s);
  }
  return seen.size;
}

type Action = (
  body: Row,
  deps: Required<Pick<N8nDataDeps, 'db' | 'now' | 'randomId'>> & { storage?: Storage },
) => Promise<Row>;

/**
 * The keys weekly-report publishes, in order. The view is the first boundary;
 * this list is the second, so a column added to the view later (by accident or
 * by a future migration) does not silently start flowing to n8n.
 */
export const STATS_KEYS = [
  'approved_listings', 'new_listings_7d', 'new_listings_30d', 'distinct_regions',
  'listings_by_region', 'listings_by_category', 'price_min', 'price_avg', 'price_max',
  'bookings_7d', 'bookings_30d', 'bookings_90d', 'confirmed_bookings_all_time', 'avg_booking_value',
] as const;

/** a) The weekly report: one row of aggregates, plus when it was generated. */
const weeklyReport: Action = async (_body, { db, now }) => {
  const { data, error } = await db.from(STATS_VIEW).select(STATS_COLUMNS).limit(1);
  if (error) throw new HttpError(500, 'Request failed');
  const row = (Array.isArray(data) ? data[0] : null) as Row | null;
  if (!row) throw new HttpError(500, 'Request failed');
  const stats: Row = {};
  for (const key of STATS_KEYS) stats[key] = row[key] ?? null;
  return { generated_at: now().toISOString(), stats };
};

/** b) Listings for a social post — see pickRotating for the rotation rule. */
const listingsForSocial: Action = async (body, { db, now }) => {
  let count = 3;
  if (body.count !== undefined) {
    if (typeof body.count !== 'number' || !Number.isInteger(body.count) || body.count < 1 || body.count > MAX_LISTINGS) {
      throw new HttpError(400, 'Invalid count');
    }
    count = body.count;
  }

  const category = body.category === undefined ? null : asString(body.category);
  if (body.category !== undefined && !category) throw new HttpError(400, 'Invalid category');
  const region = body.region === undefined ? null : asString(body.region);
  if (body.region !== undefined && !region) throw new HttpError(400, 'Invalid region');

  // A reel needs several photos to be worth rendering; a listing with one
  // picture makes a slideshow of the same frame. The count is computed here
  // rather than in SQL because "how many photos" means the de-duplicated union
  // of the cover and photo_urls — see photoCount().
  let minPhotos = 0;
  if (body.min_photos !== undefined) {
    if (typeof body.min_photos !== 'number' || !Number.isInteger(body.min_photos)
        || body.min_photos < 0 || body.min_photos > 50) {
      throw new HttpError(400, 'Invalid min_photos');
    }
    minPhotos = body.min_photos;
  }

  let excludeIds: string[] = [];
  if (body.exclude_ids !== undefined) {
    if (!Array.isArray(body.exclude_ids) || body.exclude_ids.length > 200
        || !body.exclude_ids.every((id: unknown) => typeof id === 'string')) {
      throw new HttpError(400, 'Invalid exclude_ids');
    }
    excludeIds = body.exclude_ids as string[];
  }

  let query = db.from(LISTINGS_VIEW).select(LISTING_COLUMNS);
  if (category) query = query.contains('categories', [category]);
  if (region) query = query.ilike('location', `%${region}%`);
  const { data, error } = await query;
  if (error) throw new HttpError(500, 'Request failed');

  const excluded = new Set(excludeIds);
  const candidates = ((data ?? []) as Row[])
    .filter((r) => typeof r.id === 'string' && !excluded.has(r.id))
    .filter((r) => photoCount(r) >= minPhotos);

  const seed = rotationSeed(now());
  const listings = pickRotating(candidates as { id: string }[], count, seed).map((row) => {
    const r = row as Row;
    return {
      id: r.id,
      title: r.title ?? null,
      location: r.location ?? null,
      property_type: r.property_type ?? null,
      price_per_night: r.price_per_night ?? null,
      max_guests: asNumber(r.max_guests),
      bedrooms: asNumber(r.bedrooms),
      bathrooms: asNumber(r.bathrooms),
      short_description: shortDescription(r.description),
      categories: Array.isArray(r.categories) ? r.categories : [],
      cover_photo_url: r.cover_photo_url ?? (Array.isArray(r.photo_urls) ? r.photo_urls[0] ?? null : null),
      photo_urls: Array.isArray(r.photo_urls) ? r.photo_urls : [],
      host_display_name: displayName(r.host_first_name, r.host_last_initial),
      url: `${SITE_ORIGIN}/property/${r.id}`,
    };
  });

  return {
    generated_at: now().toISOString(),
    rotation_seed: seed,
    available: candidates.length,
    returned: listings.length,
    listings,
  };
};

/**
 * c) One single-use signed upload URL for one reel.
 *
 * The caller says WHICH LISTING the reel is for and nothing else. The listing
 * id is validated as a uuid and checked against public_properties — not
 * because the path depends on it (it does not), but so that this action cannot
 * be used as an open URL-minting oracle: no listing, no URL.
 *
 * `upsert` is deliberately not enabled. A signed upload URL for a path that
 * already holds an object is refused by Storage, so a leaked URL cannot be
 * replayed to replace a published video.
 */
const reelUploadUrl: Action = async (body, { db, now, randomId, storage }) => {
  if (!storage) throw new HttpError(500, 'Request failed');

  const listingId = asString(body.listing_id);
  if (!listingId || !UUID_RE.test(listingId)) throw new HttpError(400, 'Invalid listing_id');

  const { data, error } = await db.from(LISTINGS_VIEW).select('id').eq('id', listingId).limit(1);
  if (error) throw new HttpError(500, 'Request failed');
  if (!Array.isArray(data) || data.length === 0) throw new HttpError(400, 'Unknown listing');

  const path = reelPath(now(), randomId);
  const bucket = storage.from(REELS_BUCKET);
  const signed = await bucket.createSignedUploadUrl(path);
  if (signed.error || !signed.data?.signedUrl) throw new HttpError(500, 'Request failed');

  const publicUrl = bucket.getPublicUrl(path).data?.publicUrl;
  if (typeof publicUrl !== 'string' || publicUrl === '') throw new HttpError(500, 'Request failed');

  return {
    generated_at: now().toISOString(),
    path,
    upload_url: signed.data.signedUrl,
    public_url: publicUrl,
    expires_in: UPLOAD_URL_TTL_SECONDS,
  };
};

/**
 * d) Delete reels older than REEL_RETENTION_DAYS.
 *
 * Scoped three times over: `list` is asked for the `reels` prefix only, every
 * entry must satisfy isExpiredReel(), and the path handed to remove() is
 * rebuilt here as `reels/<name>` from a name that matched REEL_NAME_RE. There
 * is no code path in which a string from the request body reaches remove().
 */
const reelCleanup: Action = async (_body, { now, storage }) => {
  if (!storage) throw new HttpError(500, 'Request failed');
  const bucket = storage.from(REELS_BUCKET);
  const at = now();

  const doomed: string[] = [];
  let scanned = 0;
  for (let page = 0; page < CLEANUP_MAX_PAGES; page++) {
    const { data, error } = await bucket.list(REELS_PREFIX, {
      limit: CLEANUP_PAGE_SIZE,
      offset: page * CLEANUP_PAGE_SIZE,
    });
    if (error) throw new HttpError(500, 'Request failed');
    const entries = (data ?? []) as Row[];
    scanned += entries.length;
    for (const entry of entries) {
      if (isExpiredReel(entry, at)) doomed.push(`${REELS_PREFIX}/${entry.name}`);
    }
    if (entries.length < CLEANUP_PAGE_SIZE) break;
  }

  let deleted = 0;
  for (let i = 0; i < doomed.length; i += CLEANUP_DELETE_BATCH) {
    const batch = doomed.slice(i, i + CLEANUP_DELETE_BATCH);
    const { error } = await bucket.remove(batch);
    if (error) throw new HttpError(500, 'Request failed');
    deleted += batch.length;
  }

  return { generated_at: at.toISOString(), scanned, deleted };
};

export const ACTIONS: Record<string, Action> = {
  'weekly-report': weeklyReport,
  'listings-for-social': listingsForSocial,
  'reel-upload-url': reelUploadUrl,
  'reel-cleanup': reelCleanup,
};

const ALLOWED_ORIGIN_RE = /^https:\/\/(www\.)?rentcottage\.ge$/;

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'content-type, x-n8n-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  // n8n is server-to-server and sends no Origin; browsers get nothing back.
  if (ALLOWED_ORIGIN_RE.test(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function createHandler(deps: N8nDataDeps): (req: Request) => Promise<Response> {
  const log = deps.log ?? (() => {});
  const now = deps.now ?? (() => new Date());
  const randomId = deps.randomId ?? defaultRandomId;

  return async (req: Request): Promise<Response> => {
    const cors = corsFor(req);
    const json = (body: Row, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: cors });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    // Gate first: nothing below this point runs for an unauthenticated caller,
    // and no data source is touched.
    const bucket = await clientBucket(req);
    if (await isThrottled(deps.db, bucket)) {
      log('throttled');
      return json({ error: 'Too many attempts' }, 429);
    }
    if (!(await passwordMatches(providedSecret(req), deps.secret))) {
      await recordFailure(deps.db, bucket, FUNCTION_NAME);
      log('unauthorized');
      return json({ error: 'Unauthorized' }, 401);
    }

    let body: Row;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      body = parsed as Row;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const action = typeof body.action === 'string' ? body.action : '';
    const run = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : undefined;
    if (!run) return json({ error: 'Unsupported action' }, 400);

    try {
      const result = await run(body, { db: deps.db, now, randomId, storage: deps.storage });
      const fields: Record<string, string | number | boolean> = {
        action,
        returned: typeof result.returned === 'number' ? result.returned : 0,
      };
      // Counts only. The path and the signed URL are never logged: the URL
      // carries its own upload token, so a log line holding it would be a
      // credential at rest.
      if (typeof result.deleted === 'number') fields.deleted = result.deleted;
      log('ok', fields);
      return json(result);
    } catch (e) {
      if (e instanceof HttpError) {
        log('rejected', { action, status: e.status });
        return json({ error: e.message }, e.status);
      }
      log('failed', { action });
      return json({ error: 'Request failed' }, 500);
    }
  };
}
