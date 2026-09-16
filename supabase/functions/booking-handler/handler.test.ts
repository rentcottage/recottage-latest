// Security + regression tests for booking-handler.
//
// Run (Node >= 22.18 / 24, built-in TypeScript type stripping):
//   node --test supabase/functions/booking-handler/handler.test.ts
//
// Everything is faked in memory: Supabase (query-builder subset), Resend, the
// bog-payment refund call and token verification. No network, no secrets.
// Test numbers (T1–T45) match docs/booking-handler-security-audit.md §13.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, type AuthUser, type HandlerDeps } from './handler.ts';
import { buildHostNewBookingEmailHtml, safeRecord, toHostSafeBooking } from './templates.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ─── Fake Supabase ────────────────────────────────────────────────────────────

class FakeDb {
  tables: Record<string, Row[]>;
  failOn = new Set<string>(); // "table:op"
  writes: { table: string; op: string; payload: Row }[] = [];
  constructor(tables: Record<string, Row[]>) {
    this.tables = tables;
  }
  from(table: string) {
    if (!this.tables[table]) this.tables[table] = [];
    return new FakeQuery(this, table);
  }
  rows(table: string) {
    return this.tables[table] ?? [];
  }
}

class FakeQuery {
  private op: 'select' | 'update' | 'insert' | 'upsert' = 'select';
  private payload: Row | Row[] | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private returning = false;
  private single = false;
  private limitN: number | null = null;
  private conflictKey = 'id';
  private db: FakeDb;
  private table: string;
  constructor(db: FakeDb, table: string) {
    this.db = db;
    this.table = table;
  }

  select(_cols?: string) { if (this.op === 'select') this.op = 'select'; else this.returning = true; return this; }
  update(p: Row) { this.op = 'update'; this.payload = p; return this; }
  insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p: Row, opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.conflictKey = opts?.onConflict ?? 'id'; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => same(r[c], v)); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] != null && !same(r[c], v)); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.some((v) => same(r[c], v))); return this; }
  lt(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) < v); return this; }
  lte(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) <= v); return this; }
  gt(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) > v); return this; }
  gte(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) >= v); return this; }
  not(c: string, op: string, v: unknown) { if (op === 'is' && v === null) this.filters.push((r) => r[c] != null); return this; }
  order() { return this; }
  limit(n: number) { this.limitN = n; return this; }
  maybeSingle() { this.single = true; return this; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(resolve: (v: any) => void, reject: (e: unknown) => void) {
    // Yield first so concurrent requests interleave like real network calls.
    Promise.resolve().then(() => Promise.resolve()).then(() => {
      try { resolve(this.execute()); } catch (e) { reject(e); }
    });
  }

  private execute(): { data: unknown; error: unknown } {
    if (this.db.failOn.has(`${this.table}:${this.op}`)) return { data: null, error: { message: 'simulated failure mentioning secret-host@example.test' } };
    const rows = this.db.tables[this.table];
    const match = () => rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === 'select') {
      let out = match().map((r) => ({ ...r }));
      if (this.limitN != null) out = out.slice(0, this.limitN);
      return { data: this.single ? (out[0] ?? null) : out, error: null };
    }
    if (this.op === 'update') {
      const hit = match();
      for (const r of hit) Object.assign(r, this.payload);
      this.db.writes.push({ table: this.table, op: 'update', payload: { ...(this.payload as Row), __ids: hit.map((r) => r.id) } });
      return { data: this.returning ? hit.map((r) => ({ id: r.id })) : null, error: null };
    }
    if (this.op === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      for (const it of items) { rows.push({ ...it }); this.db.writes.push({ table: this.table, op: 'insert', payload: { ...it } }); }
      return { data: null, error: null };
    }
    const p = this.payload as Row;
    const i = rows.findIndex((r) => same(r[this.conflictKey], p[this.conflictKey]));
    if (i >= 0) rows[i] = { ...rows[i], ...p }; else rows.push({ ...p });
    this.db.writes.push({ table: this.table, op: 'upsert', payload: { ...p } });
    return { data: null, error: null };
  }
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'boolean' || typeof b === 'boolean') return false;
  return String(a) === String(b);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_PW = 'admin-test-password-only';
const CRON = 'cron-test-secret-only';
const ANON_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.anon-signature';

const HOST_A = 'host.alpha.private@example.test';
const HOST_B = 'host.beta.private@example.test';
const GUEST_1 = 'guest.one.private@example.test';
const GUEST_2 = 'guest.two.private@example.test';
const AGENCY = 'agency.private@example.test';
const HOST_A_PHONE = '+995555000111';
const GUEST_1_PHONE = '+995555000222';
const PRIVATE_VALUES = [HOST_A, HOST_B, GUEST_1, GUEST_2, AGENCY, HOST_A_PHONE, GUEST_1_PHONE, 'Privatehostsurname', ADMIN_PW, CRON, 'secret-host@example.test'];

const USERS: Record<string, AuthUser> = {
  'tok-host-a': { id: 'u-host-a', email: HOST_A, emailConfirmed: true },
  'tok-host-b': { id: 'u-host-b', email: HOST_B, emailConfirmed: true },
  'tok-host-a-unconfirmed': { id: 'u-host-a2', email: HOST_A, emailConfirmed: false },
  'tok-guest-1': { id: 'u-guest-1', email: GUEST_1, emailConfirmed: true },
  'tok-guest-1-upper': { id: 'u-guest-1', email: GUEST_1.toUpperCase(), emailConfirmed: true },
  'tok-guest-2': { id: 'u-guest-2', email: GUEST_2, emailConfirmed: true },
  'tok-agency': { id: 'u-agency', email: 'agency.login.private@example.test', emailConfirmed: true },
  'tok-no-email': { id: 'u-phone', email: null, emailConfirmed: true },
};

const NOW = new Date('2026-09-16T10:00:00Z');

