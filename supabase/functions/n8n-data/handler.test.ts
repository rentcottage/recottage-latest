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
  CLEANUP_PAGE_SIZE,
  CONTACT_MARK,
  LISTING_COLUMNS,
  LISTINGS_VIEW,
  MAX_LISTINGS,
  REEL_NAME_RE,
  REEL_RETENTION_DAYS,
  REELS_BUCKET,
  REELS_PREFIX,
  SHORT_DESCRIPTION_MAX,
  STATS_COLUMNS,
  STATS_VIEW,
  UPLOAD_URL_TTL_SECONDS,
  clientBucket,
  createHandler,
  defaultRandomId,
  displayName,
  isExpiredReel,
  photoCount,
  pickRotating,
  providedSecret,
  redactContacts,
  reelPath,
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
      eq(col: string, value: unknown) {
        call.filters.push(`${col}=${String(value)}`);
        rows = rows.filter((r) => r[col] === value);
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

/**
 * In-memory Storage. It records every bucket it was asked for and every path
 * it was asked to sign, list or remove, so a test can assert not just the
 * response but exactly which objects the function reached for.
 */
class FakeStorage {
  buckets: string[] = [];
  signed: string[] = [];
  listed: { prefix: string; limit: number; offset: number }[] = [];
  removed: string[] = [];
  objects: Row[] = [];
  failSign = false;
  failList = false;
  failRemove = false;
  noPublicUrl = false;

  from(bucket: string) {
    this.buckets.push(bucket);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const s = this;
    return {
      async createSignedUploadUrl(path: string) {
        s.signed.push(path);
        if (s.failSign) return { data: null, error: { message: 'signing blew up' } };
        return {
          data: { signedUrl: `https://sb.example.test/storage/v1/object/upload/sign/${bucket}/${path}?token=faketoken`, token: 'faketoken', path },
          error: null,
        };
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: s.noPublicUrl ? '' : `https://sb.example.test/storage/v1/object/public/${bucket}/${path}` } };
      },
      async list(prefix: string, options: { limit: number; offset: number }) {
        s.listed.push({ prefix, limit: options.limit, offset: options.offset });
        if (s.failList) return { data: null, error: { message: 'listing blew up' } };
        // Storage returns names RELATIVE to the prefix.
        const inPrefix = s.objects.filter((o) => String(o.fullPath).startsWith(`${prefix}/`));
        const page = inPrefix
          .slice(options.offset, options.offset + options.limit)
          .map((o) => ({ ...o, name: String(o.fullPath).slice(prefix.length + 1) }));
        return { data: page, error: null };
      },
      async remove(paths: string[]) {
        s.removed.push(...paths);
        if (s.failRemove) return { data: null, error: { message: 'removal blew up' } };
        s.objects = s.objects.filter((o) => !paths.includes(String(o.fullPath)));
        return { data: paths.map((p) => ({ name: p })), error: null };
      },
    };
  }
}

/** A stored object, `days` old relative to NOW. */
function storedReel(name: string, days: number, prefix = 'reels'): Row {
  return {
    id: `obj-${name}`,
    fullPath: `${prefix}/${name}`,
    created_at: new Date(NOW.getTime() - days * 86_400_000).toISOString(),
  };
}

const RANDOM_ID = 'abcdef0123456789';

