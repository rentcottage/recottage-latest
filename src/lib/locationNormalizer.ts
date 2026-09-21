/**
 * Bilingual location normalizer — Georgian ↔ English
 *
 * Strategy:
 * 1. A comprehensive EN_TO_KA dictionary covers every city/village in georgianCities
 * 2. A reverse KA_TO_EN map is auto-built from EN_TO_KA
 * 3. REGION_ALIASES maps every region to all its English + Georgian name variants
 * 4. getSearchTokens() expands any query into all equivalent forms in both scripts
 * 5. locationMatches() uses those tokens for robust bilingual city matching
 * 6. regionMatches() uses REGION_ALIASES for robust bilingual region matching
 * 7. filterCitiesBilingual() powers autocomplete suggestions bilingually
 */

// The region names and the city -> region map live in src/data/regions.json
// rather than in this file. They are pure data, and scripts/lib/landing.mjs
// needs the same data at BUILD time to group listings onto the /cottages/<slug>
// landing pages. A build script cannot import TypeScript (it runs under
// whatever Node the deploy platform provides), but both sides can read JSON —
// so this is one source of truth instead of two copies that drift.
//
// Nothing else about this module changed: the two exports below have the same
// names, the same types and the same contents as the literals they replaced.
import regionsData from '../data/regions.json' with { type: 'json' };

/**
 * All name variants (English + Georgian) for each Georgian region.
 * Used by regionMatches() so filtering by any variant finds all properties
 * whose location string contains any other variant of the same region.
 */
export const REGION_ALIASES: Record<string, string[]> = regionsData.regionAliases;

/** Map of canonical English name (lowercase) → Georgian script equivalents */
export const EN_TO_KA: Record<string, string[]> = regionsData.enToKa;

/** Reverse map: Georgian (lowercase) → canonical English key */
const KA_TO_EN: Record<string, string> = {};
for (const [en, kaList] of Object.entries(EN_TO_KA)) {
  for (const ka of kaList) {
    KA_TO_EN[ka.toLowerCase()] = en;
  }
}

/**
 * Places known by more than one name, keyed by EN_TO_KA key. Kazbegi is the
 * old (and still common) name of Stepantsminda, so hosts save either one —
 * searching for one name must also find listings saved under the other.
 */
const PLACE_SYNONYMS: string[][] = [
  ['kazbegi', 'stepantsminda'],
];

/**
 * Returns all search tokens for a given query string.
 * Expands any query into all equivalent forms in both scripts.
 */
export function getSearchTokens(query: string): string[] {
  const q = query.toLowerCase().trim();
  const tokens = new Set<string>([q]);

  // Expand synonyms first so the bilingual passes below cover every name.
  for (const group of PLACE_SYNONYMS) {
    const names = group.flatMap((en) => [en, ...(EN_TO_KA[en] || []).map((ka) => ka.toLowerCase())]);
    if (names.some((n) => q === n || q.includes(n))) {
      names.forEach((n) => tokens.add(n));
    }
  }

  // Try EN → KA: check if query matches or contains any English key
  for (const [en, kaList] of Object.entries(EN_TO_KA)) {
    if (q === en || q.includes(en) || en.includes(q)) {
      tokens.add(en);
      kaList.forEach(ka => tokens.add(ka.toLowerCase()));
    }
  }

  // Try KA → EN: check if query matches or contains any Georgian value
  for (const [ka, en] of Object.entries(KA_TO_EN)) {
    if (q === ka || q.includes(ka) || ka.includes(q)) {
      tokens.add(ka);
      tokens.add(en);
      const kaVariants = EN_TO_KA[en] || [];
      kaVariants.forEach(v => tokens.add(v.toLowerCase()));
    }
  }

  return Array.from(tokens).filter(Boolean);
}

/**
 * Returns true if a property location string matches the search query,
 * considering both Georgian and English equivalents.
 */
