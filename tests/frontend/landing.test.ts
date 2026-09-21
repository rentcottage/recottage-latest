// The /cottages/<slug> landing pages.
//
// Two things are worth pinning here. First the grouping: a slug must always
// mean the same set of cottages, and that set must be the one the SEARCH page
// would show, or a visitor arriving from Google sees a list the site itself
// disagrees with. Second the Georgian: these pages are the only machine-written
// Georgian on the site, and "ამბროლაური" + "ში" is not a word.
//
// Run: node --test tests/frontend/landing.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  MIN_LISTINGS,
  REGION_DUPLICATES,
  assertUniqueSlugs,
  buildGroups,
  canonicalCity,
  findGroup,
  regionForCity,
  toSlug,
  type LandingListing,
} from '../../src/lib/landingPages.ts';
import { regionMatches } from '../../src/lib/locationNormalizer.ts';
import {
  // @ts-expect-error — plain .mjs with no type declarations, by design.
  genitive, landingDescription, landingH1, landingTitle, locative, wordCount, buildCopy,
} from '../../scripts/lib/landing.mjs';

const listing = (over: Partial<LandingListing> & { id: string; location: string }): LandingListing => ({
  title: 'Cottage',
  price_per_night: 200,
  max_guests: 4,
  bedrooms: 2,
  categories: ['Mountain'],
  cover_photo_url: null,
  photo_urls: [],
  ...over,
});

// ── Slugs ────────────────────────────────────────────────────────────────────

test('SLUG canonical keys become ASCII, lowercase, hyphenated URLs', () => {
  assert.equal(toSlug('kvemo kartli'), 'kvemo-kartli');
  assert.equal(toSlug('racha-lechkhumi'), 'racha-lechkhumi');
  assert.equal(toSlug('Mountain'), 'mountain');
  assert.equal(toSlug('  Kakheti  '), 'kakheti');
  // No transliteration happens here: a Georgian string is never a slug source.
  assert.match(toSlug('mtskheta-mtianeti'), /^[a-z-]+$/);
});

test('SLUG a collision between two pages fails the build, loudly', () => {
  assert.doesNotThrow(() => assertUniqueSlugs(['kakheti', 'mountain', 'batumi']));
  assert.throws(
    () => assertUniqueSlugs(['kakheti', 'mountain', 'kakheti']),
    /slug collision: "kakheti"/,
  );
});

// ── Canonical city ───────────────────────────────────────────────────────────

test('CITY the same town in either script is one page, not two', () => {
  assert.equal(canonicalCity('Ambrolauri, Racha-Lechkhumi'), 'ambrolauri');
  assert.equal(canonicalCity('ამბროლაური'), 'ambrolauri');
  assert.equal(canonicalCity('Batumi, Adjara'), 'batumi');
  assert.equal(canonicalCity('ბათუმი'), 'batumi');
});

test('CITY two English keys with one Georgian name merge (keda/qeda are ქედა)', () => {
  // Left alone this town splits across two pages of 3 and 5. The merge comes
  // out of the dictionary — both spellings carry the identical Georgian name.
  assert.equal(canonicalCity('Keda, Adjara'), canonicalCity('Qeda, Adjara'));
  assert.equal(canonicalCity('ქედა'), canonicalCity('Keda, Adjara'));
});

test('CITY places whose Georgian names differ are NOT merged', () => {
  // Kazbegi and Stepantsminda are one town to a traveller, but the dictionary
  // gives them different Georgian names and nothing in the data says they are
  // the same. Merging them would be a claim, not a lookup.
  assert.notEqual(canonicalCity('Kazbegi, Mtskheta-Mtianeti'), canonicalCity('Stepantsminda'));
});

test('CITY punctuation and admin suffixes are stripped', () => {
  assert.equal(canonicalCity('ბაზალეთი . '), 'bazaleti');
  assert.equal(canonicalCity('ამბროლაურის რაიონი'), 'ambrolauri');
  assert.equal(canonicalCity('სოფელი ბაზალეთი'), 'bazaleti');
});

test('CITY a region name alone is not a town', () => {
  // "რაჭა" is Racha the region. It must not become a town page; those
  // listings still reach the reader through their region page.
  assert.equal(canonicalCity('რაჭა'), null);
  assert.equal(canonicalCity(''), null);
  assert.equal(canonicalCity(null), null);
  // "Sioni lake, Georgia" DOES resolve — Sioni is a village the dictionary
  // knows, and the lake takes its name from it. It has two listings, so it
  // stays below the threshold and gets no page; that is the threshold's job,
  // not the resolver's.
  assert.equal(canonicalCity('Sioni lake, Georgia'), 'sioni');
  // "Kveda chxutuneti" also resolves: Kveda is "lower" and Chkhutuneti is the
  // village, which the whole-word scan finds inside the phrase.
  assert.equal(canonicalCity('Kveda chxutuneti'), 'chkhutuneti');
  // Something that genuinely names no town stays null.
  assert.equal(canonicalCity('Somewhere Nice, Georgia'), null);
});