function booking(id: string, over: Row = {}): Row {
  return {
    id, property_id: 'prop-a', property_title: 'Alpha Cottage', property_location: 'Mestia, Svaneti',
    user_email: GUEST_1, user_name: 'Guest One', customer_id: 'u-guest-1', corporate_id: null,
    check_in: '2026-10-10', check_out: '2026-10-13', guests: 2, price_per_night: 100, total_price: 300,
    status: 'pending_host_approval', payment_method: 'pay_now', payment_status: 'paid', payment_transaction_id: `bog-${id}`,
    approval_deadline: '2026-09-17T10:00:00Z', contact_reveal_sent: false,
    date_change_status: null, requested_check_in: null, requested_check_out: null, requested_total_price: null,
    ...over,
  };
}

function makeTables(): Record<string, Row[]> {
  return {
    property_applications: [
      { id: 'prop-a', host_email: HOST_A, host_first_name: 'Nino', host_last_name: 'Privatehostsurname', host_phone: HOST_A_PHONE, price_per_night: 100, pricing_type: 'fixed', guest_pricing_tiers: null, location: 'Mestia, Svaneti', status: 'approved' },
      { id: 'prop-b', host_email: HOST_B, host_first_name: 'Beka', host_last_name: 'Other', host_phone: null, price_per_night: 200, pricing_type: 'fixed', guest_pricing_tiers: null, location: 'Kazbegi', status: 'approved' },
    ],
    bookings: [
      booking('b-pending-paid'),
      booking('b-confirmed-paid', { status: 'confirmed', check_in: '2026-11-01', check_out: '2026-11-03' }),
      booking('b-pending-unpaid', { payment_status: 'pending_payment', check_in: '2026-12-01', check_out: '2026-12-02' }),
      booking('b-payment-failed', { status: 'payment_failed', payment_status: 'payment_failed', check_in: '2026-12-05', check_out: '2026-12-06' }),
      booking('b-confirmed-pap', { status: 'confirmed', payment_method: 'pay_at_property', payment_status: 'pending', payment_transaction_id: null, check_in: '2026-12-10', check_out: '2026-12-12' }),
      booking('b-pending-pap', { payment_method: 'pay_at_property', payment_status: 'pending', payment_transaction_id: null, check_in: '2027-01-10', check_out: '2027-01-12' }),
      booking('b-host-b', { property_id: 'prop-b', property_title: 'Beta House', status: 'confirmed', user_email: GUEST_2, customer_id: 'u-guest-2', check_in: '2026-11-20', check_out: '2026-11-22' }),
      booking('b-agency', { status: 'confirmed', user_email: AGENCY, customer_id: 'u-agency', corporate_id: 'corp-1', check_in: '2027-02-01', check_out: '2027-02-03' }),
      booking('b-checkin-today', { status: 'confirmed', check_in: '2026-09-16', check_out: '2026-09-18' }),
      booking('b-rejected', { status: 'rejected', check_in: '2027-03-01', check_out: '2027-03-03' }),
      booking('b-datechange', { status: 'confirmed', check_in: '2027-04-01', check_out: '2027-04-03', date_change_status: 'pending', requested_check_in: '2027-04-10', requested_check_out: '2027-04-14', requested_total_price: 1 }),
      booking('b-overdue-paid', { approval_deadline: '2026-09-15T09:00:00Z', check_in: '2027-05-01', check_out: '2027-05-03' }),
      booking('b-overdue-unpaid', { approval_deadline: '2026-09-15T08:00:00Z', payment_method: 'pay_at_property', payment_status: 'pending', payment_transaction_id: null, check_in: '2027-05-10', check_out: '2027-05-12' }),
      booking('b-reveal-tomorrow', { status: 'confirmed', check_in: '2026-09-17', check_out: '2026-09-19' }),
      booking('b-occupied', { status: 'confirmed', check_in: '2027-06-10', check_out: '2027-06-15', user_email: GUEST_2, customer_id: 'u-guest-2' }),
    ],
    blocked_dates: [{ id: 'blk-1', property_id: 'prop-a', start_date: '2027-07-01', end_date: '2027-07-05', host_email: HOST_A }],
    ical_blocked_dates: [{ id: 'ical-1', property_id: 'prop-a', start_date: '2027-08-01', end_date: '2027-08-04', host_email: HOST_A }],
    corporate_applications: [{ id: 'corp-1', user_id: 'u-agency', status: 'approved' }],
    profiles: [{ id: 'u-guest-1', email: GUEST_1, phone: GUEST_1_PHONE, first_name: 'Guest', last_name: 'One' }],
    booking_status_logs: [],
    email_delivery_logs: [{ id: 'edl-1', status: 'transient_failure', retry_after: '2026-09-01T00:00:00Z', recipient_email: GUEST_2 }],
    blocked_emails: [],
    promos: [],
    host_offers: [],
  };
}

interface H {
  handler: (req: Request) => Promise<Response>;
  db: FakeDb;
  emails: { to: string; subject: string; html: string }[];
  refunds: string[];
  logs: { event: string; fields?: Row }[];
  responses: string[];
}