export function locationMatches(propertyLocation: string, searchQuery: string): boolean {
  if (!searchQuery.trim()) return true;
  if (!propertyLocation) return false;

  const propLower = propertyLocation.toLowerCase();

  // Expand the search query into all bilingual tokens
  const tokens = getSearchTokens(searchQuery);

  // Also expand just the city part (before first comma) separately
  const cityPart = searchQuery.split(',')[0].trim();
  const cityTokens = cityPart !== searchQuery ? getSearchTokens(cityPart) : [];

  const allTokens = [...new Set([...tokens, ...cityTokens])].filter(t => t.length > 0);

  for (const token of allTokens) {
    if (propLower.includes(token)) return true;

    // Also check the property's city part (before comma) against the token
    const propCity = propLower.split(',')[0].trim();
    if (propCity.includes(token) || token.includes(propCity)) return true;
  }

  return false;
}

/**
 * CITY_TO_REGION — maps every city/village name (lowercase English) to its
 * canonical region key (matching keys in REGION_ALIASES).
 *
 * This is the core lookup that makes region filtering work even when the host
 * only saved the city name (e.g. "Telavi") without the region name ("Kakheti").
 *
 * Built from georgianCities data — covers all 300+ cities/villages.
 */
export const CITY_TO_REGION: Record<string, string> = regionsData.cityToRegion;

/**
 * Also build a Georgian-script → region key map from EN_TO_KA + CITY_TO_REGION.
 * This lets us look up Georgian city names (e.g. "თელავი") → region key ("kakheti").
 */
const KA_CITY_TO_REGION: Record<string, string> = {};
for (const [enCity, regionKey] of Object.entries(CITY_TO_REGION)) {
  const kaVariants = EN_TO_KA[enCity];
  if (kaVariants) {
    for (const ka of kaVariants) {
      KA_CITY_TO_REGION[ka.toLowerCase()] = regionKey;
    }
  }
}

/**
 * Normalizes a location/region string by collapsing spaces around dashes
 * and trimming extra whitespace. This handles cases like "სამცხე- ჯავახეთი"
 * (space after dash) which should match "სამცხე-ჯავახეთი".
 */
function normalizeSpacing(s: string): string {
  return s
    .replace(/\s*-\s*/g, '-') // collapse spaces around dashes: "a - b" → "a-b"
    .replace(/\s+/g, ' ')     // collapse multiple spaces
    .trim();
}

/**
 * Returns true if `haystack` contains `needle` as a whole word / token,
 * not just as a substring. This prevents "ჯავა" (Java city) from matching
 * inside "ჯავახეთი" (Javakheti region).
 *
 * A "word boundary" here means the needle is surrounded by non-alphanumeric
 * characters (spaces, commas, dashes, start/end of string).
 */
function containsWholeWord(haystack: string, needle: string): boolean {
  if (!needle || !haystack) return false;
  // Escape special regex characters in the needle
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match needle surrounded by word separators or string boundaries
  const re = new RegExp(`(?:^|[\\s,;.\\-/])${escaped}(?:$|[\\s,;.\\-/])`, 'i');
  return re.test(haystack);
}

/**
 * Georgian writes "<city> district / municipality" by putting the city in the
 * genitive: "ონი" -> "ონის რაიონი", "ამბროლაური" -> "ამბროლაურის მუნიციპალიტეტი".
 * Hosts type it that way, so drop the administrative word and the trailing
 * genitive "ს" to recover the bare city name the dictionaries are keyed on.
 * Also drops the "სოფელი / სოფ." ("village") prefix for the same reason.
 */
function stripGeorgianAdminSuffix(part: string): string {
  const stripped = part
    .replace(/\s*(რაიონი|მუნიციპალიტეტი|მხარე)\s*$/u, '')
    .replace(/^\s*(სოფელი|სოფ\.|სოფ|დაბა|ქალაქი|ქ\.)\s+/u, '')
    .trim();
  if (stripped === part) return part;
  // Genitive "ს" — only drop it when a plausible stem is left behind.
  return stripped.length > 3 && stripped.endsWith('ს') ? stripped.slice(0, -1) : stripped;
}

