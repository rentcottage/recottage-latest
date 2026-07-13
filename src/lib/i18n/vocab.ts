import type { TranslateFn } from './index';

/** Namespaces that hold fixed-vocabulary DB values keyed by their English text. */
export type VocabKind = 'amenities' | 'categories' | 'propertyType';

/**
 * Localize a fixed-vocabulary DB value (amenity, category, or property type).
 *
 * DB rows store the English label (e.g. `"Swimming Pool"`, `"Winery"`). We look
 * it up under the matching namespace; if the value isn't in the known list
 * (unexpected/legacy data), we render it as authored so nothing breaks.
 *
 * @example translateVocab(t, 'amenities', 'Hot Tub') // → "Whirlpool" in de
 */
export function translateVocab(t: TranslateFn, kind: VocabKind, value: string): string {
  const key = `${kind}.${value}`;
  const out = t(key);
  return out === key ? value : out;
}
