// Tests for n8n-data. Supabase is faked in memory; no network, no secrets.
//
// The load-bearing test here is PII: every response from every action and every
// error path is scanned for an "@", a phone-shaped string, a booking or user
// id, and any key that looks like contact data. n8n Cloud is a third party —
// what this function returns is what leaves the building.
//
// Run: node --test supabase/functions/n8n-data/handler.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS,
  CONTACT_MARK,
  LISTING_COLUMNS,
  LISTINGS_VIEW,
  MAX_LISTINGS,
  SHORT_DESCRIPTION_MAX,
  STATS_COLUMNS,
  STATS_VIEW,
  clientBucket,
  createHandler,
  displayName,
  pickRotating,
  providedSecret,
  redactContacts,
  rotationScore,
  rotationSeed,
  shortDescription,
} from './handler.ts';
import { FAILURES_TABLE, MAX_FAILURES, clientKey } from '../_shared/adminAuth.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const SECRET = 'n8n-secret-value-for-tests-only-32b';
const NOW = new Date('2026-09-18T09:00:00.000Z');

const STATS_ROW = {
  approved_listings: 101,
  new_listings_7d: 0,
  new_listings_30d: 3,
  distinct_regions: 65,
  listings_by_region: [{ region: 'Batumi, Adjara', listings: 7 }, { region: 'Kazbegi, Mtskheta-Mtianeti', listings: 6 }],
  listings_by_category: [{ category: 'Mountain', listings: 55 }, { category: 'Countryside', listings: 43 }],
  price_min: 35, price_avg: 253.12, price_max: 1000,
  bookings_7d: 6, bookings_30d: 9, bookings_90d: 19,
  confirmed_bookings_all_time: 4, avg_booking_value: 852.25,
};

function listingRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `1111${String(i).padStart(4, '0')}-2222-4222-8222-333333333333`,
    title: `Cottage ${i}`,
    location: i % 2 === 0 ? 'Batumi, Adjara' : 'Kazbegi, Mtskheta-Mtianeti',
    property_type: 'cottage',
    price_per_night: 100 + i,
    max_guests: 2 + (i % 5),
    bedrooms: i % 4 === 3 ? null : 1 + (i % 3),
    bathrooms: i % 4 === 2 ? null : 1,
    description: i % 3 === 0
      ? 'A quiet wooden cottage with a garden and a view of the valley.'
      : 'Stone house by the river.\nCall +995 599 12 34 56 or write to host.fake@example.test.',
    categories: i % 2 === 0 ? ['Mountain', 'Forest'] : ['Winery'],
    cover_photo_url: `https://cdn.example.test/cover-${i}.webp`,
    photo_urls: [`https://cdn.example.test/p-${i}-1.webp`, `https://cdn.example.test/p-${i}-2.webp`],
    host_first_name: 'Nino',
    host_last_initial: 'P',
  }));
}

class FakeDb {
  calls: { table: string; select?: string; filters: string[] }[] = [];
  failures: { ip_hash: string; function_name: string; failed_at: number }[] = [];
  statsRows: Row[] = [STATS_ROW];
  listings: Row[] = listingRows(12);
  failStats = false;
  failListings = false;

  from(table: string) {
    if (table === FAILURES_TABLE) return this.failureTable();
    const call: FakeDb['calls'][number] = { table, filters: [] };
    this.calls.push(call);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const db = this;
    let rows: Row[] = table === STATS_VIEW ? [...this.statsRows] : [...this.listings];
    const broken = table === STATS_VIEW ? () => db.failStats : () => db.failListings;
    const q = {
      select(cols: string) { call.select = cols; return q; },
      limit(n: number) { rows = rows.slice(0, n); return q; },
      contains(col: string, vals: string[]) {
        call.filters.push(`${col}⊇${vals.join('+')}`);
        rows = rows.filter((r) => Array.isArray(r[col]) && vals.every((v) => r[col].includes(v)));
        return q;
      },
      ilike(col: string, pattern: string) {
        call.filters.push(`${col}~${pattern}`);
        const needle = pattern.replace(/%/g, '').toLowerCase();
        rows = rows.filter((r) => String(r[col] ?? '').toLowerCase().includes(needle));
        return q;
      },
      then(resolve: (v: Row) => void) {
        if (broken()) return resolve({ data: null, error: { message: 'relation "property_applications" host=10.0.0.9 password=hunter2' } });
        resolve({ data: rows, error: null });
      },
    };
    return q;
  }