/**
 * Given a property location string (e.g. "Telavi, Kakheti" or "თელავი" or "Telavi"),
 * returns the canonical region key (e.g. "kakheti") if it can be determined.
 * Returns null if no region can be inferred.
 */
function inferRegionFromLocation(propertyLocation: string): string | null {
  const propLower = normalizeSpacing(propertyLocation.toLowerCase().trim());

  // Split by comma — try each part as a city or region name
  const parts = propLower
    .split(',')
    .map(p => normalizeSpacing(p.trim()))
    .map(stripGeorgianAdminSuffix);

  for (const part of parts) {
    if (!part) continue;

    // 1. Direct city lookup (English)
    if (CITY_TO_REGION[part]) return CITY_TO_REGION[part];

    // 2. Georgian city lookup
    if (KA_CITY_TO_REGION[part]) return KA_CITY_TO_REGION[part];

    // 3. Check if the part itself is a region alias (exact match after normalization)
    for (const [key, aliases] of Object.entries(REGION_ALIASES)) {
      if (aliases.some(a => normalizeSpacing(a.toLowerCase()) === part)) return key;
    }

    // 4. Whole-word partial match — city name appears as a whole word in the part.
    //    Use whole-word matching to prevent "ჯავა" (Java/Shida Kartli) from
    //    matching inside "ჯავახეთი" (Javakheti), etc.
    for (const [city, region] of Object.entries(CITY_TO_REGION)) {
      if (containsWholeWord(part, city) || containsWholeWord(city, part)) return region;
    }
    for (const [kaCity, region] of Object.entries(KA_CITY_TO_REGION)) {
      if (containsWholeWord(part, kaCity) || containsWholeWord(kaCity, part)) return region;
    }
  }

  return null;
}

/**
 * Returns true if a property location string belongs to the given region,
 * matching bilingually (Georgian ↔ English) for both the filter region name
 * and the location string stored in the database.
 *
 * Strategy (in order):
 * 1. Infer the property's region from its city name via CITY_TO_REGION lookup
 * 2. Check if the inferred region matches the filter region (via REGION_ALIASES)
 * 3. Fall back to checking if the location string directly contains any region alias
 *
 * This means "Telavi" → inferred as "kakheti" → matches filter "Kakheti" ✓
 * And "თელავი" → inferred as "kakheti" → matches filter "Kakheti" ✓
 */
