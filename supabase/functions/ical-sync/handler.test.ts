// Security-boundary tests for ical-sync.
//
// Run (Node >= 22.18 / 24, built-in TypeScript type stripping):
//   node --test supabase/functions/ical-sync/handler.test.ts
//
// Supabase, token verification, DNS and TLS transport are faked in memory.
// No network, no secrets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkCalendarUrl, createHandler, isICalendarBody, isPublicIPv4, isPublicIPv6, safeFetchCalendar,
  type AuthUser, type HandlerDeps, type NetDeps, type Transport,
} from './handler.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ─── Fake Supabase ────────────────────────────────────────────────────────────

class FakeDb {
  tables: Record<string, Row[]>;
  failWhen: (table: string, op: string) => boolean = () => false;
  writes: { table: string; op: string; payload: Row | null }[] = [];
  constructor(tables: Record<string, Row[]>) { this.tables = tables; }
  from(table: string) { if (!this.tables[table]) this.tables[table] = []; return new FakeQuery(this, table); }
  rows(t: string) { return this.tables[t] ?? []; }
}

class FakeQuery {
  private op: 'select' | 'update' | 'insert' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private returning = false;
  private single = false;
  private db: FakeDb;
  private table: string;
  constructor(db: FakeDb, table: string) { this.db = db; this.table = table; }
  select(_c?: string) { if (this.op !== 'select') this.returning = true; return this; }
  update(p: Row) { this.op = 'update'; this.payload = p; return this; }
  insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] != null && String(r[c]) === String(v)); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.some((v) => String(r[c]) === String(v))); return this; }
  order() { return this; }
  maybeSingle() { this.single = true; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(resolve: (v: any) => void, reject: (e: unknown) => void) {
    Promise.resolve().then(() => {
      try { resolve(this.exec()); } catch (e) { reject(e); }
    });
  }
  private exec() {
    if (this.db.failWhen(this.table, this.op)) return { data: null, error: { message: 'relation "secret_internal_table" does not exist; host=10.0.0.5' } };
    const rows = this.db.tables[this.table];
    const match = () => rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === 'select') {
      const out = match().map((r) => ({ ...r }));
      return { data: this.single ? (out[0] ?? null) : out, error: null };
    }
    if (this.op === 'update') {
      for (const r of match()) Object.assign(r, this.payload);
      this.db.writes.push({ table: this.table, op: 'update', payload: this.payload as Row });
      return { data: null, error: null };
    }
    if (this.op === 'delete') {
      const hit = match();
      this.db.tables[this.table] = rows.filter((r) => !hit.includes(r));
      this.db.writes.push({ table: this.table, op: 'delete', payload: null });
      return { data: null, error: null };
    }
    const items = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
    const inserted = items.map((it, i) => ({ id: it.id ?? `new-${this.table}-${rows.length + i + 1}`, created_at: '2026-09-17T00:00:00Z', ...it }));
    rows.push(...inserted);
    this.db.writes.push({ table: this.table, op: 'insert', payload: items as unknown as Row });
    return { data: this.single || this.returning ? (this.single ? inserted[0] : inserted) : null, error: null };
  }
}

// ─── Fake network ─────────────────────────────────────────────────────────────

const ICS_OK = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:evt-1@airbnb', 'SUMMARY:Reserved', 'DTSTART;VALUE=DATE:20270110', 'DTEND;VALUE=DATE:20270113', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:evt-2@airbnb', 'SUMMARY:Not available', 'DTSTART;VALUE=DATE:20270201', 'DTEND;VALUE=DATE:20270203', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:old@airbnb', 'SUMMARY:Past', 'DTSTART;VALUE=DATE:20250101', 'DTEND;VALUE=DATE:20250103', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

type Behaviour = { response?: string; hang?: boolean; chunkSize?: number; failConnect?: boolean };

class FakeNet {
  dns: Record<string, { A?: string[]; AAAA?: string[] }> = {};
  servers: Record<string, Behaviour> = {};
  connects: { ip: string; port: number; serverName: string }[] = [];
  requests: string[] = [];
  deps(extra: Partial<NetDeps> = {}): NetDeps {
    return {
      resolveDns: async (host, type) => {
        const r = this.dns[host]?.[type];
        if (!r) throw new Error(`NXDOMAIN ${host}`);
        return r;
      },
      openTls: async (ip, port, serverName) => {
        this.connects.push({ ip, port, serverName });
        const b = this.servers[ip] ?? { response: http(200, ICS_OK) };
        if (b.failConnect) throw new Error(`connection refused to ${ip}:${port}`);
        const bytes = new TextEncoder().encode(b.response ?? '');
        let off = 0;
        const t: Transport = {
          write: async (p) => { this.requests.push(new TextDecoder().decode(p)); return p.length; },
          read: async (p) => {
            if (b.hang) return new Promise<number | null>(() => {});
            if (off >= bytes.length) return null;
            const n = Math.min(p.length, b.chunkSize ?? p.length, bytes.length - off);
            p.set(bytes.subarray(off, off + n));
            off += n;
            return n;
          },
          close: () => {},
        };
        return t;
      },
      timeoutMs: 200,
      maxBytes: 64 * 1024,
      ...extra,
    };
  }
}