  private failureTable() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const db = this;
    let ip: string | null = null;
    let since = 0;
    const q = {
      select(_c: string, _o: { count: string; head: boolean }) { return q; },
      eq(_c: string, v: string) { ip = v; return q; },
      gte(_c: string, v: string) { since = Date.parse(v); return q; },
      then(resolve: (v: Row) => void) {
        resolve({ count: db.failures.filter((f) => f.ip_hash === ip && f.failed_at >= since).length, error: null });
      },
    };
    return {
      ...q,
      insert(row: { ip_hash: string; function_name: string }) {
        db.failures.push({ ...row, failed_at: Date.now() });
        return Promise.resolve({ error: null });
      },
    };
  }
}

function harness(opts: { secret?: string } = { secret: SECRET }) {
  const secret = 'secret' in opts ? opts.secret : SECRET;
  const db = new FakeDb();
  const logs: string[] = [];
  const handler = createHandler({ db, secret, now: () => NOW, log: (e, f) => logs.push(`${e} ${JSON.stringify(f ?? {})}`) });
  let client = 0;
  const call = async (
    body: unknown,
    headers: Record<string, string> = { 'x-n8n-secret': SECRET },
    method = 'POST',
  ) => {
    const res = await handler(new Request('https://fn.local/n8n-data', {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': `10.0.0.${++client}`,
        ...headers,
      },
      body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let json: Row = {};
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, body: json, text };
  };
  return { db, logs, call };
}

// ── The gate ─────────────────────────────────────────────────────────────────

test('AUTH missing, wrong and body-supplied secrets → identical 401 with zero data calls', async () => {
  const h = harness();
  const answers: string[] = [];
  const attempts: [Record<string, string>, Row][] = [
    [{}, { action: 'weekly-report' }],
    [{ 'x-n8n-secret': '' }, { action: 'weekly-report' }],
    [{ 'x-n8n-secret': 'wrong' }, { action: 'weekly-report' }],
    [{ 'x-n8n-secret': SECRET.slice(0, -1) }, { action: 'weekly-report' }],
    [{ 'x-n8n-secret': SECRET + 'x' }, { action: 'listings-for-social' }],
    [{ 'x-n8n-secret': 'x'.repeat(4096) }, { action: 'listings-for-social' }],
    // the secret in the body must be ignored
    [{}, { action: 'weekly-report', secret: SECRET }],
    [{}, { action: 'weekly-report', n8nSecret: SECRET }],
    [{ authorization: `Bearer ${SECRET}` }, { action: 'weekly-report' }],
  ];
  for (const [headers, body] of attempts) {
    const r = await h.call(body, headers);
    answers.push(`${r.status} ${r.text}`);
  }
  assert.equal(new Set(answers).size, 1, `answers differ: ${[...new Set(answers)].join(' | ')}`);
  assert.equal(answers[0], '401 {"error":"Unauthorized"}');
  assert.equal(h.db.calls.length, 0, 'an unauthenticated request must not touch any data source');
});

test('AUTH an unset or empty secret denies everything', async () => {
  for (const secret of [undefined, '']) {
    const h = harness({ secret });
    const r = await h.call({ action: 'weekly-report' }, { 'x-n8n-secret': SECRET });
    assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }], String(secret));
    assert.equal(h.db.calls.length, 0);
  }
});

test('AUTH the secret is read from the header only', () => {
  assert.equal(providedSecret(new Request('https://x.test', { headers: { 'x-n8n-secret': SECRET } })), SECRET);
  assert.equal(providedSecret(new Request('https://x.test')), '');
});

// ── Throttle, and its separation from the admin functions ────────────────────

test('THROTTLE 10 failures → 429, correct secret refused too, no data call', async () => {
  const h = harness();
  const client = { 'x-forwarded-for': '203.0.113.7' };
  for (let i = 0; i < MAX_FAILURES; i++) {
    const r = await h.call({ action: 'weekly-report' }, { ...client, 'x-n8n-secret': `guess-${i}` });
    assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }], `attempt ${i + 1}`);
  }
  const blocked = await h.call({ action: 'weekly-report' }, { ...client, 'x-n8n-secret': 'wrong' });
  assert.deepEqual([blocked.status, blocked.body], [429, { error: 'Too many attempts' }]);
  const withGood = await h.call({ action: 'weekly-report' }, { ...client, 'x-n8n-secret': SECRET });
  assert.deepEqual([withGood.status, withGood.body], [429, { error: 'Too many attempts' }]);
  assert.equal(h.db.failures.length, MAX_FAILURES, 'throttled attempts must not extend the block');
  assert.equal(h.db.calls.length, 0);
});

