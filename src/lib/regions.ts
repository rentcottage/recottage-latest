import { georgianCities } from '../mocks/georgian-cities';

/**
 * Display labels for Georgia's regions.
 *
 * Region VALUES stay in English — they are stored in listing `location`
 * strings and matched bilingually by `regionMatches()` — so only the on-screen
 * label follows the reader's language. Shared by the search filters and the
 * host's location picker so both read from one vocabulary.
 */
export const REGION_LABEL_KEY: Record<string, string> = {
  'Abkhazia': 'search.regionAbkhazia',
  'Adjara': 'search.regionAdjara',
  'Guria': 'search.regionGuria',
  'Imereti': 'search.regionImereti',
  'Kakheti': 'search.regionKakheti',
  'Kvemo Kartli': 'search.regionKvemoKartli',
  'Mtskheta-Mtianeti': 'search.regionMtskhetaMtianeti',
  'Racha-Lechkhumi': 'search.regionRachaLechkhumi',
  'Samegrelo-Zemo Svaneti': 'search.regionSamegreloZemoSvaneti',
  'Samtskhe-Javakheti': 'search.regionSamtskheJavakheti',
  'Shida Kartli': 'search.regionShidaKartli',
  'Svaneti': 'search.regionSvaneti',
  'Tbilisi': 'search.regionTbilisi',
};

/**
 * The regions a host can file a listing under — derived from the city catalog
 * rather than hand-listed, so every city in it has a region to belong to and
 * the two can never drift apart.
 */
export const HOST_REGIONS: string[] = [
  ...new Set(georgianCities.map((c) => c.region)),
].sort();