function http(status: number, body: string, headers: Record<string, string> = {}): string {
  const h = { 'Content-Type': 'text/calendar', 'Content-Length': String(new TextEncoder().encode(body).length), ...headers };
  return `HTTP/1.1 ${status} X\r\n${Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n${body}`;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ANON_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.anon-signature';
const HOST_A = 'host.alpha.private@example.test';
const HOST_B = 'host.beta.private@example.test';
const GUEST = 'Private Guest Name';
const PRIVATE_URL_TOKEN = 'secret-ical-token-abc123';
const A_URL = `https://www.airbnb.test/calendar/ical/1.ics?s=${PRIVATE_URL_TOKEN}`;

const USERS: Record<string, AuthUser> = {
  'tok-host-a': { id: 'u-a', email: HOST_A, emailConfirmed: true },
  'tok-host-a-upper': { id: 'u-a', email: HOST_A.toUpperCase(), emailConfirmed: true },
  'tok-host-b': { id: 'u-b', email: HOST_B, emailConfirmed: true },
  'tok-unconfirmed': { id: 'u-x', email: HOST_A, emailConfirmed: false },
  'tok-no-email': { id: 'u-y', email: null, emailConfirmed: true },
};

function tables(): Record<string, Row[]> {
  return {
    property_applications: [
      { id: 'prop-a', host_email: HOST_A, title: 'Alpha Cottage' },
      { id: 'prop-b', host_email: HOST_B, title: 'Beta House' },
    ],
    external_calendars: [
      { id: 'cal-a', property_id: 'prop-a', host_email: HOST_A, platform: 'airbnb', label: null, ical_url: A_URL, sync_status: 'synced' },
      { id: 'cal-b', property_id: 'prop-b', host_email: HOST_B, platform: 'booking_com', label: null, ical_url: 'https://admin.booking.test/export/b.ics', sync_status: 'synced' },
      { id: 'cal-forged', property_id: 'prop-b', host_email: HOST_A, platform: 'airbnb', label: null, ical_url: A_URL, sync_status: 'pending' },
    ],
    ical_blocked_dates: [
      { id: 'blk-a1', property_id: 'prop-a', calendar_id: 'cal-a', start_date: '2027-03-01', end_date: '2027-03-04', summary: GUEST, host_email: HOST_A },
      { id: 'blk-b1', property_id: 'prop-b', calendar_id: 'cal-b', start_date: '2027-04-01', end_date: '2027-04-05', summary: GUEST, host_email: HOST_B },
    ],
    bookings: [
      { id: 'bk-1', property_id: 'prop-a', check_in: '2027-05-01', check_out: '2027-05-03', status: 'confirmed', user_email: 'guest@example.test' },
      { id: 'bk-2', property_id: 'prop-a', check_in: '2027-06-01', check_out: '2027-06-02', status: 'cancelled', user_email: 'guest@example.test' },
    ],
    blocked_dates: [{ id: 'bd-1', property_id: 'prop-a', start_date: '2027-07-01', end_date: '2027-07-02' }],
  };
}

interface H { db: FakeDb; net: FakeNet; logs: { event: string; fields?: Row }[]; handler: (r: Request) => Promise<Response> }

function harness(netExtra: Partial<NetDeps> = {}): H {
  const db = new FakeDb(tables());
  const net = new FakeNet();
  net.dns['www.airbnb.test'] = { A: ['93.184.216.34'] };
  net.dns['admin.booking.test'] = { A: ['151.101.1.1'] };
  net.dns['new.calendar.test'] = { A: ['104.16.1.1'], AAAA: ['2606:4700::6810:101'] };
  const logs: H['logs'] = [];
  const deps: HandlerDeps = {
    ...net.deps(netExtra),
    db,
    getUserFromToken: async (t) => USERS[t] ?? null,
    now: () => new Date('2026-09-17T10:00:00Z'),
    log: (event, fields) => logs.push({ event, fields }),
  };
  return { db, net, logs, handler: createHandler(deps) };
}

async function post(h: H, body: Row | string, headers: Record<string, string> = {}) {
  const res = await h.handler(new Request('https://fn.local/functions/v1/ical-sync', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  const text = await res.text();
  let json: Row = {};
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
}

const as = (tok: string) => ({ Authorization: `Bearer ${tok}` });
const snapshot = (h: H) => JSON.stringify(h.db.tables);

// ─── Authentication ───────────────────────────────────────────────────────────

const ACTIONS: Row[] = [
  { action: 'add-calendar', property_id: 'prop-a', platform: 'airbnb', ical_url: 'https://new.calendar.test/x.ics', host_email: HOST_A },
  { action: 'remove-calendar', calendar_id: 'cal-a', host_email: HOST_A },
  { action: 'sync-calendar', calendar_id: 'cal-a', host_email: HOST_A },
  { action: 'sync-all', property_id: 'prop-a', host_email: HOST_A },
];

test('AUTH no Authorization header → 401 for every action, no side effects, no network', async () => {
  const h = harness();
  const before = snapshot(h);
  for (const body of ACTIONS) {
    const r = await post(h, body);
    assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }], body.action);
  }
  assert.equal(snapshot(h), before);
  assert.equal(h.net.connects.length, 0);
});