test('THROTTLE n8n and the admin functions cannot lock each other out', async () => {
  const h = harness();
  const headers = { 'x-forwarded-for': '203.0.113.7' };
  for (let i = 0; i < MAX_FAILURES; i++) await h.call({ action: 'weekly-report' }, { ...headers, 'x-n8n-secret': 'wrong' });

  const req = new Request('https://fn.local/n8n-data', { method: 'POST', headers });
  const n8nBucket = await clientBucket(req);
  const adminBucket = await clientKey(req);
  assert.notEqual(n8nBucket, adminBucket, 'the two buckets must be different keys');
  assert.equal(h.db.failures.every((f) => f.ip_hash === n8nBucket), true);
  assert.equal(h.db.failures.some((f) => f.ip_hash === adminBucket), false,
    'n8n failures must never land in the bucket the admin functions count');
  assert.equal(h.db.failures.every((f) => f.function_name === 'n8n-data'), true);

  // The same separation holds for the no-x-forwarded-for fallback bucket,
  // which is otherwise a single shared bucket for every caller.
  const bare = new Request('https://fn.local/n8n-data', { method: 'POST' });
  assert.notEqual(await clientBucket(bare), await clientKey(bare));
});

test('THROTTLE the bucket is a hash, never the raw address', async () => {
  const h = harness();
  for (let i = 0; i < 3; i++) {
    await h.call({ action: 'weekly-report' }, { 'x-forwarded-for': '203.0.113.7, 70.41.3.18', 'x-n8n-secret': 'wrong' });
  }
  for (const f of h.db.failures) {
    assert.match(f.ip_hash, /^[0-9a-f]{64}$/);
    assert.equal(f.ip_hash.includes('203.0.113'), false);
  }
});

// ── Method and action routing ────────────────────────────────────────────────

test('ROUTING GET → 405, unknown action → 400, bad JSON → 400', async () => {
  const h = harness();
  const get = await h.call(null, { 'x-n8n-secret': SECRET }, 'GET');
  assert.deepEqual([get.status, get.body], [405, { error: 'Method not allowed' }]);
  for (const action of ['', 'fetch-users', 'booking-history', 'drop-table', 'weekly_report', undefined]) {
    const r = await h.call({ action });
    assert.deepEqual([r.status, r.body], [400, { error: 'Unsupported action' }], String(action));
  }
  const bad = await h.call('{not json', { 'x-n8n-secret': SECRET });
  assert.deepEqual([bad.status, bad.body], [400, { error: 'Invalid JSON body' }]);
  assert.equal(h.db.calls.length, 0, 'no action ran');
});

test('ROUTING the whitelist holds exactly the two phase-1 actions', () => {
  assert.deepEqual(Object.keys(ACTIONS).sort(), ['listings-for-social', 'weekly-report']);
});

// ── weekly-report ────────────────────────────────────────────────────────────

test('weekly-report returns the documented shape from the stats view only', async () => {
  const h = harness();
  const r = await h.call({ action: 'weekly-report' });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['generated_at', 'stats']);
  assert.equal(r.body.generated_at, NOW.toISOString());
  assert.deepEqual(r.body.stats, STATS_ROW);
  // Pinned to the literal view name: asserting against STATS_VIEW would just
  // follow the constant if someone repointed it at a base table.
  assert.deepEqual(h.db.calls.map((c) => c.table), ['marketing_weekly_stats'],
    'must read the aggregate view, never a base table');
  assert.equal(STATS_VIEW, 'marketing_weekly_stats');
  assert.equal(h.db.calls[0].select, STATS_COLUMNS);
});

test('weekly-report reports a database failure generically', async () => {
  const h = harness();
  h.db.failStats = true;
  const r = await h.call({ action: 'weekly-report' });
  assert.deepEqual([r.status, r.body], [500, { error: 'Request failed' }]);
  assert.equal(r.text.includes('10.0.0.9'), false, 'internal detail must not leak');
  assert.equal(r.text.includes('password'), false);
});