function harness(opts: { secret?: string } = { secret: SECRET }) {
  const secret = 'secret' in opts ? opts.secret : SECRET;
  const db = new FakeDb();
  const storage = new FakeStorage();
  const logs: string[] = [];
  const handler = createHandler({
    db, storage, secret, now: () => NOW, randomId: () => RANDOM_ID,
    log: (e, f) => logs.push(`${e} ${JSON.stringify(f ?? {})}`),
  });
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
  return { db, storage, logs, call };
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

test('ROUTING the whitelist holds exactly the four actions', () => {
  assert.deepEqual(Object.keys(ACTIONS).sort(),
    ['listings-for-social', 'reel-cleanup', 'reel-upload-url', 'weekly-report']);
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
      // A calendar date, with or without a time, is digits and punctuation but
      // is not a phone number — `reels/2026-09-20-….mp4` would otherwise read
      // as one. Same reasoning as the timestamp rule this widens.
      const scannable = withoutUrls
        .replace(/https?:\/\/\S+/g, '')
        // A reel object name is an opaque, server-generated random string; a
        // run of hex digits inside it is not a phone number. (The fake RNG in
        // this file deliberately yields one that would read as one.)
        .replace(/reels\/\d{4}-\d{2}-\d{2}-[a-z0-9]+\.mp4/gi, '')
        .replace(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?/g, '')
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
    { label: 'listings (min_photos)', body: { action: 'listings-for-social', count: 5, min_photos: 2 }, allowListingIds: true },
    { label: 'reel-upload-url', body: { action: 'reel-upload-url', listing_id: '11110000-2222-4222-8222-333333333333' } },
    { label: 'reel-upload-url (bad id)', body: { action: 'reel-upload-url', listing_id: 'nope' } },
    { label: 'reel-upload-url (unknown listing)', body: { action: 'reel-upload-url', listing_id: '99990000-2222-4222-8222-333333333333' } },
    { label: 'reel-cleanup', body: { action: 'reel-cleanup' } },
    { label: 'bad min_photos', body: { action: 'listings-for-social', min_photos: -1 } },
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
    { action: 'listings-for-social', count: 10, category: 'Mountain', region: 'Batumi', exclude_ids: [], min_photos: 2 },
    { action: 'reel-upload-url', listing_id: '11110000-2222-4222-8222-333333333333' },
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
  // reel-cleanup is the one action that reads no table at all — asserted
  // positively, so that a future edit which made it query something shows up.
  const h = harness();
  await h.call({ action: 'reel-cleanup' });
  assert.deepEqual(h.db.calls, []);
});

test('SOURCES no action ever touches a bucket other than social-videos', async () => {
  const bodies = [
    { action: 'weekly-report' },
    { action: 'listings-for-social' },
    { action: 'reel-upload-url', listing_id: '11110000-2222-4222-8222-333333333333' },
    { action: 'reel-cleanup' },
  ];
  for (const body of bodies) {
    const h = harness();
    h.storage.objects = [storedReel(`2026-09-01-${'a'.repeat(16)}.mp4`, 30)];
    await h.call(body);
    for (const b of h.storage.buckets) {
      assert.equal(b, REELS_BUCKET, `${JSON.stringify(body)} reached bucket ${b}`);
    }
    for (const path of [...h.storage.signed, ...h.storage.removed]) {
      assert.ok(path.startsWith(`${REELS_PREFIX}/`), `${JSON.stringify(body)} touched ${path}`);
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

// ── min_photos ───────────────────────────────────────────────────────────────

test('MINPHOTOS photoCount is the de-duplicated union of the cover and photo_urls', () => {
  const cases: [Row, number][] = [
    [{ cover_photo_url: null, photo_urls: [] }, 0],
    [{ cover_photo_url: 'a.webp', photo_urls: [] }, 1],
    // the usual shape: the cover IS the first photo, and must count once
    [{ cover_photo_url: 'a.webp', photo_urls: ['a.webp', 'b.webp'] }, 2],
    [{ cover_photo_url: 'a.webp', photo_urls: ['b.webp', 'c.webp'] }, 3],
    // whitespace-only, empty and non-string entries are not photos
    [{ cover_photo_url: '  ', photo_urls: ['', null, 7, 'b.webp'] }, 1],
    // trimming happens before de-duplication
    [{ cover_photo_url: 'a.webp', photo_urls: [' a.webp '] }, 1],
    [{ cover_photo_url: undefined, photo_urls: 'not-an-array' }, 0],
  ];
  for (const [row, expected] of cases) {
    assert.equal(photoCount(row), expected, JSON.stringify(row));
  }
});

test('MINPHOTOS listings-for-social filters on the photo count and reports it in `available`', async () => {
  const h = harness();
  // 0,1,2,…,5 distinct photos across six listings.
  h.db.listings = listingRows(6).map((l, i) => ({
    ...l,
    cover_photo_url: i === 0 ? null : 'cover.webp',
    photo_urls: Array.from({ length: Math.max(0, i - 1) }, (_, k) => `p-${k}.webp`),
  }));

  const all = await h.call({ action: 'listings-for-social', count: 10 });
  assert.equal(all.body.available, 6);

  for (const [min, expected] of [[0, 6], [1, 5], [3, 3], [5, 1], [6, 0]] as [number, number][]) {
    const r = await h.call({ action: 'listings-for-social', count: 10, min_photos: min });
    assert.equal(r.status, 200, `min_photos=${min}`);
    assert.equal(r.body.available, expected, `min_photos=${min}: available`);
    assert.equal(r.body.listings.length, expected, `min_photos=${min}: returned`);
    for (const l of r.body.listings) {
      assert.ok(photoCount(l) >= min, `min_photos=${min}: a listing with ${photoCount(l)} photos came back`);
    }
  }
});

test('MINPHOTOS a bad min_photos is a 400 and reads nothing', async () => {
  for (const min of [-1, 1.5, '3', null, 51, NaN, Infinity, true, [3]]) {
    const h = harness();
    const r = await h.call({ action: 'listings-for-social', min_photos: min });
    assert.deepEqual([r.status, r.body], [400, { error: 'Invalid min_photos' }], JSON.stringify(min));
    assert.equal(h.db.calls.length, 0, `${JSON.stringify(min)} reached the database`);
  }
});

// ── reel-upload-url ──────────────────────────────────────────────────────────

const LISTING_ID = '11110000-2222-4222-8222-333333333333';

test('REELUP returns upload_url, public_url and path for a known listing', async () => {
  const h = harness();
  const r = await h.call({ action: 'reel-upload-url', listing_id: LISTING_ID });

  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(),
    ['expires_in', 'generated_at', 'path', 'public_url', 'upload_url']);
  assert.equal(r.body.path, `reels/2026-09-18-${RANDOM_ID}.mp4`);
  assert.equal(r.body.expires_in, UPLOAD_URL_TTL_SECONDS);
  assert.ok(UPLOAD_URL_TTL_SECONDS <= 7200, 'the upload URL must not outlive two hours');
  assert.ok(r.body.public_url.endsWith(`/object/public/${REELS_BUCKET}/${r.body.path}`));
  assert.ok(r.body.upload_url.includes(`/object/upload/sign/${REELS_BUCKET}/${r.body.path}`));

  // Exactly one bucket, exactly one path, and nothing was listed or removed.
  assert.deepEqual(h.storage.buckets, [REELS_BUCKET]);
  assert.deepEqual(h.storage.signed, [r.body.path]);
  assert.deepEqual(h.storage.removed, []);
  assert.deepEqual(h.storage.listed, []);
});

test('REELUP the path is chosen server-side: nothing in the body can influence it', async () => {
  const attempts: Row[] = [
    { path: '../avatars/evil.mp4' },
    { Path: 'reels/evil.mp4' },
    { filename: 'evil.mp4' },
    { name: 'evil' },
    { upload_url: 'https://evil.test/' },
    { prefix: 'avatars' },
    { bucket: 'property-photos' },
    { date: '1999-01-01' },
    { random: 'deadbeef' },
    { listing_id: LISTING_ID, path: 'reels/../../etc/passwd' },
  ];
  const expected = `reels/2026-09-18-${RANDOM_ID}.mp4`;
  for (const extra of attempts) {
    const h = harness();
    const r = await h.call({ action: 'reel-upload-url', listing_id: LISTING_ID, ...extra });
    assert.equal(r.status, 200, JSON.stringify(extra));
    assert.equal(r.body.path, expected, `body ${JSON.stringify(extra)} changed the path`);
    assert.deepEqual(h.storage.signed, [expected], `body ${JSON.stringify(extra)} was signed`);
    assert.deepEqual(h.storage.buckets, [REELS_BUCKET]);
  }
});

test('REELUP the signed URL targets that one path and no other', async () => {
  const h = harness();
  const r = await h.call({ action: 'reel-upload-url', listing_id: LISTING_ID });
  // One signature request, for a path inside reels/ that matches the name rule.
  assert.equal(h.storage.signed.length, 1);
  const [prefix, ...rest] = h.storage.signed[0].split('/');
  assert.equal(prefix, REELS_PREFIX);
  assert.equal(rest.length, 1, 'the path must be one flat segment under reels/');
  assert.ok(REEL_NAME_RE.test(rest[0]), `${rest[0]} is not a reel name`);
  // And the URL the caller got back is for exactly that path.
  assert.ok(r.body.upload_url.includes(h.storage.signed[0]));
  assert.ok(r.body.public_url.includes(h.storage.signed[0]));
});

test('REELUP reelPath is date + random only, and rejects a suffix that would escape', () => {
  const day = new Date('2026-01-05T23:59:59.000Z');
  assert.equal(reelPath(day, () => 'abcdef0123456789'), 'reels/2026-01-05-abcdef0123456789.mp4');
  // Upper case and punctuation are stripped, not passed through.
  assert.equal(reelPath(day, () => 'AB-CD/EF..0123'), 'reels/2026-01-05-abcdef0123.mp4');
  // A suffix that sanitises away entirely must not yield `reels/2026-01-05-.mp4`.
  for (const bad of ['', '../', '///', '!!']) {
    assert.throws(() => reelPath(day, () => bad), `reelPath accepted ${JSON.stringify(bad)}`);
  }
});

test('REELUP defaultRandomId is 16 hex characters and does not repeat', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const id = defaultRandomId();
    assert.match(id, /^[0-9a-f]{16}$/);
    seen.add(id);
  }
  assert.equal(seen.size, 200, 'defaultRandomId produced a collision in 200 draws');
});

test('REELUP a malformed listing_id is rejected BEFORE the database is touched', async () => {
  // The shape check is its own control: a string that is not a uuid must never
  // reach the query, even though the existence check would also turn it away.
  const malformed: unknown[] = [
    undefined, null, '', '   ', 'not-a-uuid', 123, {}, [], true,
    '11110000-2222-4222-8222-33333333333',          // too short
    '11110000-2222-4222-8222-3333333333333',        // too long
    '11110000-2222-4222-8222-33333333333g',         // not hex
    '11110000222242228222333333333333',             // no dashes
    "11110000-2222-4222-8222-333333333333' or '1",  // injection-shaped
    '../../avatars/x',
  ];
  for (const id of malformed) {
    const h = harness();
    const r = await h.call({ action: 'reel-upload-url', listing_id: id });
    assert.deepEqual([r.status, r.body], [400, { error: 'Invalid listing_id' }], JSON.stringify(id));
    assert.equal(h.db.calls.length, 0, `${JSON.stringify(id)} reached the database`);
    assert.deepEqual(h.storage.signed, [], `${JSON.stringify(id)} got a signed URL`);
    assert.deepEqual(h.storage.buckets, []);
  }
});

test('REELUP a listing_id is trimmed before it is validated', async () => {
  // asString() trims, so a value that arrives padded is still the same uuid.
  const h = harness();
  const r = await h.call({ action: 'reel-upload-url', listing_id: `  ${LISTING_ID}\n` });
  assert.equal(r.status, 200);
  assert.deepEqual(h.db.calls.map((c) => c.filters).flat(), [`id=${LISTING_ID}`]);
});

test('REELUP a well-formed but unknown listing_id gets no URL either', async () => {
  const h = harness();
  const r = await h.call({ action: 'reel-upload-url', listing_id: '99990000-2222-4222-8222-333333333333' });
  assert.deepEqual([r.status, r.body], [400, { error: 'Unknown listing' }]);
  // It DID ask the view — that is the difference from a malformed id.
  assert.deepEqual(h.db.calls.map((c) => c.table), [LISTINGS_VIEW]);
  assert.deepEqual(h.storage.signed, []);
  assert.deepEqual(h.storage.buckets, []);
});

test('REELUP a storage or database failure is a generic 500 that echoes nothing', async () => {
  for (const breaks of ['failSign', 'noPublicUrl', 'db'] as const) {
    const h = harness();
    if (breaks === 'db') h.db.failListings = true;
    else h.storage[breaks] = true;
    const r = await h.call({ action: 'reel-upload-url', listing_id: LISTING_ID });
    assert.deepEqual([r.status, r.body], [500, { error: 'Request failed' }], breaks);
    assert.equal(r.text.includes('blew up'), false, breaks);
    assert.equal(r.text.includes('password'), false, breaks);
  }
});

test('REELUP without a storage client the action fails closed', async () => {
  const db = new FakeDb();
  const handler = createHandler({ db, secret: SECRET, now: () => NOW });
  const res = await handler(new Request('https://fn.local/n8n-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-n8n-secret': SECRET, 'x-forwarded-for': '10.0.0.1' },
    body: JSON.stringify({ action: 'reel-upload-url', listing_id: LISTING_ID }),
  }));
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'Request failed' });
});

