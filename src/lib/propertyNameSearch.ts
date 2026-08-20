/**
 * Cottage-name search — lets guests find a specific listing by its name,
 * not only by city/region. Sits alongside locationNormalizer (which owns
 * place names); this module owns free-text listing titles.
 *
 * Titles are host-written free text in any script, so there is no dictionary
 * to expand against: matching is plain, case/diacritic-insensitive substring
 * matching where every word of the query must appear somewhere in the title.
 */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')  // strip Latin accents; Georgian is unaffected
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // punctuation → space so "Villa-Mzia" ≈ "villa mzia"
    .trim();
}

/**
 * Returns true if a listing title matches the query.
 * Every word in the query must appear in the title, so "green villa"
 * finds "Green Cottage Villa" but not "Green Lake House".
 */
export function titleMatches(title: string, query: string): boolean {
  if (!query.trim()) return false;
  if (!title) return false;

  const titleNorm = normalize(title);
  if (!titleNorm) return false;

  // A query like "Batumi, Adjara" comes from a city pick — only the part before
  // the comma can plausibly be a listing name.
  const words = normalize(query.split(',')[0]).split(' ').filter(Boolean);
  if (words.length === 0) return false;

  return words.every(word => titleNorm.includes(word));
}

/**
 * Ranks matching listings so the closest name lands first:
 * exact title, then prefix, then anything else (alphabetical within a tier).
 */
export function filterPropertiesByName<T extends { title: string }>(
  properties: T[],
  query: string
): T[] {
  if (!query.trim()) return [];

  const q = normalize(query.split(',')[0]);

  return properties
    .filter(p => titleMatches(p.title, query))
    .map(p => {
      const titleNorm = normalize(p.title);
      const rank = titleNorm === q ? 0 : titleNorm.startsWith(q) ? 1 : 2;
      return { p, rank, titleNorm };
    })
    .sort((a, b) => a.rank - b.rank || a.titleNorm.localeCompare(b.titleNorm))
    .map(({ p }) => p);
}
