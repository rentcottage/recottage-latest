/**
 * Landing pages: /cottages/<slug>
 *
 * Three kinds of page, one flat namespace:
 *   region    /cottages/kakheti      every cottage regionMatches() puts in Kakheti
 *   city      /cottages/ambrolauri   every cottage in one canonical town or resort
 *   category  /cottages/mountain     every cottage carrying that category
 *
 * WHY FLAT. "/region/x" spends a path segment on a word nobody searches. The
 * cost of a flat namespace is that a city and a category could one day claim
 * the same slug, so assertUniqueSlugs() exists and the BUILD FAILS if that
 * ever happens, rather than one page silently overwriting the other.
 *
 * NOTHING IS TRANSLITERATED. Georgian place names are resolved to the
 * canonical ASCII keys that already exist in src/data/regions.json — the same
 * keys regionMatches() and the search page use. "ამბროლაური" becomes
 * "ambrolauri" by dictionary lookup, never by a romanisation rule invented
 * here, so a slug cannot drift from what the search page thinks that place is.
 *
 * This module is mirrored by scripts/lib/landing.mjs, which builds the same
 * pages at build time (a build script cannot import TypeScript). The mirror is
 * pinned by tests/frontend/landing.test.ts, which runs both over every real
 * production location string and asserts they agree.
 */
import regionsData from '../data/regions.json' with { type: 'json' };
import { regionMatches } from './locationNormalizer.ts';

const { regionAliases, cityToRegion, enToKa } = regionsData as {
  regionAliases: Record<string, string[]>;
  cityToRegion: Record<string, string>;
  enToKa: Record<string, string[]>;
};

export type LandingKind = 'region' | 'city' | 'category';

export interface LandingListing {
  id: string;
  title: string;
  location: string;
  price_per_night: number | string | null;
  max_guests?: number | null;
  bedrooms?: number | null;
  categories?: string[] | null;
  cover_photo_url?: string | null;
  photo_urls?: string[] | null;
}

/** A page is built only when at least this many cottages would be on it. */
export const MIN_LISTINGS = 3;

/** The six categories a listing may carry, in the order the site uses them. */
export const CATEGORIES = ['Mountain', 'Countryside', 'Forest', 'Traditional', 'Lakeside', 'Winery'] as const;

/**
 * `svaneti` and `samegrelo-zemo svaneti` resolve to the SAME listings — Mestia
 * is in both by every alias the normaliser knows. Two URLs for one set of
 * cottages is duplicate content, so only the shorter, more searched name is
 * built. Nothing is hidden: the listings are all on /cottages/svaneti.
 */
export const REGION_DUPLICATES = new Set(['samegrelo-zemo svaneti']);

// ── Slugs ────────────────────────────────────────────────────────────────────

/** A canonical key ("kvemo kartli") as it appears in a URL ("kvemo-kartli"). */
export function toSlug(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
}

/** Throws when two pages would claim one URL. Called by the build. */
export function assertUniqueSlugs(slugs: string[]): void {
  const seen = new Set<string>();
  for (const s of slugs) {
    if (seen.has(s)) {
      throw new Error(`Landing page slug collision: "${s}" is claimed by two pages`);
    }
    seen.add(s);
  }
}

// ── Canonical city ───────────────────────────────────────────────────────────

const norm = (s: string): string => s.replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
/** Drops the stray punctuation hosts leave behind: "ბაზალეთი . " → "ბაზალეთი". */
const tidy = (s: string): string => norm(s.replace(/^[\s.,;:·•]+|[\s.,;:·•]+$/gu, ''));

/** "ამბროლაურის რაიონი" → "ამბროლაური". Same rules as the normaliser's. */
function stripAdminSuffix(part: string): string {
  const stripped = part
    .replace(/\s*(რაიონი|მუნიციპალიტეტი|მხარე)\s*$/u, '')
    .replace(/^\s*(სოფელი|სოფ\.|სოფ|დაბა|ქალაქი|ქ\.)\s+/u, '')
    .trim();
  if (stripped === part) return part;
  return stripped.length > 3 && stripped.endsWith('ს') ? stripped.slice(0, -1) : stripped;
}

const REGION_KEYS = new Set(Object.keys(regionAliases));

/**
 * Two English keys that carry an IDENTICAL Georgian name are one place:
 * `keda` and `qeda` are both ქედა, and left alone they would split one town
 * across two pages of 3 and 5. The merge is read out of the dictionary, not
 * asserted here — places whose Georgian names differ (kazbegi and
 * stepantsminda) stay separate, because nothing in the data says otherwise.
 */