// ── reel-cleanup ─────────────────────────────────────────────────────────────

test('CLEANUP deletes only reels strictly older than three days', async () => {
  const h = harness();
  h.storage.objects = [
    storedReel(`2026-09-18-${'a'.repeat(16)}.mp4`, 0),                        // today
    storedReel(`2026-09-17-${'b'.repeat(16)}.mp4`, 1),
    storedReel(`2026-09-16-${'c'.repeat(16)}.mp4`, 2.99),                     // just under 3d
    storedReel(`2026-09-15-${'d'.repeat(16)}.mp4`, 3),                        // exactly 3d
    storedReel(`2026-09-15-${'e'.repeat(16)}.mp4`, 3.01),                     // just over
    storedReel(`2026-09-10-${'f'.repeat(16)}.mp4`, 9),
  ];
  const r = await h.call({ action: 'reel-cleanup' });

  assert.equal(r.status, 200);
  assert.equal(r.body.deleted, 2);
  assert.equal(r.body.scanned, 6);
  assert.deepEqual(h.storage.removed.sort(), [
    `reels/2026-09-10-${'f'.repeat(16)}.mp4`,
    `reels/2026-09-15-${'e'.repeat(16)}.mp4`,
  ]);
  // Everything younger than the cut-off survived.
  assert.equal(h.storage.objects.length, 4);
});