function harness(opts: { refundOk?: boolean | ((id: string) => boolean); adminPassword?: string; cronSecret?: string; resendStatus?: number } = {}): H {
  const db = new FakeDb(makeTables());
  const emails: H['emails'] = [];
  const refunds: string[] = [];
  const logs: H['logs'] = [];
  const responses: string[] = [];
  const deps: HandlerDeps = {
    db,
    adminPassword: 'adminPassword' in opts ? opts.adminPassword : ADMIN_PW,
    cronSecret: 'cronSecret' in opts ? opts.cronSecret : CRON,
    getUserFromToken: async (t) => USERS[t] ?? null,
    sendResend: async (m) => { emails.push({ to: m.to, subject: m.subject, html: m.html }); return { status: opts.resendStatus ?? 200, body: '{}' }; },
    requestRefund: async (id) => {
      refunds.push(id);
      const ok = typeof opts.refundOk === 'function' ? opts.refundOk(id) : opts.refundOk !== false;
      if (ok) { const b = db.rows('bookings').find((r) => r.id === id); if (b) b.payment_status = 'refund_pending'; }
      return { ok };
    },
    now: () => NOW,
    sleep: async () => {},
    log: (event, fields) => logs.push({ event, fields }),
  };
  const inner = createHandler(deps);
  const handler = async (req: Request) => {
    const res = await inner(req);
    responses.push(await res.clone().text());
    return res;
  };
  return { handler, db, emails, refunds, logs, responses };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://fn.local/functions/v1/booking-handler', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const admin = { 'x-admin-password': ADMIN_PW };
const cron = { 'x-cron-secret': CRON };
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const b = (h: H, id: string) => h.db.rows('bookings').find((r) => r.id === id) as Row;
const snapshot = (h: H) => JSON.stringify(h.db.tables);

async function call(h: H, body: unknown, headers: Record<string, string> = {}) {
  const res = await h.handler(post(body, headers));
  const text = await res.text();
  let parsed: Row = {};
  try { parsed = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, body: parsed, text };
}

function assertNoLeaks(h: H) {
  const blob = h.responses.join('\n') + JSON.stringify(h.logs) + JSON.stringify(h.db.rows('booking_status_logs'));
  for (const v of PRIVATE_VALUES) assert.ok(!blob.includes(v), `leaked private value: ${v.slice(0, 6)}…`);
}

// ─── Routing / removed endpoints ──────────────────────────────────────────────

test('T1 legacy GET actions return 405 with no side effects', async () => {
  const h = harness();
  const before = snapshot(h);
  for (const a of ['confirm', 'reject', 'approve-dates', 'reject-dates']) {
    const res = await h.handler(new Request(`https://fn.local/?action=${a}&id=b-confirmed-paid`, { method: 'GET' }));
    assert.equal(res.status, 405);
  }
  assert.equal(snapshot(h), before);
  assert.equal(h.refunds.length, 0);
  assert.equal(h.emails.length, 0);
});

test('T2 POST without action (old implicit booking creation) → 400, no insert, no email', async () => {
  const h = harness();
  const count = h.db.rows('bookings').length;
  const r = await call(h, { user_email: 'victim@example.test', user_name: '<a href="https://evil.test">verify</a>', property_id: 'prop-a', property_title: 'x', check_in: '2026-10-01', check_out: '2026-10-02', guests: 1, total_price: 1 });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'Unknown action');
  assert.equal(h.db.rows('bookings').length, count);
  assert.equal(h.emails.length, 0);
});

test('T3 unknown action → 400, no side effects', async () => {
  const h = harness();
  const before = snapshot(h);
  for (const action of ['approve', 'admin-delete', 'CANCEL', '', 42]) {
    const r = await call(h, { action, bookingId: 'b-confirmed-paid' }, { ...admin, ...cron, ...bearer('tok-guest-1') });
    assert.equal(r.status, 400);
  }
  assert.equal(snapshot(h), before);
});

test('T4 retry-transient-emails is removed → 400, delivery logs untouched', async () => {
  const h = harness();
  const r = await call(h, { action: 'retry-transient-emails' }, { ...admin, ...cron });
  assert.equal(r.status, 400);
  assert.equal(h.db.rows('email_delivery_logs')[0].status, 'transient_failure');
});

test('T5 invalid JSON → 400; OPTIONS allows the credential headers', async () => {
  const h = harness();
  for (const raw of ['not json', '[]', 'null']) assert.equal((await call(h, raw, admin)).status, 400);
  const res = await h.handler(new Request('https://fn.local/', { method: 'OPTIONS' }));
  const allowed = (res.headers.get('access-control-allow-headers') ?? '').split(',').map((s) => s.trim());
  for (const hd of ['authorization', 'apikey', 'content-type', 'x-admin-password', 'x-cron-secret']) assert.ok(allowed.includes(hd), hd);
});

// ─── Admin actions ────────────────────────────────────────────────────────────

const ADMIN_ACTIONS = ['admin-confirm-booking', 'admin-reject-booking', 'admin-approve-dates', 'admin-reject-dates'];

test('T6 admin actions without x-admin-password → 401, no side effects', async () => {
  const h = harness();
  const before = snapshot(h);
  for (const action of ADMIN_ACTIONS) {
    const r = await call(h, { action, bookingId: 'b-pending-paid' });
    assert.equal(r.status, 401, action);
    assert.deepEqual(r.body, { error: 'Unauthorized' });
  }
  assert.equal(snapshot(h), before);
  assert.equal(h.refunds.length + h.emails.length, 0);
});

test('T7 wrong password / anon key only / host session / password in body / unconfigured server → 401', async () => {
  const h = harness();
  const unconfigured = harness({ adminPassword: '' });
  for (const action of ADMIN_ACTIONS) {
    const attempts: Record<string, string>[] = [{ 'x-admin-password': 'wrong' }, { 'x-admin-password': ADMIN_PW + 'x' }, { apikey: ANON_JWT, ...bearer(ANON_JWT) }, bearer('tok-host-a')];
    for (const headers of attempts) {
      assert.equal((await call(h, { action, bookingId: 'b-datechange' }, headers)).status, 401, action);
    }
    assert.equal((await call(h, { action, bookingId: 'b-datechange', adminPassword: ADMIN_PW })).status, 401);
    assert.equal((await call(unconfigured, { action, bookingId: 'b-datechange' }, { 'x-admin-password': '' })).status, 401);
  }
  assert.equal(h.refunds.length + h.emails.length, 0);
});