const CANONICAL_CITY: Record<string, string> = (() => {
  const byGeorgianName: Record<string, string[]> = {};
  for (const [en, kaNames] of Object.entries(enToKa)) {
    if (REGION_KEYS.has(en) || !cityToRegion[en]) continue;
    const signature = kaNames.map((k) => norm(k.toLowerCase())).sort().join('|');
    (byGeorgianName[signature] ||= []).push(en);
  }
  const out: Record<string, string> = {};
  for (const group of Object.values(byGeorgianName)) {
    const canonical = [...group].sort()[0];
    for (const en of group) out[en] = canonical;
  }
  return out;
})();

const KA_TO_EN: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [en, kaNames] of Object.entries(enToKa)) {
    if (REGION_KEYS.has(en) || !cityToRegion[en]) continue;
    for (const ka of kaNames) out[norm(ka.toLowerCase())] = en;
  }
  return out;
})();

/** Every known place name, longest first, so "ონი" cannot win inside a longer name. */
const CITY_NAMES: [string, string][] = [
  ...Object.keys(cityToRegion).map((c) => [c, c] as [string, string]),
  ...Object.entries(KA_TO_EN),
]
  .filter(([name, en]) => name.length >= 4 && !REGION_KEYS.has(en))
  .sort((a, b) => b[0].length - a[0].length);

function wholeWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`, 'u').test(haystack);
}

/**
 * The canonical city key for a stored location string, or null when the string
 * names no town the dictionary knows ("რაჭა" is a region; "Sioni lake, Georgia"
 * is not a town). A listing with no city still appears on its region page.
 */
export function canonicalCity(location: string | null | undefined): string | null {
  if (!location) return null;
  const parts = norm(String(location).toLowerCase())
    .split(',')
    .map((p) => stripAdminSuffix(tidy(p)))
    .filter(Boolean);

  for (const part of parts) {
    if (cityToRegion[part]) return CANONICAL_CITY[part] ?? part;
    if (KA_TO_EN[part]) {
      const en = KA_TO_EN[part];
      return CANONICAL_CITY[en] ?? en;
    }
  }
  // A name embedded in a longer phrase: "რაჭა ამბროლაურის რაიონი სოფ . ჯვარისა".
  for (const part of parts) {
    for (const [name, en] of CITY_NAMES) {
      if (wholeWord(part, name)) return CANONICAL_CITY[en] ?? en;
    }
  }
  return null;
}

/** The canonical region a city sits in, per the dictionary. */
export function regionForCity(cityKey: string): string | null {
  return cityToRegion[cityKey] ?? null;
}

// ── Grouping ─────────────────────────────────────────────────────────────────

export interface LandingGroup {
  kind: LandingKind;
  /** Canonical key: 'kakheti', 'ambrolauri', 'Mountain'. */
  key: string;
  slug: string;
  listings: LandingListing[];
}

function sortListings(rows: LandingListing[]): LandingListing[] {
  // Stable and price-ascending, so the page is deterministic build to build.
  return [...rows].sort(
    (a, b) => (Number(a.price_per_night) || 0) - (Number(b.price_per_night) || 0)
      || (a.id < b.id ? -1 : 1),
  );
}

/** Every page worth building, from the listings given. */
export function buildGroups(listings: LandingListing[]): LandingGroup[] {
  const groups: LandingGroup[] = [];

  for (const key of Object.keys(regionAliases)) {
    if (REGION_DUPLICATES.has(key)) continue;
    const rows = listings.filter((l) => regionMatches(l.location, key));
    if (rows.length >= MIN_LISTINGS) {
      groups.push({ kind: 'region', key, slug: toSlug(key), listings: sortListings(rows) });
    }
  }

  const byCity = new Map<string, LandingListing[]>();
  for (const l of listings) {
    const city = canonicalCity(l.location);
    if (!city) continue;
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city)!.push(l);
  }
  for (const [key, rows] of byCity) {
    if (rows.length >= MIN_LISTINGS) {
      groups.push({ kind: 'city', key, slug: toSlug(key), listings: sortListings(rows) });
    }
  }

  for (const key of CATEGORIES) {
    const rows = listings.filter((l) => Array.isArray(l.categories) && l.categories.includes(key));
    if (rows.length >= MIN_LISTINGS) {
      groups.push({ kind: 'category', key, slug: toSlug(key), listings: sortListings(rows) });
    }
  }

  assertUniqueSlugs(groups.map((g) => g.slug));
  return groups;
}

/** The group a URL slug refers to, or undefined. Used by the client route. */
export function findGroup(groups: LandingGroup[], slug: string): LandingGroup | undefined {
  return groups.find((g) => g.slug === slug.toLowerCase());
}