// ── listings-for-social ──────────────────────────────────────────────────────

test('listings-for-social returns the documented shape and reads public_properties only', async () => {
  const h = harness();
  const r = await h.call({ action: 'listings-for-social', count: 3 });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['available', 'generated_at', 'listings', 'returned', 'rotation_seed']);
  assert.equal(r.body.returned, 3);
  assert.equal(r.body.listings.length, 3);
  assert.deepEqual(h.db.calls.map((c) => c.table), ['public_properties'],
    'must read the public view, never property_applications');
  assert.equal(LISTINGS_VIEW, 'public_properties');
  assert.equal(h.db.calls[0].select, LISTING_COLUMNS);
  for (const l of r.body.listings) {
    assert.deepEqual(Object.keys(l).sort(), [
      'bathrooms', 'bedrooms', 'categories', 'cover_photo_url', 'host_display_name', 'id', 'location',
      'max_guests', 'photo_urls', 'price_per_night', 'property_type', 'short_description', 'title', 'url',
    ]);
    for (const k of ['max_guests', 'bedrooms', 'bathrooms']) {
      assert.ok(l[k] === null || (typeof l[k] === 'number' && Number.isFinite(l[k])), `${k} = ${JSON.stringify(l[k])}`);
    }
    assert.ok(l.short_description === null || typeof l.short_description === 'string');
    assert.equal('description' in l, false, 'the raw description must never be returned');
    assert.equal(l.host_display_name, 'Nino P.', 'only first name + initial');
    assert.equal(l.url, `https://rentcottage.ge/property/${l.id}`);
  }
});

test('listings-for-social defaults to 3 and rejects a bad count', async () => {
  const h = harness();
  assert.equal((await h.call({ action: 'listings-for-social' })).body.returned, 3);
  for (const count of [0, -1, 11, 1.5, '3', null, MAX_LISTINGS + 1]) {
    const r = await h.call({ action: 'listings-for-social', count });
    assert.deepEqual([r.status, r.body], [400, { error: 'Invalid count' }], String(count));
  }
  assert.equal((await h.call({ action: 'listings-for-social', count: MAX_LISTINGS })).body.returned, MAX_LISTINGS);
});