test('T8 correct admin password → each admin action works', async () => {
  const h = harness();
  let r = await call(h, { action: 'admin-confirm-booking', bookingId: 'b-pending-paid' }, admin);
  assert.deepEqual([r.status, r.body], [200, { success: true, alreadyConfirmed: false }]);
  assert.equal(b(h, 'b-pending-paid').status, 'confirmed');
  r = await call(h, { action: 'admin-confirm-booking', bookingId: 'b-pending-paid' }, admin);
  assert.deepEqual(r.body, { success: true, alreadyConfirmed: true });

  r = await call(h, { action: 'admin-reject-booking', bookingId: 'b-pending-pap' }, admin);
  assert.deepEqual([r.status, r.body], [200, { success: true, alreadyRejected: false }]);
  assert.equal(b(h, 'b-pending-pap').status, 'rejected');
  assert.equal(b(h, 'b-pending-pap').payment_status, 'cancelled');

  r = await call(h, { action: 'admin-reject-dates', bookingId: 'b-datechange' }, admin);
  assert.deepEqual([r.status, r.body], [200, { success: true }]);
  assert.equal(b(h, 'b-datechange').date_change_status, 'rejected');

  const h2 = harness();
  r = await call(h2, { action: 'admin-approve-dates', bookingId: 'b-datechange' }, admin);
  assert.deepEqual([r.status, r.body], [200, { success: true }]);
  assert.equal(b(h2, 'b-datechange').check_in, '2027-04-10');
});

test('T9 admin reject: paid pay-now → exactly one refund; unpaid → none', async () => {
  const h = harness();
  assert.equal((await call(h, { action: 'admin-reject-booking', bookingId: 'b-confirmed-paid' }, admin)).status, 200);
  assert.deepEqual(h.refunds, ['b-confirmed-paid']);
  assert.equal(b(h, 'b-confirmed-paid').payment_status, 'refund_pending');
  assert.equal((await call(h, { action: 'admin-reject-booking', bookingId: 'b-confirmed-paid' }, admin)).body.alreadyRejected, true);
  assert.equal((await call(h, { action: 'admin-reject-booking', bookingId: 'b-pending-unpaid' }, admin)).status, 200);
  assert.deepEqual(h.refunds, ['b-confirmed-paid']);
});

test('T10 admin confirm refuses unpaid, failed-payment and closed bookings', async () => {
  const h = harness();
  for (const id of ['b-pending-unpaid', 'b-payment-failed', 'b-rejected']) {
    const r = await call(h, { action: 'admin-confirm-booking', bookingId: id }, admin);
    assert.equal(r.status, 409, id);
    assert.notEqual(b(h, id).status, 'confirmed');
  }
  assert.equal(h.emails.length, 0);
});

// ─── Host actions ─────────────────────────────────────────────────────────────

const HOST_ACTIONS = ['host-approve-booking', 'host-reject-booking', 'host-cancel-booking'];

test('T11 host actions without Authorization, or with the anon key as Bearer → 401', async () => {
  const h = harness();
  const before = snapshot(h);
  for (const action of HOST_ACTIONS) {
    assert.equal((await call(h, { action, bookingId: 'b-pending-paid' })).status, 401);
    assert.equal((await call(h, { action, bookingId: 'b-pending-paid' }, { apikey: ANON_JWT, ...bearer(ANON_JWT) })).status, 401);
    assert.equal((await call(h, { action, bookingId: 'b-pending-paid' }, { Authorization: 'Basic abc' })).status, 401);
  }
  assert.equal(snapshot(h), before);
});

test('T12 correct host email in body without a session → 401 (body email never authorizes)', async () => {
  const h = harness();
  for (const action of HOST_ACTIONS) {
    const r = await call(h, { action, bookingId: 'b-confirmed-paid', hostEmail: HOST_A }, { apikey: ANON_JWT, ...bearer(ANON_JWT) });
    assert.equal(r.status, 401);
  }
  assert.equal(h.refunds.length + h.emails.length, 0);
  assert.equal(b(h, 'b-confirmed-paid').status, 'confirmed');
});

test('T13 authenticated host of another property → 404, no writes, refunds or emails', async () => {
  const h = harness();
  const before = snapshot(h);
  for (const action of HOST_ACTIONS) {
    const r = await call(h, { action, bookingId: 'b-host-b', hostEmail: HOST_B }, bearer('tok-host-a'));
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, { error: 'Booking not found' });
  }
  assert.equal(snapshot(h), before);
  assert.equal(h.refunds.length + h.emails.length, 0);
});

test('T14 unconfirmed-email, email-less, or unknown tokens → 401', async () => {
  const h = harness();
  for (const tok of ['tok-host-a-unconfirmed', 'tok-no-email', 'tok-does-not-exist']) {
    assert.equal((await call(h, { action: 'host-cancel-booking', bookingId: 'b-confirmed-paid' }, bearer(tok))).status, 401, tok);
  }
  assert.equal(h.refunds.length, 0);
});

test('T15 legitimate host approve / reject / cancel succeed; contact reveal only on approve', async () => {
  const h = harness();
  let r = await call(h, { action: 'host-approve-booking', bookingId: 'b-pending-paid' }, bearer('tok-host-a'));
  assert.deepEqual([r.status, r.body], [200, { success: true }]);
  assert.equal(b(h, 'b-pending-paid').status, 'confirmed');
  assert.equal(b(h, 'b-pending-paid').contact_reveal_sent, true);
  const ctx = h.db.rows('email_delivery_logs').map((l) => l.context);
  assert.ok(ctx.includes('booking_confirmed_host') && ctx.includes('contact_reveal_guest') && ctx.includes('contact_reveal_host'));

  r = await call(h, { action: 'host-reject-booking', bookingId: 'b-pending-pap', rejectionNote: 'Fully booked' }, bearer('tok-host-a'));
  assert.deepEqual([r.status, r.body], [200, { success: true }]);
  assert.equal(b(h, 'b-pending-pap').status, 'rejected');

  const emailsBefore = h.emails.length;
  r = await call(h, { action: 'host-cancel-booking', bookingId: 'b-confirmed-pap' }, bearer('tok-host-a'));
  assert.deepEqual([r.status, r.body], [200, { success: true }]);
  assert.equal(b(h, 'b-confirmed-pap').status, 'cancelled_by_host');
  assert.equal(h.emails.slice(emailsBefore).filter((e) => e.subject.includes('host contact')).length, 0);
});