test('CLEANUP never touches an object outside reels/', async () => {
  const h = harness();
  h.storage.objects = [
    storedReel(`2026-09-01-${'a'.repeat(16)}.mp4`, 19),                       // old, in reels/
    storedReel(`2026-09-01-${'b'.repeat(16)}.mp4`, 19, 'avatars'),            // old, elsewhere
    storedReel(`2026-09-01-${'c'.repeat(16)}.mp4`, 19, 'property-photos'),
    storedReel(`2026-09-01-${'d'.repeat(16)}.mp4`, 19, 'reels/nested'),       // old, nested deeper
  ];
  const r = await h.call({ action: 'reel-cleanup' });

  assert.equal(r.body.deleted, 1);
  assert.deepEqual(h.storage.removed, [`reels/2026-09-01-${'a'.repeat(16)}.mp4`]);
  // The prefix was pinned on the way in, too.
  assert.ok(h.storage.listed.length > 0);
  for (const l of h.storage.listed) assert.equal(l.prefix, REELS_PREFIX);
  assert.deepEqual(h.storage.buckets, [REELS_BUCKET]);
});

test('CLEANUP skips folders, placeholders and anything not reel-shaped', async () => {
  const h = harness();
  const old = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
  h.storage.objects = [
    { id: null, fullPath: 'reels/subfolder', created_at: old },                  // a folder
    { id: 'p', fullPath: 'reels/.emptyFolderPlaceholder', created_at: old },
    { id: 'q', fullPath: 'reels/../avatars/escape.mp4', created_at: old },
    { id: 'r', fullPath: 'reels/nested/deep.mp4', created_at: old },
    { id: 's', fullPath: 'reels/no-date-here.mp4', created_at: old },
    { id: 't', fullPath: 'reels/2026-09-01-ok0123456789abcd.txt', created_at: old },
    { id: 'u', fullPath: `reels/2026-09-01-${'a'.repeat(16)}.mp4`, created_at: null },  // no timestamp
    { id: 'v', fullPath: `reels/2026-09-01-${'b'.repeat(16)}.mp4`, created_at: 'not a date' },
    { id: 'w', fullPath: `reels/2026-09-01-${'c'.repeat(16)}.mp4`, created_at: old },   // the only one
  ];
  const r = await h.call({ action: 'reel-cleanup' });

  assert.equal(r.body.deleted, 1);
  assert.deepEqual(h.storage.removed, [`reels/2026-09-01-${'c'.repeat(16)}.mp4`]);
});