test('CITY every town page knows which region it belongs to', () => {
  assert.equal(regionForCity('ambrolauri'), 'racha-lechkhumi');
  assert.equal(regionForCity('batumi'), 'adjara');
  assert.equal(regionForCity('telavi'), 'kakheti');
  assert.equal(regionForCity('not-a-town'), null);
});

// ── Grouping ─────────────────────────────────────────────────────────────────

test('GROUP a region page lists exactly what the search filter would', () => {
  // This is the property that matters: buildGroups uses regionMatches, the same
  // function the search page's region checkbox uses. If the two ever diverge,
  // a visitor from Google lands on a list the site contradicts.
  const rows = [
    listing({ id: 'a', location: 'Telavi, Kakheti' }),
    listing({ id: 'b', location: 'Batumi, Adjara' }),
    listing({ id: 'c', location: 'ქედა' }),
    listing({ id: 'd', location: 'Kobuleti, Adjara' }),
  ];
  const adjara = buildGroups(rows).find((g) => g.kind === 'region' && g.key === 'adjara');
  assert.ok(adjara, 'Adjara should have a page');
  const viaSearch = rows.filter((r) => regionMatches(r.location, 'adjara')).map((r) => r.id).sort();
  assert.deepEqual(adjara.listings.map((l) => l.id).sort(), viaSearch);
});

test('GROUP nothing below the threshold gets a page', () => {
  const two = [
    listing({ id: 'a', location: 'Telavi, Kakheti' }),
    listing({ id: 'b', location: 'Telavi, Kakheti' }),
  ];
  assert.equal(buildGroups(two).length, 0, 'two cottages must not make a page');

  const three = [...two, listing({ id: 'c', location: 'Telavi, Kakheti' })];
  const groups = buildGroups(three);
  assert.ok(groups.some((g) => g.kind === 'city' && g.key === 'telavi'));
  assert.ok(groups.some((g) => g.kind === 'region' && g.key === 'kakheti'));
  assert.equal(MIN_LISTINGS, 3);
  for (const g of groups) assert.ok(g.listings.length >= MIN_LISTINGS, g.slug);
});

test('GROUP svaneti and samegrelo-zemo svaneti do not both get a page', () => {
  const rows = Array.from({ length: 4 }, (_, i) =>
    listing({ id: `m${i}`, location: 'Mestia, Samegrelo-Zemo Svaneti' }));
  const groups = buildGroups(rows);
  const regionKeys = groups.filter((g) => g.kind === 'region').map((g) => g.key);
  assert.ok(regionKeys.includes('svaneti'));
  assert.equal(regionKeys.includes('samegrelo-zemo svaneti'), false,
    'the same four cottages must not be published at two URLs');
  assert.ok(REGION_DUPLICATES.has('samegrelo-zemo svaneti'));
});

test('GROUP categories become pages, and a listing can be on several', () => {
  const rows = Array.from({ length: 3 }, (_, i) =>
    listing({ id: `x${i}`, location: 'Telavi, Kakheti', categories: ['Mountain', 'Winery'] }));
  const groups = buildGroups(rows);
  const cats = groups.filter((g) => g.kind === 'category').map((g) => g.key).sort();
  assert.deepEqual(cats, ['Mountain', 'Winery']);
  for (const c of CATEGORIES) assert.equal(typeof c, 'string');
});

test('GROUP the output is deterministic and every slug is unique', () => {
  const rows = [
    ...Array.from({ length: 4 }, (_, i) => listing({ id: `k${i}`, location: 'Telavi, Kakheti', price_per_night: 400 - i })),
    ...Array.from({ length: 3 }, (_, i) => listing({ id: `b${i}`, location: 'Batumi, Adjara' })),
  ];
  const a = buildGroups(rows);
  const b = buildGroups([...rows].reverse());
  assert.deepEqual(
    a.map((g) => [g.slug, g.listings.map((l) => l.id)]).sort(),
    b.map((g) => [g.slug, g.listings.map((l) => l.id)]).sort(),
    'the same listings in another order must produce the same pages',
  );
  assert.doesNotThrow(() => assertUniqueSlugs(a.map((g) => g.slug)));
  assert.ok(findGroup(a, 'kakheti'));
  assert.ok(findGroup(a, 'KAKHETI'), 'lookup is case-insensitive');
  assert.equal(findGroup(a, 'nowhere'), undefined);
});

// ── Georgian ─────────────────────────────────────────────────────────────────