test('T16 host cannot reject a confirmed booking or cancel a non-confirmed one', async () => {
  const h = harness();
  assert.equal((await call(h, { action: 'host-reject-booking', bookingId: 'b-confirmed-paid' }, bearer('tok-host-a'))).status, 409);
  assert.equal((await call(h, { action: 'host-cancel-booking', bookingId: 'b-pending-paid' }, bearer('tok-host-a'))).status, 409);
  assert.equal(h.refunds.length, 0);
});

test('T17 a different hostEmail in the body is ignored; the session identity decides', async () => {
  const h = harness();
  // Host B's session with host A's email in the body cannot touch host A's booking.
  assert.equal((await call(h, { action: 'host-cancel-booking', bookingId: 'b-confirmed-paid', hostEmail: HOST_A }, bearer('tok-host-b'))).status, 404);
  // Host A's session with host B's email in the body still acts on host A's booking.
  assert.equal((await call(h, { action: 'host-approve-booking', bookingId: 'b-pending-pap', hostEmail: HOST_B }, bearer('tok-host-a'))).status, 200);
});

// ─── Guest / agency actions ───────────────────────────────────────────────────

test('T18 cancel with the guest email but no session → 401', async () => {
  const h = harness();
  const attempts: Record<string, string>[] = [{}, { apikey: ANON_JWT, ...bearer(ANON_JWT) }];
  for (const headers of attempts) {
    assert.equal((await call(h, { action: 'cancel', bookingId: 'b-confirmed-paid', userEmail: GUEST_1 }, headers)).status, 401);
  }
  assert.equal(b(h, 'b-confirmed-paid').status, 'confirmed');
  assert.equal(h.refunds.length, 0);
});

test('T19 cancel with another user\'s session → 404, no refund', async () => {
  const h = harness();
  const r = await call(h, { action: 'cancel', bookingId: 'b-confirmed-paid', userEmail: GUEST_1 }, bearer('tok-guest-2'));
  assert.equal(r.status, 404);
  assert.equal(h.refunds.length, 0);
  assert.equal(b(h, 'b-confirmed-paid').status, 'confirmed');
});

test('T20 cancel by the guest and by the owning agency → 200, one refund for paid-online', async () => {
  const h = harness();
  let r = await call(h, { action: 'cancel', bookingId: 'b-confirmed-paid' }, bearer('tok-guest-1-upper'));
  assert.deepEqual([r.status, r.body], [200, { success: true }]);
  assert.equal(b(h, 'b-confirmed-paid').status, 'cancelled');
  assert.deepEqual(h.refunds, ['b-confirmed-paid']);

  r = await call(h, { action: 'cancel', bookingId: 'b-agency' }, bearer('tok-agency'));
  assert.deepEqual([r.status, r.body], [200, { success: true }]);
  assert.deepEqual(h.refunds, ['b-confirmed-paid', 'b-agency']);

  r = await call(h, { action: 'cancel', bookingId: 'b-confirmed-pap' }, bearer('tok-guest-1'));
  assert.equal(r.status, 200);
  assert.equal(b(h, 'b-confirmed-pap').payment_status, 'cancelled');
  assert.equal(h.refunds.length, 2);
});

test('T21 cancel on or after check-in, or on a closed booking → 409', async () => {
  const h = harness();
  assert.equal((await call(h, { action: 'cancel', bookingId: 'b-checkin-today' }, bearer('tok-guest-1'))).status, 409);
  assert.equal((await call(h, { action: 'cancel', bookingId: 'b-rejected' }, bearer('tok-guest-1'))).status, 409);
  assert.equal(h.refunds.length, 0);
});

test('T22 change-dates without a session or with another user\'s session → 401 / 404', async () => {
  const h = harness();
  const body = { action: 'change-dates', bookingId: 'b-confirmed-paid', userEmail: GUEST_1, checkIn: '2027-09-01', checkOut: '2027-09-03', totalPrice: 1 };
  assert.equal((await call(h, body)).status, 401);
  assert.equal((await call(h, body, bearer('tok-guest-2'))).status, 404);
  assert.equal(b(h, 'b-confirmed-paid').date_change_status, null);
});

test('T23 change-dates ignores the browser price and stores the server price', async () => {
  const h = harness();
  const r = await call(h, { action: 'change-dates', bookingId: 'b-confirmed-paid', checkIn: '2027-09-01', checkOut: '2027-09-04', totalPrice: 1 }, bearer('tok-guest-1'));
  assert.deepEqual([r.status, r.body], [200, { success: true, requestedTotalPrice: 300 }]);
  const row = b(h, 'b-confirmed-paid');
  assert.equal(row.requested_total_price, 300);
  assert.equal(row.date_change_status, 'pending');
  assert.equal(row.total_price, 300, 'total unchanged until approval');
});

test('T24 change-dates overlapping another booking, a blocked range or an iCal range → 409', async () => {
  const h = harness();
  const cases: [string, string][] = [['2027-06-12', '2027-06-14'], ['2027-06-14', '2027-06-20'], ['2027-07-04', '2027-07-08'], ['2027-07-05', '2027-07-06'], ['2027-08-03', '2027-08-05']];
  for (const [ci, co] of cases) {
    const r = await call(h, { action: 'change-dates', bookingId: 'b-confirmed-paid', checkIn: ci, checkOut: co }, bearer('tok-guest-1'));
    assert.equal(r.status, 409, `${ci}→${co}`);
    assert.deepEqual(r.body, { error: 'Selected dates are not available' });
  }
  // Back-to-back with an existing booking (check-out day is not a night) is allowed.
  assert.equal((await call(h, { action: 'change-dates', bookingId: 'b-confirmed-paid', checkIn: '2027-06-15', checkOut: '2027-06-17' }, bearer('tok-guest-1'))).status, 200);
});