test('CLEANUP isExpiredReel is false for every not-strictly-expired case', () => {
  const name = `2026-09-01-${'a'.repeat(16)}.mp4`;
  const old = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
  const ok = { id: 'x', name, created_at: old };
  assert.equal(isExpiredReel(ok, NOW), true);
  for (const bad of [
    null, undefined, 'a string', 42,
    { ...ok, id: null }, { ...ok, id: '' }, { ...ok, id: 7 },
    { ...ok, name: `reels/${name}` }, { ...ok, name: `../${name}` }, { ...ok, name: undefined },
    { ...ok, name: name.replace('.mp4', '.mov') },
    { ...ok, created_at: undefined }, { ...ok, created_at: 'soon' },
    // exactly at the boundary is not "older than"
    { ...ok, created_at: new Date(NOW.getTime() - REEL_RETENTION_DAYS * 86_400_000).toISOString() },
    // and a future timestamp is certainly not expired
    { ...ok, created_at: new Date(NOW.getTime() + 86_400_000).toISOString() },
  ]) {
    assert.equal(isExpiredReel(bad as Row, NOW), false, JSON.stringify(bad));
  }
});

test('CLEANUP pages through a full bucket and stops when a page is short', async () => {
  const h = harness();
  const total = CLEANUP_PAGE_SIZE * 2 + 5;
  h.storage.objects = Array.from({ length: total }, (_, i) =>
    storedReel(`2026-09-01-${String(i).padStart(16, '0')}.mp4`, 30));
  const r = await h.call({ action: 'reel-cleanup' });

  assert.equal(r.body.scanned, total);
  assert.equal(r.body.deleted, total);
  assert.deepEqual(h.storage.listed.map((l) => l.offset),
    [0, CLEANUP_PAGE_SIZE, CLEANUP_PAGE_SIZE * 2]);
  assert.equal(h.storage.removed.length, total);
  assert.equal(h.storage.objects.length, 0);
});