test('AUTH anon public key (as Bearer and apikey) → 401', async () => {
  const h = harness();
  for (const body of ACTIONS) {
    assert.equal((await post(h, body, { apikey: ANON_JWT, Authorization: `Bearer ${ANON_JWT}` })).status, 401, body.action);
  }
  assert.equal(h.net.connects.length, 0);
});

test('AUTH invalid, non-user, unconfirmed or email-less tokens → 401', async () => {
  const h = harness();
  for (const headers of [as('garbage'), as('tok-unconfirmed'), as('tok-no-email'), { Authorization: 'Basic abc' }, { Authorization: 'Bearer ' }]) {
    for (const body of ACTIONS) assert.equal((await post(h, body, headers)).status, 401);
  }
  assert.equal(h.db.writes.length, 0);
});

test('AUTH valid authenticated host → allowed on own resources', async () => {
  const h = harness();
  assert.equal((await post(h, ACTIONS[2], as('tok-host-a'))).status, 200);
  assert.equal((await post(h, ACTIONS[3], as('tok-host-a'))).status, 200);
  assert.equal((await post(h, ACTIONS[0], as('tok-host-a'))).status, 200);
  assert.equal((await post(h, ACTIONS[1], as('tok-host-a'))).status, 200);
});

// ─── Ownership ────────────────────────────────────────────────────────────────

test('OWN add-calendar on own property → 200; on another host\'s property → 403, nothing stored', async () => {
  const h = harness();
  assert.equal((await post(h, { action: 'add-calendar', property_id: 'prop-a', platform: 'airbnb', ical_url: 'https://new.calendar.test/a.ics' }, as('tok-host-a'))).status, 200);
  const before = h.db.rows('external_calendars').length;
  const r = await post(h, { action: 'add-calendar', property_id: 'prop-b', platform: 'airbnb', ical_url: 'https://new.calendar.test/b.ics', host_email: HOST_B }, as('tok-host-a'));
  assert.deepEqual([r.status, r.body], [403, { error: 'Forbidden' }]);
  assert.equal(h.db.rows('external_calendars').length, before);
});