test('T25 change-dates on a closed booking, with invalid dates, or while pending → rejected', async () => {
  const h = harness();
  assert.equal((await call(h, { action: 'change-dates', bookingId: 'b-rejected', checkIn: '2027-09-01', checkOut: '2027-09-02' }, bearer('tok-guest-1'))).status, 409);
  for (const [ci, co] of [['2027-02-30', '2027-03-02'], ['tomorrow', '2027-01-01'], ['2027-09-05', '2027-09-01'], ['2026-09-01', '2026-09-20']]) {
    assert.equal((await call(h, { action: 'change-dates', bookingId: 'b-confirmed-paid', checkIn: ci, checkOut: co }, bearer('tok-guest-1'))).status, 400, `${ci}→${co}`);
  }
  assert.equal((await call(h, { action: 'change-dates', bookingId: 'b-datechange', checkIn: '2027-09-01', checkOut: '2027-09-02' }, bearer('tok-guest-1'))).status, 409);
});

// ─── Batch jobs ───────────────────────────────────────────────────────────────

test('T26 batch jobs without / with a wrong scheduler secret → 401, no side effects', async () => {
  const h = harness();
  const unconfigured = harness({ cronSecret: '' });
  const before = snapshot(h);
  for (const action of ['expire-pending-approvals', 'send-contact-reveal-emails']) {
    const attempts: Record<string, string>[] = [{}, { 'x-cron-secret': 'wrong' }, admin, bearer('tok-host-a'), { apikey: ANON_JWT, ...bearer(ANON_JWT) }, bearer(CRON)];
    for (const headers of attempts) {
      assert.equal((await call(h, { action, hostEmail: HOST_A }, headers)).status, 401, `${action} ${Object.keys(headers)}`);
    }
    assert.equal((await call(unconfigured, { action }, { 'x-cron-secret': '' })).status, 401);
  }
  assert.equal(snapshot(h), before);
  assert.equal(h.refunds.length + h.emails.length, 0);
});

test('T27 expire with the secret: only overdue pending requests, one refund each paid booking', async () => {
  const h = harness();
  const r = await call(h, { action: 'expire-pending-approvals' }, cron);
  assert.deepEqual([r.status, r.body], [200, { success: true, expired: 2, refundFailures: 0 }]);
  assert.equal(b(h, 'b-overdue-paid').status, 'rejected');
  assert.equal(b(h, 'b-overdue-unpaid').status, 'rejected');
  assert.equal(b(h, 'b-pending-paid').status, 'pending_host_approval', 'deadline not passed');
  assert.deepEqual(h.refunds, ['b-overdue-paid']);
});

test('T28 concurrent expire runs → each booking refunded once and emailed once', async () => {
  const h = harness();
  const rs = await Promise.all([1, 2, 3].map(() => call(h, { action: 'expire-pending-approvals' }, cron)));
  assert.equal(rs.reduce((n, r) => n + r.body.expired, 0), 2);
  assert.deepEqual(h.refunds, ['b-overdue-paid']);
  assert.equal(h.emails.filter((e) => e.subject.startsWith('Booking Request Expired')).length, 2);
});

test('T29 concurrent contact-reveal runs → one email pair per booking', async () => {
  const h = harness();
  const rs = await Promise.all([1, 2, 3].map(() => call(h, { action: 'send-contact-reveal-emails' }, cron)));
  assert.equal(rs.reduce((n, r) => n + r.body.sent, 0), 1);
  assert.equal(h.emails.filter((e) => e.subject.includes('host contact details')).length, 1);
  assert.equal(b(h, 'b-reveal-tomorrow').contact_reveal_sent, true);
});

test('T30 host-scoped expiry is not available to host sessions (scheduler only)', async () => {
  const h = harness();
  assert.equal((await call(h, { action: 'expire-pending-approvals', hostEmail: HOST_A }, bearer('tok-host-a'))).status, 401);
  assert.equal(b(h, 'b-overdue-paid').status, 'pending_host_approval');
});

// ─── Idempotency / races ──────────────────────────────────────────────────────

test('T31 concurrent admin reject + guest cancel + host cancel on one paid booking → exactly one refund', async () => {
  const h = harness();
  const rs = await Promise.all([
    call(h, { action: 'admin-reject-booking', bookingId: 'b-confirmed-paid' }, admin),
    call(h, { action: 'cancel', bookingId: 'b-confirmed-paid' }, bearer('tok-guest-1')),
    call(h, { action: 'host-cancel-booking', bookingId: 'b-confirmed-paid' }, bearer('tok-host-a')),
    call(h, { action: 'admin-reject-booking', bookingId: 'b-confirmed-paid' }, admin),
  ]);
  assert.deepEqual(h.refunds, ['b-confirmed-paid']);
  assert.ok(rs.filter((r) => r.status === 200).length >= 1);
});

test('T32 repeating host-cancel is a no-op: no second refund or email', async () => {
  const h = harness();
  assert.equal((await call(h, { action: 'host-cancel-booking', bookingId: 'b-confirmed-paid' }, bearer('tok-host-a'))).status, 200);
  const emails = h.emails.length;
  const r = await call(h, { action: 'host-cancel-booking', bookingId: 'b-confirmed-paid' }, bearer('tok-host-a'));
  assert.equal(r.status, 409);
  assert.equal(h.refunds.length, 1);
  assert.equal(h.emails.length, emails);
});

// ─── Data exposure / injection ────────────────────────────────────────────────