test('CLEANUP an empty bucket is a 200 with deleted: 0 and no removal call', async () => {
  const h = harness();
  const r = await h.call({ action: 'reel-cleanup' });
  assert.deepEqual([r.status, r.body.deleted, r.body.scanned], [200, 0, 0]);
  assert.deepEqual(h.storage.removed, []);
});

test('CLEANUP a listing or removal failure is a generic 500 and deletes nothing more', async () => {
  for (const breaks of ['failList', 'failRemove'] as const) {
    const h = harness();
    h.storage.objects = [storedReel(`2026-09-01-${'a'.repeat(16)}.mp4`, 30)];
    h.storage[breaks] = true;
    const r = await h.call({ action: 'reel-cleanup' });
    assert.deepEqual([r.status, r.body], [500, { error: 'Request failed' }], breaks);
    assert.equal(r.text.includes('blew up'), false, breaks);
    assert.equal(h.storage.objects.length, 1, `${breaks}: an object was deleted anyway`);
  }
});

test('CLEANUP reads no database table at all', async () => {
  const h = harness();
  h.storage.objects = [storedReel(`2026-09-01-${'a'.repeat(16)}.mp4`, 30)];
  await h.call({ action: 'reel-cleanup' });
  assert.deepEqual(h.db.calls, [], 'reel-cleanup touched a data source');
});