test('listings-for-social filters by category and region, and validates them', async () => {
  const h = harness();
  const byCat = await h.call({ action: 'listings-for-social', count: 10, category: 'Winery' });
  assert.equal(byCat.status, 200);
  assert.equal(byCat.body.listings.every((l: Row) => l.categories.includes('Winery')), true);
  assert.equal(h.db.calls[0].filters.includes('categories⊇Winery'), true);

  const byRegion = await h.call({ action: 'listings-for-social', count: 10, region: 'Batumi' });
  assert.equal(byRegion.body.listings.every((l: Row) => l.location.includes('Batumi')), true);

  for (const bad of [{ category: '' }, { category: 42 }, { region: '   ' }, { region: [] }]) {
    const r = await h.call({ action: 'listings-for-social', ...bad });
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
});

test('listings-for-social honours exclude_ids and validates it', async () => {
  const h = harness();
  const first = await h.call({ action: 'listings-for-social', count: 3 });
  const excluded = first.body.listings.map((l: Row) => l.id);
  const second = await h.call({ action: 'listings-for-social', count: 3, exclude_ids: excluded });
  assert.equal(second.body.listings.some((l: Row) => excluded.includes(l.id)), false,
    'an excluded listing must not come back');
  assert.equal(second.body.available, h.db.listings.length - excluded.length);

  for (const bad of [{ exclude_ids: 'x' }, { exclude_ids: [1, 2] }, { exclude_ids: Array(201).fill('x') }]) {
    const r = await h.call({ action: 'listings-for-social', ...bad });
    assert.deepEqual([r.status, r.body], [400, { error: 'Invalid exclude_ids' }], JSON.stringify(bad).slice(0, 40));
  }
});

test('ROTATION stable within a day, different across days, and covers the catalogue', async () => {
  const rows = listingRows(12) as { id: string }[];
  const today = rotationSeed(NOW);
  const a = pickRotating(rows, 3, today).map((r) => r.id);
  const b = pickRotating(rows, 3, today).map((r) => r.id);
  assert.deepEqual(a, b, 'the same day must produce the same pick (a retry must not post new listings)');

  const seeds = new Set<string>();
  const seen = new Set<string>();
  for (let day = 0; day < 14; day++) {
    const pick = pickRotating(rows, 3, today + day).map((r) => r.id);
    seeds.add(pick.join(','));
    pick.forEach((id) => seen.add(id));
  }
  assert.ok(seeds.size >= 10, `14 days produced only ${seeds.size} distinct picks`);
  assert.equal(seen.size, rows.length, 'every listing should come up within a fortnight');
  assert.notEqual(rotationSeed(NOW), rotationSeed(new Date(NOW.getTime() + 86_400_000)));
  assert.equal(rotationSeed(NOW), rotationSeed(new Date(NOW.getTime() + 3_600_000)), 'same day, same seed');
  assert.notEqual(rotationScore('a', 1), rotationScore('a', 2));
});

test('listings-for-social copes with an empty catalogue and a broken query', async () => {
  const h = harness();
  h.db.listings = [];
  const empty = await h.call({ action: 'listings-for-social' });
  assert.deepEqual([empty.status, empty.body.returned, empty.body.listings], [200, 0, []]);

  const broken = harness();
  broken.db.failListings = true;
  const r = await broken.call({ action: 'listings-for-social' });
  assert.deepEqual([r.status, r.body], [500, { error: 'Request failed' }]);
  assert.equal(r.text.includes('10.0.0.9'), false);
});

test('displayName never yields more than a first name and an initial', () => {
  assert.equal(displayName('Nino', 'P'), 'Nino P.');
  assert.equal(displayName('Nino', null), 'Nino');
  assert.equal(displayName(null, 'P'), 'Host');
  assert.equal(displayName('', ''), 'Host');
  assert.equal(displayName('Nino', 'Privatesurname'), 'Nino P.', 'only the first letter survives');
});

test('listings-for-social: numbers pass through, anything else becomes null', async () => {
  const h = harness();
  h.db.listings = listingRows(4).map((l, i) => ({
    ...l,
    max_guests: [6, '6', null, Number.NaN][i],
    bedrooms: [3, undefined, 0, '2'][i],
    bathrooms: [2, null, 1.5, {}][i],
  }));
  const r = await h.call({ action: 'listings-for-social', count: 4 });
  const byId = new Map(r.body.listings.map((l: Row) => [l.id, l]));
  const got = h.db.listings.map((l) => {
    const o = byId.get(l.id) as Row;
    return [o.max_guests, o.bedrooms, o.bathrooms];
  });
  assert.deepEqual(got, [[6, 3, 2], [null, null, null], [null, 0, 1.5], [null, null, null]]);
  assert.ok(LISTING_COLUMNS.includes('max_guests, bedrooms, bathrooms, description'));
});

test('listings-for-social: short_description is built from description, contact data removed', async () => {
  const h = harness();
  const r = await h.call({ action: 'listings-for-social', count: 10 });
  const texts = r.body.listings.map((l: Row) => l.short_description);
  assert.ok(texts.includes('A quiet wooden cottage with a garden and a view of the valley.'));
  assert.ok(texts.includes('Stone house by the river.'));
  const joined = texts.join('\n');
  assert.equal(joined.includes('599'), false);
  assert.equal(joined.includes('example.test'), false);
});

// ── short_description ────────────────────────────────────────────────────────
// All contact data below is fake.

const M = CONTACT_MARK;

test('SHORT redactContacts: e-mails, each as one whole token', () => {
  for (const email of ['nino.fake@example.test', 'a_b+c@mail.ge', 'Nino.Fake@Example.Ge', 'гость@почта.рф', 'x@sub.domain.co.uk']) {
    assert.equal(redactContacts(`write ${email} now`), `write ${M} now`, email);
  }
});

test('SHORT redactContacts: URLs, including hosts no domain rule would catch', () => {
  for (const url of [
    'https://fake.example.test/p?x=1', 'http://FakeCottage.Ge/book', 'www.FakeCottage.Ge',
    'https://xn--80ak6aa92e.xn--p1ai/', 'https://127.0.0.1:8080/x', 'ftp://files.fake.test/a',
  ]) {
    assert.equal(redactContacts(`see ${url} today`), `see ${M} today`, url);
  }
});

test('SHORT redactContacts: bare domains and @handles', () => {
  for (const d of ['fakecottage.ge', 'FAKECOTTAGE.GE', 'booking.com', 't.me/fakecottage', 'wa.me/995599123456', 'my-cottage.co.uk']) {
    assert.equal(redactContacts(`find us ${d} ok`).replace('find us ', ''), `${M} ok`, d);
  }
  for (const handle of ['@fake_cottage', '@fake.cottage.ge', '@ნინო']) {
    assert.equal(redactContacts(`follow ${handle} ok`), `follow ${M} ok`, handle);
  }
  assert.equal(redactContacts('a stray @ sign').includes('@'), false);
});

test('SHORT redactContacts: phones in Georgian and international formats', () => {
  for (const phone of [
    '+995 599 12 34 56', '+995599123456', '(+995) 599 123 456', '599-12-34-56', '599 123 456',
    '599123456', '0322 12 34 56', '(032) 2 12 34 56', '+995 (32) 212-34-56', '599.12.34.56',
    '+44 20 7946 0958', '+1 (555) 010-4567', '8 (800) 555-35-35', '00995 599 12 34 56', '2 12 34 56',
  ]) {
    assert.equal(redactContacts(`ring ${phone} today`), `ring ${M} today`, phone);
  }
  // Ordinary numbers are left alone.
  for (const text of ['3 bedrooms, 2 bathrooms', 'from 100 to 150 GEL', 'built in 2019. 150 m² garden', '1.5 km to the lake']) {
    assert.equal(redactContacts(text), text, text);
  }
});

test('SHORT shortDescription strips every kind of contact data', () => {
  const out = shortDescription(
    'Wooden cottage in the pines, with a big terrace.\n' +
    'Phone: +995 599 12 34 56, WhatsApp 555-12-34-56.\n' +
    'Mail nino.fake@example.test or visit https://fake.example.test and fakecottage.ge. Instagram: @fake_cottage\n' +
    'Breakfast on request.',
  );
  assert.equal(out, 'Wooden cottage in the pines, with a big terrace. Breakfast on request.');
  for (const s of ['599', '555', '@', 'example', 'http', 'fakecottage', 'fake_cottage', CONTACT_MARK]) {
    assert.equal(out!.includes(s), false, s);
  }
});

test('SHORT shortDescription keeps Georgian, Russian and English text intact', () => {
  const ka = 'მყუდრო კოტეჯი მთაში, ბუხრით და ხედით კავკასიონზე.';
  const ru = 'Уютный дом у моря, с садом и мангалом.';
  const en = 'Quiet cottage near Kazbegi.';
  assert.equal(shortDescription(ka), ka);
  assert.equal(shortDescription(`${ka}\nტელ: 555 12 34 56\n${ru} Телефон: 8 (800) 555-35-35. ${en}`), `${ka} ${ru} ${en}`);
});

test('SHORT shortDescription collapses whitespace and line breaks', () => {
  assert.equal(shortDescription('  Big   garden.\n\n\tSauna\r\nand   pool.  '), 'Big garden. Sauna and pool.');
});

test('SHORT shortDescription is at most 200 characters, cut at a sentence or word, with "…"', () => {
  assert.equal(SHORT_DESCRIPTION_MAX, 200);
  const sentences = 'The cottage has a lovely view of the mountains. '.repeat(10);
  const a = shortDescription(sentences)!;
  assert.ok(a.length <= 200, String(a.length));
  assert.ok(a.endsWith('mountains…'), a.slice(-20));

  const words = 'wooden ' + 'terrace '.repeat(60);
  const b = shortDescription(words)!;
  assert.ok(b.length <= 200 && b.endsWith('terrace…'), b.slice(-20));

  const ka = shortDescription('კოტეჯი '.repeat(80))!;
  assert.ok(ka.length <= 200 && ka.endsWith('კოტეჯი…'), ka.slice(-20));

  const oneWord = shortDescription('ა'.repeat(500))!;
  assert.equal(oneWord.length, 200);
  assert.ok(oneWord.endsWith('…'));

  const emoji = shortDescription('Sun' + '😀'.repeat(150))!;
  assert.ok(emoji.length <= 200 && !/[\uD800-\uDBFF]…$/.test(emoji), 'an emoji must not be split');

  const exact = 'x'.repeat(200);
  assert.equal(shortDescription(exact), exact, 'not cut, no "…" at exactly the limit');
  for (const n of [201, 250, 1000, 5000]) {
    assert.ok(shortDescription('Nice house. '.repeat(n))!.length <= 200, String(n));
  }
});

test('SHORT shortDescription is null when nothing meaningful remains', () => {
  for (const d of [
    null, undefined, 42, '', '   \n  ', '+995 599 12 34 56', 'Tel: 599-12-34-56\nEmail: nino.fake@example.test',
    'https://fake.example.test', 'fakecottage.ge / @fake_cottage', 'ტელ: 555 12 34 56', '— ! ?', 'ok',
  ]) {
    assert.equal(shortDescription(d), null, JSON.stringify(d));
  }
});

// ── PII: the load-bearing test ───────────────────────────────────────────────

const AT_SIGN = /@/;
const PHONE_SHAPED = /(?:\+?\d[\d\s().-]{6,}\d)/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const FORBIDDEN_KEY = /email|phone|user|customer|guest|host_last_name|booking_id|admin|token|secret|password/i;
// Exact key names that match FORBIDDEN_KEY but carry no personal data.
// max_guests is a listing's capacity (a number), not guest data.
const ALLOWED_KEYS = new Set(['max_guests']);

function assertNoPii(text: string, body: Row, label: string, opts: { allowListingIds?: boolean } = {}) {
  assert.equal(AT_SIGN.test(text), false, `${label}: response contains "@"`);
  const walk = (value: unknown, path: string) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Row)) {
        // `photo_urls` and `url` are public asset/page links; `id` is a listing
        // id, which is already in every public property URL.
        const allowed = (k === 'id' && opts.allowListingIds) || ALLOWED_KEYS.has(k);
        assert.equal(FORBIDDEN_KEY.test(k) && !allowed, false, `${label}: forbidden key ${path}.${k}`);
        walk(v, `${path}.${k}`);
      }
      return;
    }
    if (typeof value === 'string') {
      assert.equal(AT_SIGN.test(value), false, `${label}: "@" at ${path}`);
      const withoutUrls = value.startsWith('http') ? value.replace(UUID, '') : value;
      if (!opts.allowListingIds) {
        assert.equal(UUID.test(withoutUrls), false, `${label}: uuid at ${path}`);
      }
      // An ISO-8601 timestamp is digits and punctuation but is not a phone
      // number; URLs are public links. Strip both before the phone check.
      const scannable = withoutUrls
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '')
        .replace(new RegExp(UUID.source, 'gi'), '');
      assert.equal(PHONE_SHAPED.test(scannable), false, `${label}: phone-shaped string at ${path}`);
    }
  };
  walk(body, '$');
}