test('T33 no response contains private data or database error text', async () => {
  const h = harness();
  await call(h, { action: 'host-approve-booking', bookingId: 'b-pending-paid' }, bearer('tok-host-a'));
  await call(h, { action: 'cancel', bookingId: 'b-agency' }, bearer('tok-agency'));
  await call(h, { action: 'cancel', bookingId: 'b-host-b', userEmail: GUEST_2 }, bearer('tok-guest-1'));
  await call(h, { action: 'host-reject-booking', bookingId: 'b-host-b', hostEmail: HOST_B }, bearer('tok-host-a'));
  h.db.failOn.add('bookings:select');
  const r = await call(h, { action: 'admin-confirm-booking', bookingId: 'b-pending-pap' }, admin);
  assert.equal(r.status, 500);
  assert.deepEqual(r.body, { error: 'Request failed' });
  assertNoLeaks(h);
});

test('T34 booking_status_logs notes never contain email addresses', async () => {
  const h = harness();
  await call(h, { action: 'host-approve-booking', bookingId: 'b-pending-paid' }, bearer('tok-host-a'));
  await call(h, { action: 'host-reject-booking', bookingId: 'b-pending-pap', rejectionNote: `contact me at ${HOST_A}` }, bearer('tok-host-a'));
  await call(h, { action: 'host-cancel-booking', bookingId: 'b-confirmed-paid' }, bearer('tok-host-a'));
  const notes = JSON.stringify(h.db.rows('booking_status_logs'));
  assert.ok(h.db.rows('booking_status_logs').length >= 3);
  assert.ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/.test(notes), 'email found in status log');
});

test('T35 user- and host-controlled values are HTML-escaped in every email', async () => {
  const h = harness();
  const evil = '<a href="https://evil.test">Verify</a><script>x</script>';
  Object.assign(b(h, 'b-confirmed-paid'), { user_name: evil, property_title: evil, property_location: evil });
  h.db.rows('property_applications')[0].host_first_name = evil;
  await call(h, { action: 'admin-reject-booking', bookingId: 'b-confirmed-paid', rejectionNote: evil }, admin);
  Object.assign(b(h, 'b-pending-paid'), { user_name: evil, property_title: evil });
  await call(h, { action: 'host-approve-booking', bookingId: 'b-pending-paid' }, bearer('tok-host-a'));
  assert.ok(h.emails.length >= 4);
  for (const e of h.emails) {
    assert.ok(!e.html.includes('<a href="https://evil.test">'), `unescaped link in "${e.subject.slice(0, 20)}"`);
    assert.ok(!e.html.includes('<script>'), 'unescaped script');
    assert.ok(!/[\r\n]/.test(e.subject), 'newline in subject');
  }
  assert.ok(h.emails.some((e) => e.html.includes('&lt;a href=&quot;https://evil.test&quot;&gt;')));
});

test('T36 not-found and not-owned responses are identical (no ownership oracle)', async () => {
  const h = harness();
  const missing = await call(h, { action: 'host-cancel-booking', bookingId: 'does-not-exist' }, bearer('tok-host-a'));
  const notOwned = await call(h, { action: 'host-cancel-booking', bookingId: 'b-host-b' }, bearer('tok-host-a'));
  assert.deepEqual([missing.status, missing.text], [notOwned.status, notOwned.text]);
  const gMissing = await call(h, { action: 'cancel', bookingId: 'does-not-exist' }, bearer('tok-guest-1'));
  const gNotOwned = await call(h, { action: 'cancel', bookingId: 'b-host-b' }, bearer('tok-guest-1'));
  assert.deepEqual([gMissing.status, gMissing.text], [gNotOwned.status, gNotOwned.text]);
  assert.equal((await call(h, { action: 'cancel', bookingId: '../../etc' }, bearer('tok-guest-1'))).status, 400);
});

test('T37 structured logs contain no emails, passwords or tokens', async () => {
  const h = harness({ resendStatus: 422 });
  await call(h, { action: 'admin-reject-booking', bookingId: 'b-confirmed-paid' }, { 'x-admin-password': 'wrong' });
  await call(h, { action: 'admin-reject-booking', bookingId: 'b-confirmed-paid' }, admin);
  await call(h, { action: 'host-approve-booking', bookingId: 'b-pending-paid' }, bearer('tok-host-a'));
  const blob = JSON.stringify(h.logs);
  for (const v of [...PRIVATE_VALUES, 'tok-host-a', 'wrong']) assert.ok(!blob.includes(v), `log leaked ${v.slice(0, 6)}`);
});

// ─── Payment integration ──────────────────────────────────────────────────────

test('T38 failed refund is never reported as success', async () => {
  for (const [body, headers, trigger] of [
    [{ action: 'host-cancel-booking', bookingId: 'b-confirmed-paid' }, bearer('tok-host-a'), 'host_cancel'],
    [{ action: 'cancel', bookingId: 'b-confirmed-paid' }, bearer('tok-guest-1'), 'guest_cancel'],
    [{ action: 'admin-reject-booking', bookingId: 'b-confirmed-paid' }, admin, 'admin_reject'],
    [{ action: 'host-reject-booking', bookingId: 'b-pending-paid' }, bearer('tok-host-a'), 'host_reject'],
  ] as [Row, Record<string, string>, string][]) {
    const h = harness({ refundOk: false });
    const r = await call(h, body, headers);
    assert.equal(r.status, 502, trigger);
    assert.equal(r.body.refundFailed, true);
    const row = b(h, body.bookingId);
    assert.equal(row.payment_status, 'paid', 'must stay paid, not refund_pending/refunded');
    assert.ok(h.db.rows('booking_status_logs').some((l) => l.booking_id === body.bookingId && l.event_type === 'refund_failed'));
    assert.ok(h.emails.some((e) => e.subject.startsWith('Refund failed') && e.to === 'info.rentcottage@gmail.com'));
    assert.ok(!h.emails.some((e) => e.html.includes('a refund has been issued')), 'guest told refund issued');
    assert.equal(h.refunds.length, 1, 'no retry storm');
  }
  const h = harness({ refundOk: false });
  const r = await call(h, { action: 'expire-pending-approvals' }, cron);
  assert.deepEqual(r.body, { success: true, expired: 2, refundFailures: 1 });
});

