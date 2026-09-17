// Security-boundary tests for ical-export (public OTA availability feed).
//
// Run (Node >= 22.18 / 24, built-in TypeScript type stripping):
//   node --test supabase/functions/ical-export/handler.test.ts
//
// Supabase is faked in memory. No network, no secrets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExportHandler, isEligibleProperty, tokenFromPath, TOKEN_RE } from './handler.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ─── Fake Supabase (select-only) ──────────────────────────────────────────────

class FakeDb {
  tables: Record<string, Row[]>;
  calls: string[] = [];
  failWhen: (table: string) => boolean = () => false;
  constructor(tables: Record<string, Row[]>) { this.tables = tables; }
  from(table: string) { this.calls.push(table); return new FakeQuery(this, table); }
}

class FakeQuery {
  private filters: ((r: Row) => boolean)[] = [];
  private single = false;
  private db: FakeDb;
  private table: string;
  constructor(db: FakeDb, table: string) { this.db = db; this.table = table; }
  select(_c?: string) { return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] != null && String(r[c]) === String(v)); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.some((v) => String(r[c]) === String(v))); return this; }
  gt(c: string, v: string) { this.filters.push((r) => String(r[c]) > v); return this; }
  gte(c: string, v: string) { this.filters.push((r) => String(r[c]) >= v); return this; }
  order() { return this; }
  maybeSingle() { this.single = true; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(resolve: (v: any) => void, reject: (e: unknown) => void) {
    Promise.resolve().then(() => {
      try {
        if (this.db.failWhen(this.table)) return resolve({ data: null, error: { message: 'relation "secret_internal_table" does not exist; host=10.0.0.5' } });
        const out = (this.db.tables[this.table] ?? []).filter((r) => this.filters.every((f) => f(r))).map((r) => ({ ...r }));
        resolve({ data: this.single ? (out[0] ?? null) : out, error: null });
      } catch (e) { reject(e); }
    });
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TODAY = '2026-09-17';
const TOKEN_A = 'Ab3_xY9-Qw7eRt5yUi1oPa2sDf4gHj6kLz8xCv0bNm1';
const TOKEN_HIDDEN = 'Hd3_xY9-Qw7eRt5yUi1oPa2sDf4gHj6kLz8xCv0bNm1';
const TOKEN_PENDING = 'Pn3_xY9-Qw7eRt5yUi1oPa2sDf4gHj6kLz8xCv0bNm1';
const TOKEN_REJECTED = 'Rj3_xY9-Qw7eRt5yUi1oPa2sDf4gHj6kLz8xCv0bNm1';
const TOKEN_ORPHAN = 'Or3_xY9-Qw7eRt5yUi1oPa2sDf4gHj6kLz8xCv0bNm1';
const TOKEN_UNKNOWN = 'Uk3_xY9-Qw7eRt5yUi1oPa2sDf4gHj6kLz8xCv0bNm1';
const PROP_A = '11111111-1111-4111-8111-111111111111';
const PROP_B = '22222222-2222-4222-8222-222222222222';
const TITLE = 'Secret Alpha Cottage';
const GUEST_EMAIL = 'guest.private@example.test';
const GUEST_NAME = 'Private Guest Name';
const HOST_EMAIL = 'host.private@example.test';

function tables(): Record<string, Row[]> {
  return {
    ical_export_tokens: [
      { property_id: PROP_A, token: TOKEN_A },
      { property_id: 'prop-hidden', token: TOKEN_HIDDEN },
      { property_id: 'prop-pending', token: TOKEN_PENDING },
      { property_id: 'prop-rejected', token: TOKEN_REJECTED },
      { property_id: 'prop-deleted', token: TOKEN_ORPHAN },
    ],
    property_applications: [
      { id: PROP_A, status: 'approved', title: TITLE, host_email: HOST_EMAIL },
      { id: PROP_B, status: 'approved', title: 'Beta', host_email: 'b@example.test' },
      { id: 'prop-hidden', status: 'hidden', title: 'Hidden', host_email: HOST_EMAIL },
      { id: 'prop-pending', status: 'pending', title: 'Pending', host_email: HOST_EMAIL },
      { id: 'prop-rejected', status: 'rejected', title: 'Rejected', host_email: HOST_EMAIL },
    ],
    bookings: [
      b('bk-confirmed', PROP_A, '2026-10-01', '2026-10-04', 'confirmed'),
      b('bk-pending', PROP_A, '2026-10-10', '2026-10-12', 'pending'),
      b('bk-pha', PROP_A, '2026-11-01', '2026-11-02', 'pending_host_approval'),
      b('bk-ongoing', PROP_A, '2026-09-15', '2026-09-19', 'confirmed'),
      b('bk-departs-today', PROP_A, '2026-09-14', TODAY, 'confirmed'),
      b('bk-past', PROP_A, '2026-08-01', '2026-08-05', 'confirmed'),
      b('bk-pp', PROP_A, '2026-12-01', '2026-12-03', 'pending_payment'),
      b('bk-cancelled', PROP_A, '2026-12-05', '2026-12-07', 'cancelled'),
      b('bk-cbh', PROP_A, '2026-12-08', '2026-12-09', 'cancelled_by_host'),
      b('bk-rejected', PROP_A, '2026-12-10', '2026-12-11', 'rejected'),
      b('bk-failed', PROP_A, '2026-12-12', '2026-12-13', 'payment_failed'),
      b('bk-other-prop', PROP_B, '2026-10-20', '2026-10-22', 'confirmed'),
      b('bk-hidden', 'prop-hidden', '2026-10-05', '2026-10-07', 'confirmed'),
    ],
    blocked_dates: [
      { id: 'bd-future', property_id: PROP_A, start_date: '2026-10-20', end_date: '2026-10-22', reason: 'Private family visit', host_email: HOST_EMAIL },
      { id: 'bd-single', property_id: PROP_A, start_date: '2026-10-25', end_date: '2026-10-25', reason: null },
      { id: 'bd-ends-today', property_id: PROP_A, start_date: '2026-09-10', end_date: TODAY, reason: null },
      { id: 'bd-past', property_id: PROP_A, start_date: '2026-09-01', end_date: '2026-09-16', reason: null },
      { id: 'bd-month-end', property_id: PROP_A, start_date: '2027-02-27', end_date: '2027-02-28', reason: null },
      { id: 'bd-other-prop', property_id: PROP_B, start_date: '2026-10-01', end_date: '2026-10-02', reason: null },
    ],
    ical_blocked_dates: [
      { id: 'ical-1', property_id: PROP_A, calendar_id: 'cal-1', start_date: '2026-10-15', end_date: '2026-10-18', summary: 'Airbnb (Not available)', uid: 'airbnb-uid-1', platform: 'airbnb', host_email: HOST_EMAIL },
    ],
  };
}

function b(id: string, property_id: string, check_in: string, check_out: string, status: string): Row {
  return { id, property_id, check_in, check_out, status, user_email: GUEST_EMAIL, user_name: GUEST_NAME, property_title: TITLE };
}

interface H { db: FakeDb; logs: { event: string; fields?: Row }[]; handler: (r: Request) => Promise<Response> }

function harness(): H {
  const db = new FakeDb(tables());
  const logs: H['logs'] = [];
  const handler = createExportHandler({ db, now: () => new Date(`${TODAY}T10:00:00Z`), log: (event, fields) => logs.push({ event, fields }) });
  return { db, logs, handler };
}

const feedUrl = (token: string) => `https://proj.supabase.test/functions/v1/ical-export/${token}.ics`;
const get = (h: H, url: string, method = 'GET') => h.handler(new Request(url, { method }));

function events(ics: string): Row[] {
  return ics.split('BEGIN:VEVENT').slice(1).map((chunk) => {
    const f = (k: string) => new RegExp(`${k}[^:\\r\\n]*:([^\\r\\n]*)`).exec(chunk)?.[1];
    return { uid: f('UID'), start: f('DTSTART'), end: f('DTEND'), summary: f('SUMMARY') };
  });
}

async function notFoundShape(res: Response) {
  return { status: res.status, body: await res.text(), type: res.headers.get('content-type'), cache: res.headers.get('cache-control') };
}

// ─── Valid feed ───────────────────────────────────────────────────────────────

test('FEED valid token → 200 text/calendar with max-age=300 and a complete VCALENDAR', async () => {
  const h = harness();
  const res = await get(h, feedUrl(TOKEN_A));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/calendar; charset=utf-8');
  assert.equal(res.headers.get('cache-control'), 'max-age=300');
  assert.equal(res.headers.get('content-disposition'), 'inline; filename="rentcottage-availability.ics"');
  const ics = await res.text();
  assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nPRODID:-\/\/RentCottage\.Ge\/\/Availability\/\/EN\r\n/);
  assert.match(ics, /\r\nX-WR-CALNAME:RentCottage\.Ge availability\r\n/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/(^|[^\r])\n/.test(ics), 'CRLF line endings only');
});

test('FEED booking statuses: confirmed, pending, pending_host_approval only (same as the occupancy rule); pending_payment and closed statuses excluded', async () => {
  const h = harness();
  const ev = events(await (await get(h, feedUrl(TOKEN_A))).text());
  const reserved = ev.filter((e) => e.summary === 'Reserved').map((e) => `${e.start}-${e.end}`).sort();
  assert.deepEqual(reserved, ['20260915-20260919', '20261001-20261004', '20261010-20261012', '20261101-20261102']);
});

test('DATES booking DTEND = check_out (departure day stays bookable); block DTEND = end_date + 1 (inclusive last day)', async () => {
  const h = harness();
  const ev = events(await (await get(h, feedUrl(TOKEN_A))).text());
  const byStart = Object.fromEntries(ev.map((e) => [e.start, e]));
  assert.deepEqual([byStart['20261001'].end, byStart['20261001'].summary], ['20261004', 'Reserved']);           // 3 nights: 1,2,3
  assert.deepEqual([byStart['20261101'].end, byStart['20261101'].summary], ['20261102', 'Reserved']);           // 1 night
  assert.deepEqual([byStart['20261020'].end, byStart['20261020'].summary], ['20261023', 'Not available']);      // 20,21,22
  assert.deepEqual([byStart['20261025'].end, byStart['20261025'].summary], ['20261026', 'Not available']);      // single day
  assert.deepEqual([byStart['20260910'].end, byStart['20260910'].summary], ['20260918', 'Not available']);      // ends today
  assert.equal(byStart['20270227'].end, '20270301');                                                             // month rollover
});

test('FUTURE only: past bookings, bookings departing today and past blocks are omitted; ongoing ones kept', async () => {
  const h = harness();
  const ics = await (await get(h, feedUrl(TOKEN_A))).text();
  const starts = events(ics).map((e) => e.start);
  assert.ok(starts.includes('20260915'), 'ongoing booking');
  assert.ok(starts.includes('20260910'), 'block ending today');
  assert.ok(!starts.includes('20260914'), 'booking departing today');
  assert.ok(!starts.includes('20260801'), 'past booking');
  assert.ok(!starts.includes('20260901'), 'past block');
  assert.equal(events(ics).length, 8);   // 4 bookings + 4 blocks
});

test('IMPORTED OTA blocks (ical_blocked_dates) are never exported, and other properties never leak in', async () => {
  const h = harness();
  const ics = await (await get(h, feedUrl(TOKEN_A))).text();
  const starts = events(ics).map((e) => e.start);
  assert.ok(!starts.includes('20261015'), 'imported block');
  assert.ok(!ics.includes('airbnb') && !ics.includes('Airbnb'));
  assert.ok(!h.db.calls.includes('ical_blocked_dates'));
  const keys = events(ics).map((e) => `${e.start}-${e.end}-${e.summary}`);
  assert.ok(!keys.includes('20261020-20261022-Reserved'), 'other property booking not added');
  assert.ok(!keys.includes('20261001-20261003-Not available'), 'other property block not added');
});

test('PRIVACY no property id, title, booking/block ids, guest or host data, reasons; UIDs are opaque hashes', async () => {
  const h = harness();
  const res = await get(h, feedUrl(TOKEN_A));
  const ics = await res.text();
  const everything = ics + JSON.stringify([...res.headers]);
  for (const secret of [PROP_A, TITLE, GUEST_EMAIL, GUEST_NAME, HOST_EMAIL, 'Private family visit', 'bk-confirmed', 'bd-future', 'rentcottage-booking', 'rentcottage-block', TOKEN_A, 'DESCRIPTION']) {
    assert.ok(!everything.includes(secret), `leaked: ${secret.slice(0, 12)}`);
  }
  const ev = events(ics);
  for (const e of ev) {
    assert.match(e.uid, /^[0-9a-f]{32}@rentcottage\.ge$/);
    assert.ok(['Reserved', 'Not available'].includes(e.summary));
  }
  assert.equal(new Set(ev.map((e) => e.uid)).size, ev.length, 'unique UIDs');
  const again = events(await (await get(harness(), feedUrl(TOKEN_A))).text());
  assert.deepEqual(again.map((e) => e.uid).sort(), ev.map((e) => e.uid).sort(), 'UIDs stable across polls');
  assert.ok(!JSON.stringify(h.logs).includes(TOKEN_A), 'token never logged');
});

// ─── Token handling ───────────────────────────────────────────────────────────

test('404 identical for malformed, unknown, rotated and ineligible tokens; malformed tokens never reach the database', async () => {
  const h = harness();
  const reference = await notFoundShape(await get(h, feedUrl(TOKEN_UNKNOWN)));
  assert.deepEqual(reference, { status: 404, body: 'Not found', type: 'text/plain; charset=utf-8', cache: 'no-store' });

  const malformed = [
    'https://p.test/functions/v1/ical-export/',
    'https://p.test/functions/v1/ical-export/.ics',
    `https://p.test/functions/v1/ical-export/${TOKEN_A.slice(0, 42)}.ics`,
    `https://p.test/functions/v1/ical-export/${TOKEN_A}x.ics`,
    `https://p.test/functions/v1/ical-export/${TOKEN_A.slice(0, 42)}=.ics`,
    `https://p.test/functions/v1/ical-export/${TOKEN_A.slice(0, 42)}+.ics`,
    `https://p.test/functions/v1/ical-export/${TOKEN_A.slice(0, 42)}%2F.ics`,
    `https://p.test/functions/v1/ical-export/${TOKEN_A}`,
    `https://p.test/functions/v1/ical-export/${TOKEN_A}.ics/extra`,
    `https://p.test/functions/v1/ical-export/${TOKEN_A}.ICS`,
    `https://p.test/functions/v1/ical-export?token=${TOKEN_A}`,
    `https://p.test/functions/v1/ical-export/%20${TOKEN_A.slice(1)}.ics`,
    `https://p.test/functions/v1/ical-export/' OR 1=1 --xxxxxxxxxxxxxxxxxxxxxxxxxx.ics`,
    `https://p.test/functions/v1/other-function/${TOKEN_A}.ics`,
  ];
  for (const u of malformed) {
    const before = h.db.calls.length;
    assert.deepEqual(await notFoundShape(await get(h, u)), reference, u);
    assert.equal(h.db.calls.length, before, `no DB access for ${u}`);
  }

  for (const t of [TOKEN_UNKNOWN, TOKEN_REJECTED, TOKEN_ORPHAN, TOKEN_A.toLowerCase(), TOKEN_A.toUpperCase()]) {
    assert.deepEqual(await notFoundShape(await get(h, feedUrl(t))), reference, t.slice(0, 3));
  }

  // Rotation: the old token stops working immediately, the new one works.
  const rotated = harness();
  const NEW = 'Nw3_xY9-Qw7eRt5yUi1oPa2sDf4gHj6kLz8xCv0bNm1';
  rotated.db.tables.ical_export_tokens[0].token = NEW;
  assert.deepEqual(await notFoundShape(await get(rotated, feedUrl(TOKEN_A))), reference);
  assert.equal((await get(rotated, feedUrl(NEW))).status, 200);
});

test('ELIGIBILITY hidden (paused) and pending properties still export; rejected and deleted do not', async () => {
  const h = harness();
  const hidden = await get(h, feedUrl(TOKEN_HIDDEN));
  assert.equal(hidden.status, 200);
  assert.deepEqual(events(await hidden.text()).map((e) => [e.start, e.end, e.summary]), [['20261005', '20261007', 'Reserved']]);
  const pending = await get(h, feedUrl(TOKEN_PENDING));
  assert.equal(pending.status, 200);
  assert.deepEqual(events(await pending.text()), []);
  assert.equal((await get(h, feedUrl(TOKEN_REJECTED))).status, 404);
  assert.equal((await get(h, feedUrl(TOKEN_ORPHAN))).status, 404);
  assert.equal(isEligibleProperty({ status: 'approved' }), true);
  assert.equal(isEligibleProperty({ status: 'hidden' }), true);
  assert.equal(isEligibleProperty({ status: 'pending' }), true);
  assert.equal(isEligibleProperty({ status: 'rejected' }), false);
  assert.equal(isEligibleProperty(null), false);
});

test('PATHS the token is read from /ical-export/<token>.ics with or without the /functions/v1 prefix', async () => {
  const h = harness();
  assert.equal((await get(h, `https://p.test/ical-export/${TOKEN_A}.ics`)).status, 200);
  assert.equal((await get(h, `https://p.test/functions/v1/ical-export/${TOKEN_A}.ics?cache=1`)).status, 200);
  assert.equal(tokenFromPath(`/ical-export/${TOKEN_A}.ics`), TOKEN_A);
  assert.equal(tokenFromPath(`/functions/v1/ical-export/${TOKEN_A}.ics`), TOKEN_A);
  assert.equal(tokenFromPath(`/ical-export/${TOKEN_A}`), null);
  assert.equal(tokenFromPath(`/ical-export/${TOKEN_A.slice(1)}.ics`), null);
  assert.match(TOKEN_A, TOKEN_RE);
});

test('METHODS only GET and HEAD; HEAD has headers and no body', async () => {
  const h = harness();
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const res = await get(h, feedUrl(TOKEN_A), m);
    assert.equal(res.status, 405, m);
    assert.equal(res.headers.get('allow'), 'GET, HEAD');
    assert.ok(!(await res.text()).includes('VCALENDAR'));
  }
  const head = await get(h, feedUrl(TOKEN_A), 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'text/calendar; charset=utf-8');
  assert.equal(await head.text(), '');
  assert.equal((await get(h, feedUrl(TOKEN_UNKNOWN), 'HEAD')).status, 404);
});

test('ERRORS database failures → generic retryable 503 (not 404, no internal detail)', async () => {
  for (const table of ['ical_export_tokens', 'property_applications', 'bookings', 'blocked_dates']) {
    const h = harness();
    h.db.failWhen = (t) => t === table;
    const res = await get(h, feedUrl(TOKEN_A));
    const body = await res.text();
    assert.deepEqual([res.status, body, res.headers.get('retry-after')], [503, 'Temporarily unavailable', '300'], table);
    assert.ok(!body.includes('secret_internal_table') && !JSON.stringify(h.logs).includes('secret_internal_table'));
  }
});

test('EMPTY a property with no future bookings or blocks gets a valid empty calendar', async () => {
  const h = harness();
  h.db.tables.bookings = [];
  h.db.tables.blocked_dates = [];
  const res = await get(h, feedUrl(TOKEN_A));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RentCottage.Ge//Availability//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:RentCottage.Ge availability\r\nEND:VCALENDAR\r\n');
});