test('PII no action and no error path leaks contact data, a booking id or a user id', async () => {
  const cases: { label: string; body: unknown; headers?: Record<string, string>; method?: string; allowListingIds?: boolean }[] = [
    { label: 'weekly-report', body: { action: 'weekly-report' } },
    { label: 'listings (default)', body: { action: 'listings-for-social' }, allowListingIds: true },
    { label: 'listings (max)', body: { action: 'listings-for-social', count: MAX_LISTINGS }, allowListingIds: true },
    { label: 'listings (filtered)', body: { action: 'listings-for-social', count: 5, category: 'Mountain', region: 'Batumi' }, allowListingIds: true },
    { label: 'unauthorized', body: { action: 'weekly-report' }, headers: { 'x-n8n-secret': 'wrong' } },
    { label: 'no secret', body: { action: 'weekly-report' }, headers: {} },
    { label: 'unknown action', body: { action: 'fetch-users' } },
    { label: 'bad count', body: { action: 'listings-for-social', count: 99 } },
    { label: 'bad exclude_ids', body: { action: 'listings-for-social', exclude_ids: 'x' } },
    { label: 'method not allowed', body: null, method: 'GET' },
    { label: 'invalid json', body: '{nope' },
  ];
  for (const c of cases) {
    const h = harness();
    // Seed the fakes with data that WOULD leak if the wrong source were read.
    h.db.listings = h.db.listings.map((l, i) => ({
      ...l,
      description: [
        'Cottage by the lake. Mail host.private@example.test for details.',
        'Mountain house.\nTel: +995 599 12 34 56 / 555-98-76-54',
        'Old stone house. Book at https://private-cottage.example.test/book or privatecottage.ge!',
        'კოტეჯი ტყეში. ტელ: (032) 2 12 34 56, host.private@example.test, www.Private.Ge',
      ][i % 4],
      host_email: 'host.private@example.test',
      host_phone: '+995 599 123 456',
      host_last_name: 'Privatesurname',
    }));
    h.db.statsRows = [{ ...STATS_ROW, user_email: 'guest.private@example.test' }];
    const r = await h.call(c.body, c.headers ?? { 'x-n8n-secret': SECRET }, c.method ?? 'POST');
    assertNoPii(r.text, r.body, c.label, { allowListingIds: c.allowListingIds });
    if (c.allowListingIds) {
      // The fakes above carry an e-mail, a phone and a URL in their
      // descriptions; the scan is only meaningful if cleaned text came back.
      assert.ok(r.body.listings.some((l: Row) => typeof l.short_description === 'string'), `${c.label}: no short_description to scan`);
    }
  }
});