test('T39 bookings that are not paid online never call BOG', async () => {
  const h = harness();
  await call(h, { action: 'cancel', bookingId: 'b-confirmed-pap' }, bearer('tok-guest-1'));
  await call(h, { action: 'admin-reject-booking', bookingId: 'b-pending-unpaid' }, admin);
  await call(h, { action: 'host-reject-booking', bookingId: 'b-pending-pap' }, bearer('tok-host-a'));
  await call(h, { action: 'admin-reject-booking', bookingId: 'b-payment-failed' }, admin);
  assert.equal(h.refunds.length, 0);
});

test('T40 refund dependency failing closed (e.g. INTERNAL_API_KEY missing) is surfaced as a failure', async () => {
  const h = harness({ refundOk: () => false });
  const r = await call(h, { action: 'cancel', bookingId: 'b-agency' }, bearer('tok-agency'));
  assert.equal(r.status, 502);
  assert.equal(b(h, 'b-agency').status, 'cancelled', 'cancellation stands');
  assert.equal(b(h, 'b-agency').payment_status, 'paid');
});

// ─── Regression: legitimate flows ─────────────────────────────────────────────

test('T41 host approve → guest confirmation + both contact-reveal emails with the right recipients', async () => {
  const h = harness();
  await call(h, { action: 'host-approve-booking', bookingId: 'b-pending-paid' }, bearer('tok-host-a'));
  const confirm = h.emails.find((e) => e.subject === 'Your booking at Alpha Cottage is confirmed! 🎉');
  assert.ok(confirm && confirm.to === GUEST_1);
  assert.match(confirm.html, /Your booking is confirmed!/);
  const toGuest = h.emails.find((e) => e.subject.startsWith('Your host contact details'));
  const toHost = h.emails.find((e) => e.subject.startsWith('სტუმრის საკონტაქტო'));
  assert.ok(toGuest && toGuest.to === GUEST_1 && toGuest.html.includes(HOST_A) && toGuest.html.includes(HOST_A_PHONE));
  assert.ok(toHost && toHost.to === HOST_A && toHost.html.includes(GUEST_1) && toHost.html.includes(GUEST_1_PHONE));
});

test('T42 admin reject with note → guest email with reason + host email (Georgian)', async () => {
  const h = harness();
  await call(h, { action: 'admin-reject-booking', bookingId: 'b-confirmed-paid', rejectionNote: 'Dates unavailable' }, admin);
  const guest = h.emails.find((e) => e.to === GUEST_1);
  const host = h.emails.find((e) => e.to === HOST_A);
  assert.ok(guest && guest.html.includes('Reason for rejection:') && guest.html.includes('Dates unavailable'));
  assert.ok(host && host.subject.includes('ადმინის მიერ') && host.html.includes('Dates unavailable'));
  assert.equal(b(h, 'b-confirmed-paid').rejection_note, 'Dates unavailable');
});

test('T43 guest cancel → guest + host emails; host email carries no guest details', async () => {
  const h = harness();
  await call(h, { action: 'cancel', bookingId: 'b-confirmed-paid' }, bearer('tok-guest-1'));
  const guest = h.emails.find((e) => e.subject === 'Booking Cancelled – Alpha Cottage');
  const host = h.emails.find((e) => e.to === HOST_A);
  assert.ok(guest && guest.to === GUEST_1);
  assert.ok(host && host.subject.includes('სტუმარმა გააუქმა'));
  assert.ok(!host.html.includes(GUEST_1) && !host.html.includes('Guest One'));
});

test('T44 date change request + admin approval; approval re-prices legacy client prices and re-checks availability', async () => {
  const h = harness();
  // Pending request created before this fix with a browser price of ₾1.
  let r = await call(h, { action: 'admin-approve-dates', bookingId: 'b-datechange' }, admin);
  assert.equal(r.status, 200);
  const row = b(h, 'b-datechange');
  assert.deepEqual([row.check_in, row.check_out, row.total_price, row.date_change_status], ['2027-04-10', '2027-04-14', 400, 'approved']);
  assert.ok(h.emails.some((e) => e.subject.startsWith('Date Change Approved') && e.html.includes('₾400')));

  // New request, then the dates get taken before approval.
  r = await call(h, { action: 'change-dates', bookingId: 'b-confirmed-paid', checkIn: '2027-09-01', checkOut: '2027-09-03' }, bearer('tok-guest-1'));
  assert.equal(r.status, 200);
  h.db.rows('bookings').push(booking('b-late', { status: 'confirmed', check_in: '2027-09-02', check_out: '2027-09-05', user_email: GUEST_2 }));
  r = await call(h, { action: 'admin-approve-dates', bookingId: 'b-confirmed-paid' }, admin);
  assert.equal(r.status, 409);
  assert.equal(b(h, 'b-confirmed-paid').check_in, '2026-11-01');
});

test('T45 pricing uses active promos/offers like bog-payment; promo host-email template intact', async () => {
  const h = harness();
  h.db.rows('promos').push({ id: 'promo-1', discount_percent: 10, location: 'Mestia', active: true, starts_at: null, ends_at: null, created_at: '2026-01-01' });
  const r = await call(h, { action: 'change-dates', bookingId: 'b-confirmed-paid', checkIn: '2027-09-01', checkOut: '2027-09-04' }, bearer('tok-guest-1'));
  assert.equal(r.body.requestedTotalPrice, 270);

  const base = safeRecord(booking('b-x', { total_price: 270, promo_id: 'promo-1', promo_discount_percent: 10, pre_discount_total: 300 }));
  const withPromo = buildHostNewBookingEmailHtml('Nino', toHostSafeBooking(base), { title: 'Autumn', percent: 10, before: 300, after: 270, amount: 30 });
  const without = buildHostNewBookingEmailHtml('Nino', toHostSafeBooking(base), null);
  assert.ok(withPromo.includes('ჯამური ფასი (ფასდაკლებით)'));
  assert.ok(without.includes('ჯამური ფასი') && !without.includes('(ფასდაკლებით)'));
});