export function regionMatches(propertyLocation: string, filterRegion: string): boolean {
  if (!filterRegion.trim() || !propertyLocation) return false;

  // A list of regions ("კახეთი, მცხეთა-მთიანეთი" — one promo covering two)
  // matches a property in any of them. Only split when every part is itself a
  // region name, so "Telavi, Kakheti" is still one place, not all of Kakheti.
  const parts = filterRegion.split(',').map((p) => normalizeSpacing(p.toLowerCase().trim())).filter(Boolean);
  if (parts.length > 1 && parts.every((part) =>
    Object.values(REGION_ALIASES).some((aliases) => aliases.some((a) => normalizeSpacing(a.toLowerCase()) === part)))) {
    return parts.some((part) => regionMatches(propertyLocation, part));
  }

  const filterLower = normalizeSpacing(filterRegion.toLowerCase().trim());

  // Find the canonical region key for the filter value
  let filterCanonicalKey: string | null = null;
  for (const [key, aliases] of Object.entries(REGION_ALIASES)) {
    if (aliases.some(a => {
      const aLower = normalizeSpacing(a.toLowerCase());
      return aLower === filterLower || filterLower.includes(aLower) || aLower.includes(filterLower);
    })) {
      filterCanonicalKey = key;
      break;
    }
  }

  // If we can't identify the filter region, fall back to text matching
  if (!filterCanonicalKey) {
    return locationMatches(propertyLocation, filterRegion);
  }

  // Strategy 1: Infer the property's region from its city/location name
  const inferredRegion = inferRegionFromLocation(propertyLocation);
  if (inferredRegion) {
    // Direct canonical key match
    if (inferredRegion === filterCanonicalKey) return true;

    // Cross-region containment: "Svaneti" filter should match cities in
    // "samegrelo-zemo svaneti", and vice versa
    const svanetiRelated = ['svaneti', 'samegrelo-zemo svaneti'];
    if (svanetiRelated.includes(filterCanonicalKey) && svanetiRelated.includes(inferredRegion)) {
      return true;
    }

    // Also check if the inferred region is an alias of the filter region
    const filterAliases = REGION_ALIASES[filterCanonicalKey] || [];
    const inferredAliases = REGION_ALIASES[inferredRegion] || [];
    if (filterAliases.some(fa => inferredAliases.some(ia => ia.toLowerCase() === fa.toLowerCase()))) {
      return true;
    }
  }

  // Strategy 2: Check if the location string directly contains any alias of the filter region.
  // Normalize spacing around dashes so "სამცხე- ჯავახეთი" matches "სამცხე-ჯავახეთი".
  const propNormalized = normalizeSpacing(propertyLocation.toLowerCase());
  const allFilterAliases = REGION_ALIASES[filterCanonicalKey] || [];
  for (const alias of allFilterAliases) {
    const aliasNorm = normalizeSpacing(alias.toLowerCase());
    if (propNormalized.includes(aliasNorm)) return true;
  }

  return false;
}

/**
 * Filters autocomplete city suggestions bilingually.
 * Used in SearchBar to show matching cities regardless of input script.
 */
export function filterCitiesBilingual(
  cities: Array<{ name: string; region: string }>,
  query: string
): Array<{ name: string; region: string }> {
  if (!query.trim()) return [];

  const tokens = getSearchTokens(query);
  const q = query.toLowerCase();

  return cities.filter(city => {
    const cityLower = city.name.toLowerCase();
    const regionLower = city.region.toLowerCase();

    // Direct substring match
    if (cityLower.includes(q) || regionLower.includes(q)) return true;

    // Token-based bilingual match
    for (const token of tokens) {
      if (!token) continue;
      if (cityLower.includes(token) || regionLower.includes(token)) return true;
      if (token.includes(cityLower)) return true;
    }

    return false;
  });
}

/**
 * Georgian display name for a place, for UI that should read in Georgian.
 *
 * The city catalog and the property `location` strings are stored in English —
 * that stays the canonical form, and matching is bilingual either way. This is
 * purely about what the reader sees: searching "კახეთი" in Georgian and getting
 * back a list of "Telavi / Kakheti" is jarring and looks untranslated.
 *
 * Falls back to the original string whenever there's no Georgian entry, so an
 * unmapped village still renders its name rather than disappearing.
 */
export function localizePlace(name: string, lang: string): string {
  if (!name) return name;
  const key = name.trim().toLowerCase();

  // "Telavi, Kakheti" — translate each part and keep the punctuation.
  if (name.includes(',')) {
    return name
      .split(',')
      .map((part) => localizePlace(part.trim(), lang))
      .join(', ');
  }

  if (lang === 'ka') {
    const ka = EN_TO_KA[key];
    return ka?.[0] ?? name;
  }

  // Reading in English or Russian. Places are stored either way round — the
  // city catalogue is English, but admin- and host-entered locations are
  // usually Georgian — so a Georgian name has to be mapped back, or an English
  // reader is left looking at Georgian script.
  //
  // Russian falls through to the English (Latin) form: there is no Cyrillic
  // name list, and a transliterated name is far more use to a Russian reader
  // than Georgian script.
  const en = KA_TO_EN[key];
  if (en) return en.replace(/\b\w/g, (c) => c.toUpperCase());

  return name;
}