test('KA locative: "in X" drops a final ი and never doubles it', () => {
  const cases: [string, string][] = [
    ['ამბროლაური', 'ამბროლაურში'],
    ['ბათუმი', 'ბათუმში'],
    ['ყაზბეგი', 'ყაზბეგში'],
    ['ონი', 'ონში'],
    ['ქუთაისი', 'ქუთაისში'],
    ['კახეთი', 'კახეთში'],
    ['რაჭა-ლეჩხუმი', 'რაჭა-ლეჩხუმში'],
    ['ქვემო ქართლი', 'ქვემო ქართლში'],
    ['ქედა', 'ქედაში'],
    ['მესტია', 'მესტიაში'],
    ['მცხეთა', 'მცხეთაში'],
    ['აჭარა', 'აჭარაში'],
  ];
  for (const [name, want] of cases) assert.equal(locative(name), want, name);
  // The bug this rule exists to prevent.
  assert.notEqual(locative('ამბროლაური'), 'ამბროლაურიში');
});

test('KA genitive: "of X" drops a final ი or ა', () => {
  const cases: [string, string][] = [
    ['რაჭა-ლეჩხუმი', 'რაჭა-ლეჩხუმის'],
    ['კახეთი', 'კახეთის'],
    ['აჭარა', 'აჭარის'],
    ['მცხეთა', 'მცხეთის'],
    ['სვანეთი', 'სვანეთის'],
    ['ქვემო ქართლი', 'ქვემო ქართლის'],
  ];
  for (const [name, want] of cases) assert.equal(genitive(name), want, name);
});

test('KA a Latin-script name takes no Georgian ending', () => {
  assert.equal(locative('Batumi'), 'Batumi');
  assert.equal(genitive('Adjara'), 'Adjara');
});

// ── Copy ─────────────────────────────────────────────────────────────────────

const sampleGroup = {
  kind: 'city' as const,
  key: 'ambrolauri',
  slug: 'ambrolauri',
  listings: Array.from({ length: 5 }, (_, i) => listing({
    id: `c${i}`, location: 'Ambrolauri, Racha-Lechkhumi',
    price_per_night: 100 + i * 50, max_guests: 4 + i, bedrooms: 2,
    categories: ['Mountain'], photo_urls: [`p${i}a`, `p${i}b`],
  })),
};
const sampleCtx = {
  displayName: 'ამბროლაური',
  regionLink: { slug: 'racha-lechkhumi', name: 'რაჭა-ლეჩხუმი' },
  cityLinks: [],
  siblingLinks: [{ slug: 'oni', name: 'ონი' }],
  categoryLinks: [],
};

test('COPY every number in the copy is one that was counted, and it declines correctly', () => {
  const copy = buildCopy(sampleGroup, sampleCtx);
  const text = copy.join(' ');
  assert.ok(text.includes('5 კოტეჯი'), text);
  assert.ok(text.includes('100 ლარიდან 300 ლარამდე'), text);
  assert.ok(text.includes('ამბროლაურში'), 'the locative must be used in the copy');
  assert.ok(text.includes('რაჭა-ლეჩხუმის რეგიონშია'), 'the genitive must be used for the region');
  assert.equal(text.includes('ამბროლაურიში'), false);
});

test('COPY length stays inside the 120-200 word budget', () => {
  const n = wordCount(buildCopy(sampleGroup, sampleCtx));
  assert.ok(n >= 120 && n <= 200, `copy was ${n} words`);
});

test('COPY claims nothing the data cannot support', () => {
  // No weather, no scenery, no history, no distances, no adjacency — none of
  // it is in public_properties, so none of it may appear on the page.
  const text = buildCopy(sampleGroup, sampleCtx).join(' ');
  for (const forbidden of ['კილომეტრ', 'ამინდ', 'ისტორი', 'ღირსშესანიშნაობ', 'ახლოსაა', 'საუკუნ']) {
    assert.equal(text.includes(forbidden), false, `copy asserts something unverifiable: ${forbidden}`);
  }
  // "Nearby" is only ever said about pages that exist, never about geography.
  assert.ok(text.includes('იმავე რეგიონში'), text);
});

test('COPY title, description and H1 all describe the same page', () => {
  const title = landingTitle(sampleGroup, sampleCtx);
  const desc = landingDescription(sampleGroup, sampleCtx);
  const h1 = landingH1(sampleGroup, sampleCtx);
  for (const s of [title, desc, h1]) assert.ok(s.includes('ამბროლაურ'), s);
  assert.ok(title.includes('5'), title);
  assert.ok(desc.includes('5 კოტეჯი'), desc);
  assert.ok(title.endsWith('| RentCottage.Ge'), title);
  assert.equal(h1.includes('RentCottage'), false, 'the H1 is the page, not the brand');
});
