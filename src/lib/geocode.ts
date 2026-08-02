/**
 * Resolving a listing to map coordinates.
 *
 * DATA REALITY (checked 2026-08-02): of 94 approved listings in
 * `property_applications`, exactly ONE has `latitude`/`longitude` populated.
 * The rest carry only a free-text `location` such as "Kazbegi, Mtskheta-Mtianeti"
 * or "რაჭა ამბროლაურის რაიონი სოფ . ჯვარისა".
 *
 * So the map places:
 *   - `exact`       — the listing's own latitude/longitude (1 listing today)
 *   - `approximate` — the centre of the town parsed out of `location`
 *   - nothing       — town not in the gazetteer; the listing is reported as
 *                     unmappable rather than dropped silently or placed at random
 *
 * Approximate pins are NOT the property's real position. Several cottages in the
 * same town share one point. The fix is to populate latitude/longitude at listing
 * time (or geocode server-side and store the result) — not to grow this table.
 */

export type CoordSource = 'exact' | 'approximate';

export interface ResolvedCoords {
  lat: number;
  lng: number;
  source: CoordSource;
}

/** Town centres in Georgia. Keys are lowercased; Georgian and Latin spellings
 *  both map to the same point because listings use them interchangeably. */
const TOWN_COORDS: Record<string, [number, number]> = {
  // Mtskheta-Mtianeti
  'kazbegi': [42.6572, 44.6417],
  'stepantsminda': [42.6572, 44.6417],
  'სტეფანწმინდა': [42.6572, 44.6417],
  'mtskheta': [41.8458, 44.7203],
  'dusheti': [42.0847, 44.6939],
  'bazaleti': [42.0086, 44.6558],
  'ბაზალეთი .': [42.0086, 44.6558],
  'tianeti': [42.1094, 44.9636],
  'sioni': [42.5342, 44.7014],
  'sioni lake': [42.5342, 44.7014],
  'ცხვარიჭამია': [41.8994, 44.6564],
  'ხევსურეთი': [42.4667, 45.0333],

  // Racha-Lechkhumi
  'ambrolauri': [42.5211, 43.1583],
  'ამბროლაური': [42.5211, 43.1583],
  'ამბროლაურის რაიონი': [42.5211, 43.1583],
  'რაჭა': [42.5211, 43.1583],
  'რაჭა ამბროლაურის რაიონი სოფ . ჯვარისა': [42.5211, 43.1583],
  'რაჭა.სოფ ჯვარისა': [42.5211, 43.1583],
  'oni': [42.5794, 43.4392],
  'ონი': [42.5794, 43.4392],
  'ონის რაიონი': [42.5794, 43.4392],
  'utsera': [42.6167, 43.5333],
  'nikortsminda': [42.4667, 43.0500],
  'zeda glola': [42.7167, 43.5833],
  'tvishi': [42.4333, 42.7167],
  'ზემო ქვიშიანი': [42.5211, 43.1583],

  // Samtskhe-Javakheti
  'borjomi': [41.8397, 43.3806],
  'tsaghveri': [41.7833, 43.4833],
  'bakuriani': [41.7492, 43.5325],
  'abastumani': [41.7500, 42.8333],
  'სამცხე- ჯავახეთი': [41.8397, 43.3806],
  'სურამი': [42.0181, 43.5561],

  // Adjara / coast
  'batumi': [41.6459, 41.6417],
  'აჭარა': [41.6459, 41.6417],
  'keda': [41.5947, 41.9394],
  'ქედა': [41.5947, 41.9394],
  'qeda': [41.5947, 41.9394],
  'khulo': [41.6417, 42.3097],
  'khelvachauri': [41.5833, 41.6667],
  'ქობულეთი': [41.8206, 41.7783],
  'ბახმარო': [41.8500, 42.3333],
  'ბუკნარი': [41.9000, 42.0000],

  // Imereti / Svaneti / Kakheti / Kartli
  'kutaisi': [42.2679, 42.7180],
  'mestia': [43.0450, 42.7278],
  'telavi': [41.9197, 45.4731],
  'თელავი': [41.9197, 45.4731],
  'akhmeta': [42.0325, 45.2081],
  'sighnaghi': [41.6197, 45.9214],
  'სოფელი საბუე': [41.9197, 45.4731],
  'tbilisi': [41.7151, 44.8271],
  'kiketi': [41.6167, 44.6833],
  'კოჯორი': [41.6500, 44.7000],
  'tsalka': [41.5947, 44.0906],
};

/** Extract the town part of a free-text location ("Kazbegi, Mtskheta-Mtianeti"). */
function townKey(location: string): string {
  return (location || '').split(',')[0].trim().toLowerCase();
}

export function resolveCoords(
  location: string,
  latitude?: number | null,
  longitude?: number | null
): ResolvedCoords | null {
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return { lat: latitude, lng: longitude, source: 'exact' };
  }
  const hit = TOWN_COORDS[townKey(location)];
  return hit ? { lat: hit[0], lng: hit[1], source: 'approximate' } : null;
}

/** Spread listings that resolve to the same town centre around it, so markers
 *  don't stack invisibly. Deterministic — same input, same offsets. */
export function spread<T>(items: T[], key: (item: T) => string): Map<T, number> {
  const groups = new Map<string, T[]>();
  items.forEach((it) => {
    const k = key(it);
    groups.set(k, [...(groups.get(k) || []), it]);
  });
  const index = new Map<T, number>();
  groups.forEach((group) => group.forEach((it, i) => index.set(it, group.length > 1 ? i : -1)));
  return index;
}

/** Offset for the nth listing sharing one point (~400 m ring). */
export function ringOffset(n: number): [number, number] {
  if (n < 0) return [0, 0];
  const angle = (n * 2 * Math.PI) / 8;
  const r = 0.0045 * (1 + Math.floor(n / 8) * 0.8);
  return [r * Math.sin(angle), r * Math.cos(angle)];
}