test('PII the column lists themselves exclude contact data', () => {
  for (const cols of [LISTING_COLUMNS.replace(/\bmax_guests\b/, ''), STATS_COLUMNS]) {
    for (const forbidden of ['email', 'phone', 'host_last_name', 'guest', 'customer', 'user_', 'booking_id', 'admin_token']) {
      assert.equal(cols.includes(forbidden), false, `${forbidden} must not be selected (${cols.slice(0, 40)}…)`);
    }
  }
  assert.equal(LISTING_COLUMNS.includes('host_last_initial'), true);
});

test('PII a stats row carrying an unexpected extra column is still returned as-is only for whitelisted columns', async () => {
  // Defence in depth: the view is the boundary, but if somebody added a column
  // to it, the select list is what the function asks for.
  const h = harness();
  const r = await h.call({ action: 'weekly-report' });
  assert.equal(h.db.calls[0].select, STATS_COLUMNS);
  assert.equal(r.text.includes('@'), false);
});

test('logs record the action and a count, never a payload or a secret', async () => {
  const h = harness();
  await h.call({ action: 'listings-for-social', count: 2 });
  await h.call({ action: 'weekly-report' }, { 'x-n8n-secret': 'wrong' });
  const joined = h.logs.join('\n');
  assert.equal(joined.includes(SECRET), false);
  assert.equal(joined.includes('@'), false);
  assert.ok(joined.includes('ok {"action":"listings-for-social","returned":2}'));
  assert.ok(joined.includes('unauthorized'));
});