test('OWN sync-calendar on own calendar → 200; on another host\'s calendar → 403, no fetch, no writes', async () => {
  const h = harness();
  assert.equal((await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'))).status, 200);
  const connects = h.net.connects.length;
  const before = snapshot(h);
  const r = await post(h, { action: 'sync-calendar', calendar_id: 'cal-b', host_email: HOST_B }, as('tok-host-a'));
  assert.deepEqual([r.status, r.body], [403, { error: 'Forbidden' }]);
  assert.equal(h.net.connects.length, connects);
  assert.equal(snapshot(h), before);
});

test('OWN calendar row forged with my email but on another host\'s property → 403 (property ownership decides)', async () => {
  const h = harness();
  const before = snapshot(h);
  for (const action of ['sync-calendar', 'remove-calendar']) {
    assert.equal((await post(h, { action, calendar_id: 'cal-forged' }, as('tok-host-a'))).status, 403, action);
  }
  assert.equal(snapshot(h), before);
  assert.equal(h.net.connects.length, 0);
});

test('OWN sync-all on another host\'s property → 403, no fetch, no writes', async () => {
  const h = harness();
  const before = snapshot(h);
  const r = await post(h, { action: 'sync-all', property_id: 'prop-b', host_email: HOST_B }, as('tok-host-a'));
  assert.deepEqual([r.status, r.body], [403, { error: 'Forbidden' }]);
  assert.equal(h.net.connects.length, 0);
  assert.equal(snapshot(h), before);
});

test('OWN body host_email differing from the session is ignored in both directions', async () => {
  const h = harness();
  // Victim's email in the body does not grant access to the victim's property.
  assert.equal((await post(h, { action: 'sync-all', property_id: 'prop-b', host_email: HOST_B }, as('tok-host-a'))).status, 403);
  // A wrong email in the body does not block the real owner.
  assert.equal((await post(h, { action: 'sync-all', property_id: 'prop-a', host_email: HOST_B }, as('tok-host-a'))).status, 200);
  // Stored identity is the verified one.
  await post(h, { action: 'add-calendar', property_id: 'prop-a', platform: 'airbnb', ical_url: 'https://new.calendar.test/z.ics', host_email: 'attacker@example.test' }, as('tok-host-a'));
  const added = h.db.rows('external_calendars').at(-1) as Row;
  assert.equal(added.host_email, HOST_A);
  // Email comparison is case-insensitive for the owner.
  assert.equal((await post(h, { action: 'sync-all', property_id: 'prop-a' }, as('tok-host-a-upper'))).status, 200);
});

test('OWN remove-calendar for another host\'s calendar → 403 and NO deletion of calendar or blocks', async () => {
  const h = harness();
  const blocksBefore = h.db.rows('ical_blocked_dates').length;
  const calsBefore = h.db.rows('external_calendars').length;
  const r = await post(h, { action: 'remove-calendar', calendar_id: 'cal-b', host_email: HOST_B }, as('tok-host-a'));
  assert.deepEqual([r.status, r.body], [403, { error: 'Forbidden' }]);
  assert.equal(h.db.rows('ical_blocked_dates').length, blocksBefore);
  assert.equal(h.db.rows('external_calendars').length, calsBefore);
  assert.equal(h.db.writes.filter((w) => w.op === 'delete').length, 0, 'no delete statement issued at all');
  // Unknown calendar id: also nothing deleted.
  assert.equal((await post(h, { action: 'remove-calendar', calendar_id: 'nope' }, as('tok-host-a'))).status, 404);
  assert.equal(h.db.writes.filter((w) => w.op === 'delete').length, 0);
});

test('OWN missing property / calendar, malformed ids → generic 404/400', async () => {
  const h = harness();
  assert.deepEqual((await post(h, { action: 'sync-all', property_id: 'missing' }, as('tok-host-a'))).body, { error: 'Property not found' });
  assert.equal((await post(h, { action: 'sync-calendar', calendar_id: 'missing' }, as('tok-host-a'))).status, 404);
  assert.equal((await post(h, { action: 'sync-all', property_id: "prop-a' or 1=1" }, as('tok-host-a'))).status, 400);
  assert.equal((await post(h, { action: 'remove-calendar' }, as('tok-host-a'))).status, 400);
});

// ─── Legacy ───────────────────────────────────────────────────────────────────

test('LEGACY save-url / import / refresh are rejected, with or without auth, with no side effects', async () => {
  const h = harness();
  const before = snapshot(h);
  for (const action of ['save-url', 'import', 'refresh']) {
    for (const headers of [{}, as('tok-host-a')]) {
      const r = await post(h, { action, property_id: 'prop-b', host_email: HOST_B, ical_url: 'https://new.calendar.test/evil.ics' }, headers);
      assert.deepEqual([r.status, r.body], [400, { error: 'Unsupported action' }], action);
    }
  }
  for (const action of ['', 'unknown', 42]) assert.equal((await post(h, { action }, as('tok-host-a'))).status, 400);
  assert.equal(snapshot(h), before);
  assert.equal(h.net.connects.length, 0);
});

// ─── SSRF ─────────────────────────────────────────────────────────────────────

const addWith = (h: H, url: string) => post(h, { action: 'add-calendar', property_id: 'prop-a', platform: 'airbnb', ical_url: url }, as('tok-host-a'));

test('SSRF localhost, loopback, private, link-local, reserved and non-https URLs are rejected at add time', async () => {
  const h = harness();
  const bad = [
    'https://localhost/x.ics', 'https://foo.localhost/x.ics', 'https://127.0.0.1/x.ics', 'https://127.1.2.3/x.ics',
    'https://10.1.2.3/x.ics', 'https://172.16.0.1/x.ics', 'https://172.31.255.255/x.ics', 'https://192.168.1.10/x.ics',
    'https://169.254.169.254/latest/meta-data', 'https://100.64.0.1/x.ics', 'https://0.0.0.0/x.ics',
    'https://224.0.0.1/x.ics', 'https://240.0.0.1/x.ics', 'https://255.255.255.255/x.ics', 'https://198.18.0.1/x.ics',
    'https://[::1]/x.ics', 'https://[fe80::1]/x.ics', 'https://[fc00::1]/x.ics', 'https://[fd12:3456::1]/x.ics',
    'https://[::ffff:127.0.0.1]/x.ics', 'https://[::ffff:10.0.0.1]/x.ics', 'https://[ff02::1]/x.ics', 'https://[64:ff9b::a00:1]/x.ics',
    'http://www.airbnb.test/x.ics', 'file:///etc/passwd', 'ftp://www.airbnb.test/x', 'gopher://x', 'javascript:alert(1)',
    'https://user:pass@www.airbnb.test/x.ics', 'https://www.airbnb.test:8443/x.ics', 'https://metadata.google.internal/x',
    'https://printer.local/x.ics', 'https://intranet/x.ics', 'https://2130706433/x.ics', 'https://0x7f000001/x.ics',
    'not a url', '', 'https://' + 'a'.repeat(2100) + '.test/',
  ];
  for (const url of bad) {
    const r = await addWith(h, url);
    assert.deepEqual([r.status, r.body], [400, { error: 'Invalid calendar URL.' }], url);
  }
  assert.equal(h.net.connects.length, 0);
  assert.equal(h.db.rows('external_calendars').length, 3);
});

test('SSRF hostname resolving to a private address is rejected (A, AAAA, and mixed answers)', async () => {
  const h = harness();
  h.net.dns['rebind.evil.test'] = { A: ['10.0.0.5'] };
  h.net.dns['v6.evil.test'] = { AAAA: ['fd00::1'] };
  h.net.dns['mixed.evil.test'] = { A: ['93.184.216.34', '127.0.0.1'] };
  h.net.dns['meta.evil.test'] = { A: ['169.254.169.254'] };
  for (const host of ['rebind.evil.test', 'v6.evil.test', 'mixed.evil.test', 'meta.evil.test', 'nxdomain.evil.test']) {
    assert.equal((await addWith(h, `https://${host}/x.ics`)).status, 400, host);
  }
  assert.equal(h.net.connects.length, 0);
});

test('SSRF stored calendar whose DNS now points to a private address is not fetched at sync time', async () => {
  const h = harness();
  h.net.dns['www.airbnb.test'] = { A: ['192.168.0.10'] };
  const r = await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
  assert.deepEqual([r.status, r.body], [502, { success: false, error: 'Could not fetch the calendar' }]);
  assert.equal(h.net.connects.length, 0);
  assert.equal(h.db.rows('external_calendars').find((c) => c.id === 'cal-a')?.sync_error, 'blocked_address');
});

test('SSRF connection is pinned to the vetted IP with TLS verified for the original hostname', async () => {
  const h = harness();
  await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
  assert.deepEqual(h.net.connects, [{ ip: '93.184.216.34', port: 443, serverName: 'www.airbnb.test' }]);
  assert.match(h.net.requests[0], /^GET \/calendar\/ical\/1\.ics\?s=secret-ical-token-abc123 HTTP\/1\.1\r\nHost: www\.airbnb\.test\r\n/);
  assert.match(h.net.requests[0], /Connection: close/);
});

test('SSRF redirects (including to private addresses) are never followed', async () => {
  const h = harness();
  h.net.servers['93.184.216.34'] = { response: http(302, '', { Location: 'https://169.254.169.254/latest/meta-data' }) };
  const r = await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
  assert.equal(r.status, 502);
  assert.equal(h.net.connects.length, 1, 'no second connection');
  assert.equal(h.db.rows('ical_blocked_dates').filter((b) => b.calendar_id === 'cal-a').length, 1, 'existing blocks untouched');
  for (const code of [301, 303, 307, 308]) {
    const net = new FakeNet();
    net.dns['x.test'] = { A: ['93.184.216.34'] };
    net.servers['93.184.216.34'] = { response: http(code, '', { Location: 'https://127.0.0.1/' }) };
    const res = await safeFetchCalendar('https://x.test/c.ics', net.deps());
    assert.deepEqual(res, { ok: false, reason: 'redirect' }, String(code));
    assert.equal(net.connects.length, 1);
  }
});

test('SSRF timeout: a hanging server is abandoned after the deadline', { timeout: 2000 }, async () => {
  const h = harness({ timeoutMs: 50 });
  h.net.servers['93.184.216.34'] = { hang: true };
  const started = Date.now();
  const r = await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
  assert.equal(r.status, 502);
  assert.ok(Date.now() - started < 1000);
  assert.equal(h.db.rows('external_calendars').find((c) => c.id === 'cal-a')?.sync_error, 'timeout');
});

test('SSRF oversized responses are rejected (declared length and streamed body)', async () => {
  const net = new FakeNet();
  net.dns['x.test'] = { A: ['93.184.216.34'] };
  net.servers['93.184.216.34'] = { response: http(200, 'x'.repeat(10), { 'Content-Length': String(10_000_000) }) };
  assert.deepEqual(await safeFetchCalendar('https://x.test/c.ics', net.deps({ maxBytes: 1024 })), { ok: false, reason: 'too_large' });
  const net2 = new FakeNet();
  net2.dns['x.test'] = { A: ['93.184.216.34'] };
  net2.servers['93.184.216.34'] = { response: `HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n${'4000\r\n' + 'x'.repeat(0x4000) + '\r\n'}`.repeat(1) + 'x'.repeat(200_000), chunkSize: 4096 };
  assert.deepEqual(await safeFetchCalendar('https://x.test/c.ics', net2.deps({ maxBytes: 8 * 1024 })), { ok: false, reason: 'too_large' });
});

test('SSRF non-2xx, compressed, malformed and connection failures are generic failures', async () => {
  const cases: [Behaviour, string][] = [
    [{ response: http(500, 'err') }, 'http_error'],
    [{ response: http(200, ICS_OK, { 'Content-Encoding': 'gzip' }) }, 'bad_response'],
    [{ response: 'garbage without headers' }, 'bad_response'],
    [{ failConnect: true }, 'connect_failed'],
  ];
  for (const [b, reason] of cases) {
    const net = new FakeNet();
    net.dns['x.test'] = { A: ['93.184.216.34'] };
    net.servers['93.184.216.34'] = b;
    assert.deepEqual(await safeFetchCalendar('https://x.test/c.ics', net.deps()), { ok: false, reason });
  }
});

test('SSRF chunked responses and small reads are decoded correctly', async () => {
  const net = new FakeNet();
  net.dns['x.test'] = { A: ['93.184.216.34'] };
  const parts = [ICS_OK.slice(0, 50), ICS_OK.slice(50)];
  const chunked = parts.map((p) => `${new TextEncoder().encode(p).length.toString(16)}\r\n${p}\r\n`).join('') + '0\r\n\r\n';
  net.servers['93.184.216.34'] = { response: `HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n${chunked}`, chunkSize: 7 };
  assert.deepEqual(await safeFetchCalendar('https://x.test/c.ics', net.deps()), { ok: true, text: ICS_OK });
});

test('SSRF address helpers', () => {
  for (const ip of ['8.8.8.8', '93.184.216.34', '1.1.1.1']) assert.equal(isPublicIPv4(ip), true, ip);
  for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.1.1', '172.20.0.1', '192.168.0.1', '100.100.0.1', '0.1.2.3', '224.1.1.1', '192.0.2.1', '203.0.113.9', '999.1.1.1']) assert.equal(isPublicIPv4(ip), false, ip);
  for (const ip of ['2606:4700::6810:101', '2a00:1450:4001::200e']) assert.equal(isPublicIPv6(ip), true, ip);
  for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd00::1', 'ff02::1', '2001:db8::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1', '64:ff9b::1', '2002::1', 'fe80::1%eth0', '100::1']) assert.equal(isPublicIPv6(ip), false, ip);
  assert.equal(isPublicIPv6('::ffff:8.8.8.8'), true);
  assert.equal(checkCalendarUrl('https://www.airbnb.test/x.ics').ok, true);
  // Static policy alone (before any DNS) refuses local/internal names.
  for (const u of ['https://localhost/x', 'https://LOCALHOST./x', 'https://a.localhost/x', 'https://svc.internal/x', 'https://nas.local/x', 'https://router/x', 'https://x.home.arpa/x']) {
    assert.deepEqual(checkCalendarUrl(u), { ok: false, reason: 'blocked_host' }, u);
  }
});

// ─── Privacy ──────────────────────────────────────────────────────────────────

test('PRIVACY raw fetch errors, internal addresses and DB errors are never returned', async () => {
  const h = harness();
  h.net.servers['93.184.216.34'] = { failConnect: true };
  const r1 = await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
  assert.deepEqual(r1.body, { success: false, error: 'Could not fetch the calendar' });
  assert.ok(!/refused|93\.184|:443/.test(r1.text));
  h.db.failWhen = (t, op) => t === 'property_applications' && op === 'select';
  const r2 = await post(h, { action: 'sync-all', property_id: 'prop-a' }, as('tok-host-a'));
  assert.deepEqual([r2.status, r2.body], [500, { error: 'Request failed' }]);
  h.net.servers['93.184.216.34'] = { response: http(200, ICS_OK) };
  h.db.failWhen = (t, op) => t === 'ical_blocked_dates' && op === 'insert';
  const r3 = await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
  assert.deepEqual(r3.body, { success: false, error: 'Could not update the calendar' });
  for (const r of [r1, r2, r3]) assert.ok(!/secret_internal_table|10\.0\.0\.5|relation/.test(r.text));
});

test('PRIVACY iCal URLs, host emails and guest summaries are not returned; logs are ids/categories only', async () => {
  const h = harness();
  const add = await addWith(h, `https://new.calendar.test/cal.ics?token=${PRIVATE_URL_TOKEN}`);
  assert.equal(add.status, 200);
  assert.deepEqual(Object.keys(add.body.calendar).sort(), ['created_at', 'id', 'label', 'platform', 'property_id', 'sync_status']);
  const sync = await post(h, { action: 'sync-all', property_id: 'prop-a' }, as('tok-host-a'));
  h.net.servers['93.184.216.34'] = { failConnect: true };
  const fail = await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
  const blob = add.text + sync.text + fail.text + JSON.stringify(h.logs);
  for (const v of [PRIVATE_URL_TOKEN, 'airbnb.test/calendar', HOST_A, GUEST, 'Reserved', 'Not available']) assert.ok(!blob.includes(v), `leaked ${v}`);
  assert.equal(h.db.rows('external_calendars').find((c) => c.id === 'cal-a')?.sync_error, 'connect_failed', 'stored error is a category');
});

// ─── Regression ───────────────────────────────────────────────────────────────

test('REG add-calendar stores the calendar for the verified owner', async () => {
  const h = harness();
  const r = await post(h, { action: 'add-calendar', property_id: 'prop-a', platform: 'booking_com', label: 'Main', ical_url: 'https://new.calendar.test/main.ics' }, as('tok-host-a'));
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  const row = h.db.rows('external_calendars').at(-1) as Row;
  assert.deepEqual([row.property_id, row.host_email, row.platform, row.label, row.ical_url, row.sync_status], ['prop-a', HOST_A, 'booking_com', 'Main', 'https://new.calendar.test/main.ics', 'pending']);
});

test('REG sync-calendar replaces this calendar\'s future blocks and marks it synced', async () => {
  const h = harness();
  const r = await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
  assert.deepEqual([r.status, r.body.success, r.body.imported, r.body.total_parsed], [200, true, 2, 3]);
  assert.equal(r.body.message, 'Synced 2 blocked period(s) from airbnb');
  const blocks = h.db.rows('ical_blocked_dates').filter((b) => b.calendar_id === 'cal-a');
  assert.deepEqual(blocks.map((b) => [b.start_date, b.end_date, b.property_id, b.host_email, b.platform]).sort(), [['2027-01-10', '2027-01-13', 'prop-a', HOST_A, 'airbnb'], ['2027-02-01', '2027-02-03', 'prop-a', HOST_A, 'airbnb']]);
  assert.equal(h.db.rows('ical_blocked_dates').filter((b) => b.calendar_id === 'cal-b').length, 1, 'other property untouched');
  assert.equal(h.db.rows('external_calendars').find((c) => c.id === 'cal-a')?.sync_status, 'synced');
});

test('REG sync-all syncs every calendar of the owned property and reports totals', async () => {
  const h = harness();
  h.db.rows('external_calendars').push({ id: 'cal-a2', property_id: 'prop-a', host_email: HOST_A, platform: 'booking_com', ical_url: 'https://admin.booking.test/a2.ics', sync_status: 'pending' });
  const r = await post(h, { action: 'sync-all', property_id: 'prop-a' }, as('tok-host-a'));
  assert.deepEqual([r.status, r.body.success, r.body.synced, r.body.total_imported], [200, true, 2, 4]);
  assert.equal(h.net.connects.length, 2);
  assert.deepEqual(r.body.results.map((x: Row) => [x.calendar_id, x.success]), [['cal-a', true], ['cal-a2', true]]);
  const none = harness();
  none.db.tables.external_calendars = [];
  assert.deepEqual((await post(none, { action: 'sync-all', property_id: 'prop-a' }, as('tok-host-a'))).body, { success: true, message: 'No calendars to sync', synced: 0 });
});

test('REG remove-calendar deletes the owned calendar and only its blocks', async () => {
  const h = harness();
  // A block that claims cal-a but belongs to another property must survive.
  h.db.rows('ical_blocked_dates').push({ id: 'blk-mismatch', property_id: 'prop-b', calendar_id: 'cal-a', start_date: '2027-09-01', end_date: '2027-09-02' });
  const r = await post(h, { action: 'remove-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
  assert.deepEqual([r.status, r.body], [200, { success: true }]);
  assert.equal(h.db.rows('external_calendars').some((c) => c.id === 'cal-a'), false);
  assert.equal(h.db.rows('ical_blocked_dates').some((b) => b.calendar_id === 'cal-a' && b.property_id === 'prop-a'), false);
  assert.equal(h.db.rows('ical_blocked_dates').some((b) => b.id === 'blk-mismatch'), true, 'cross-property row untouched');
  assert.equal(h.db.rows('ical_blocked_dates').some((b) => b.calendar_id === 'cal-b'), true);
});

test('REG export behaviour unchanged: public GET, bookings + manual blocks, same headers', async () => {
  const h = harness();
  const res = await h.handler(new Request('https://fn.local/functions/v1/ical-sync?action=export&property_id=prop-a'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/calendar; charset=utf-8');
  assert.equal(res.headers.get('content-disposition'), 'attachment; filename="rentcottage-prop-a.ics"');
  const ics = await res.text();
  assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nPRODID:-\/\/RentCottage\.Ge\/\/Booking Calendar\/\/EN/);
  assert.match(ics, /X-WR-CALNAME:Alpha Cottage - RentCottage\.Ge/);
  assert.match(ics, /UID:rentcottage-booking-bk-1@rentcottage\.ge/);
  assert.ok(!ics.includes('bk-2'), 'cancelled booking excluded');
  assert.match(ics, /UID:rentcottage-block-bd-1@rentcottage\.ge/);
  assert.ok(!ics.includes('guest@example.test'));
  const missing = await h.handler(new Request('https://fn.local/functions/v1/ical-sync?action=export&property_id=nope'));
  assert.deepEqual([missing.status, await missing.text()], [404, 'Property not found']);
  const opt = await h.handler(new Request('https://fn.local/', { method: 'OPTIONS' }));
  assert.equal(opt.status, 200);
  assert.equal((await h.handler(new Request('https://fn.local/', { method: 'PUT' }))).status, 405);
});

// ─── Non-iCalendar bodies never wipe blocks ───────────────────────────────────

const deletes = (h: H) => h.db.writes.filter((w) => w.table === 'ical_blocked_dates' && (w.op === 'delete' || w.op === 'insert'));

test('GUARD 200 responses that are not a complete VCALENDAR (HTML, empty, truncated) → no delete, blocks kept, bad_response', async () => {
  const bodies: [string, string][] = [
    ['html', '<!DOCTYPE html><html><body>Sign in</body></html>'],
    ['empty', ''],
    ['whitespace', ' \r\n\t'],
    ['truncated', ICS_OK.slice(0, ICS_OK.indexOf('END:VCALENDAR'))],
    ['json problem', '{"title":"Bad Request","status":400}'],
  ];
  for (const [label, body] of bodies) {
    const h = harness();
    h.net.servers['93.184.216.34'] = { response: http(200, body, { 'Content-Type': label === 'html' ? 'text/html' : 'text/calendar' }) };
    const r = await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
    assert.deepEqual([r.status, r.body], [502, { success: false, error: 'Could not fetch the calendar' }], label);
    assert.deepEqual(deletes(h), [], `${label}: no delete or insert`);
    assert.deepEqual(h.db.rows('ical_blocked_dates').filter((b) => b.calendar_id === 'cal-a').map((b) => b.id), ['blk-a1'], `${label}: blocks kept`);
    const cal = h.db.rows('external_calendars').find((c) => c.id === 'cal-a');
    assert.deepEqual([cal?.sync_status, cal?.sync_error], ['error', 'bad_response'], label);
  }
});

test('GUARD valid calendar with zero future events (also with BOM/leading whitespace) clears blocks and inserts 0', async () => {
  const empty = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'END:VCALENDAR'].join('\r\n');
  const pastOnly = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:p', 'DTSTART;VALUE=DATE:20250101', 'DTEND;VALUE=DATE:20250102', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  for (const body of [empty, String.fromCharCode(0xfeff) + '\r\n  ' + empty, pastOnly]) {
    const h = harness();
    h.net.servers['93.184.216.34'] = { response: http(200, body) };
    const r = await post(h, { action: 'sync-calendar', calendar_id: 'cal-a' }, as('tok-host-a'));
    assert.deepEqual([r.status, r.body.success, r.body.imported], [200, true, 0]);
    assert.equal(h.db.writes.filter((w) => w.table === 'ical_blocked_dates' && w.op === 'delete').length, 1);
    assert.equal(h.db.writes.filter((w) => w.table === 'ical_blocked_dates' && w.op === 'insert').length, 0);
    assert.equal(h.db.rows('ical_blocked_dates').filter((b) => b.calendar_id === 'cal-a').length, 0);
    assert.equal(h.db.rows('external_calendars').find((c) => c.id === 'cal-a')?.sync_status, 'synced');
  }
});

test('GUARD sync-all: a bad feed keeps its blocks while a valid feed on the same property syncs', async () => {
  const h = harness();
  h.db.rows('external_calendars').push({ id: 'cal-a2', property_id: 'prop-a', host_email: HOST_A, platform: 'booking_com', ical_url: 'https://admin.booking.test/a2.ics', sync_status: 'synced' });
  h.db.rows('ical_blocked_dates').push({ id: 'blk-a2', property_id: 'prop-a', calendar_id: 'cal-a2', start_date: '2027-08-01', end_date: '2027-08-03', summary: GUEST, host_email: HOST_A });
  h.net.servers['151.101.1.1'] = { response: http(200, '<html>error</html>', { 'Content-Type': 'text/html' }) };
  const r = await post(h, { action: 'sync-all', property_id: 'prop-a' }, as('tok-host-a'));
  assert.deepEqual([r.status, r.body.success, r.body.synced, r.body.total_imported], [200, true, 2, 2]);
  assert.deepEqual(r.body.results.map((x: Row) => [x.calendar_id, x.success, x.error ?? null]), [['cal-a', true, null], ['cal-a2', false, 'Could not fetch the calendar']]);
  assert.deepEqual(h.db.rows('ical_blocked_dates').filter((b) => b.calendar_id === 'cal-a2').map((b) => b.id), ['blk-a2'], 'bad feed blocks kept');
  assert.equal(h.db.rows('ical_blocked_dates').filter((b) => b.calendar_id === 'cal-a').length, 2, 'valid feed synced');
  const a2 = h.db.rows('external_calendars').find((c) => c.id === 'cal-a2');
  assert.deepEqual([a2?.sync_status, a2?.sync_error], ['error', 'bad_response']);
  assert.equal(h.db.writes.filter((w) => w.table === 'ical_blocked_dates' && w.op === 'delete').length, 1, 'only the valid feed deleted');
});

test('GUARD isICalendarBody helper', () => {
  assert.equal(isICalendarBody(ICS_OK), true);
  assert.equal(isICalendarBody(String.fromCharCode(0xfeff) + ' \r\n' + ICS_OK), true);
  for (const bad of ['', '   ', '<html>BEGIN:VCALENDAR END:VCALENDAR</html>', 'BEGIN:VCALENDAR\r\nVERSION:2.0', 'END:VCALENDAR', 'X' + ICS_OK]) {
    assert.equal(isICalendarBody(bad), false, JSON.stringify(bad.slice(0, 20)));
  }
});