test('CLEANUP the reel actions are behind the same gate and the same throttle', async () => {
  for (const body of [{ action: 'reel-cleanup' }, { action: 'reel-upload-url', listing_id: LISTING_ID }]) {
    // Wrong secret → the same generic 401, with no bucket touched.
    const h = harness();
    const r = await h.call(body, { 'x-n8n-secret': 'wrong' });
    assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }], JSON.stringify(body));
    assert.deepEqual(h.storage.buckets, [], JSON.stringify(body));
    assert.deepEqual(h.storage.signed, []);
    assert.deepEqual(h.storage.removed, []);

    // And the throttle applies: 10 failures from one client → 429 even when
    // the secret is then correct.
    const t = harness();
    const ip = { 'x-forwarded-for': '203.0.113.7' };
    for (let i = 0; i < MAX_FAILURES; i++) {
      await t.call(body, { ...ip, 'x-n8n-secret': 'wrong' });
    }
    const blocked = await t.call(body, { ...ip, 'x-n8n-secret': SECRET });
    assert.deepEqual([blocked.status, blocked.body], [429, { error: 'Too many attempts' }], JSON.stringify(body));
    assert.deepEqual(t.storage.buckets, [], JSON.stringify(body));
  }
});

test('CLEANUP the log line carries counts only, never a path or an upload URL', async () => {
  const h = harness();
  h.storage.objects = [storedReel(`2026-09-01-${'a'.repeat(16)}.mp4`, 30)];
  await h.call({ action: 'reel-cleanup' });
  await h.call({ action: 'reel-upload-url', listing_id: LISTING_ID });
  const joined = h.logs.join('\n');
  assert.ok(joined.includes('"action":"reel-cleanup"'));
  assert.ok(joined.includes('"deleted":1'));
  assert.equal(joined.includes('faketoken'), false, 'the upload token reached the log');
  assert.equal(joined.includes('reels/'), false, 'an object path reached the log');
  assert.equal(joined.includes(SECRET), false);
});

test('REELS the bucket, prefix and retention are pinned to their literal values', () => {
  // These four are a contract with things outside this file: the bucket and
  // prefix must match 20260920120000_storage_social_videos.sql, the retention
  // is what that migration's comment promises, and the URL life is the ceiling
  // the design allows. Asserting them symbolically elsewhere would let a
  // rename sail through every other test in this file.
  assert.equal(REELS_BUCKET, 'social-videos');
  assert.equal(REELS_PREFIX, 'reels');
  assert.equal(REEL_RETENTION_DAYS, 3);
  assert.ok(UPLOAD_URL_TTL_SECONDS > 0 && UPLOAD_URL_TTL_SECONDS <= 7200,
    `upload URLs must live at most two hours, got ${UPLOAD_URL_TTL_SECONDS}s`);
});