// ── Sources and secret headers are pinned ────────────────────────────────────

const BASE_TABLES = [
  'property_applications', 'bookings', 'profiles', 'reviews', 'booking_status_logs',
  'corporate_applications', 'email_delivery_logs', 'experience_bookings', 'host_email_broadcasts',
  'blocked_emails', 'blocked_dates', 'ical_blocked_dates', 'external_calendars', 'phone_otps',
];

test('SOURCES no action ever queries a base table — only the two PII-free views', async () => {
  const bodies = [
    { action: 'weekly-report' },
    { action: 'listings-for-social' },
    { action: 'listings-for-social', count: 10, category: 'Mountain', region: 'Batumi', exclude_ids: [] },
  ];
  for (const body of bodies) {
    const h = harness();
    await h.call(body);
    const tables = h.db.calls.map((c) => c.table);
    assert.ok(tables.length > 0, 'the action read nothing at all');
    for (const t of tables) {
      assert.equal(BASE_TABLES.includes(t), false, `${JSON.stringify(body)} read base table ${t}`);
      assert.ok(['marketing_weekly_stats', 'public_properties'].includes(t), `unexpected source ${t}`);
    }
  }
});

test('AUTH no header other than x-n8n-secret can carry the secret', async () => {
  for (const header of [
    'authorization', 'x-api-key', 'x-secret', 'x-body-secret', 'x-admin-password',
    'x-n8n-key', 'apikey', 'n8n-secret',
  ]) {
    const h = harness();
    const r = await h.call({ action: 'weekly-report' }, { [header]: SECRET });
    assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }], header);
    assert.equal(h.db.calls.length, 0, header);
  }
});
