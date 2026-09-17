// Tests for bog-payment. Supabase, BOG, Resend and hCaptcha are faked in memory:
// no network, no real payments, no secrets.
//
// Run (Node >= 22.18 / 24, built-in TypeScript type stripping):
//   node --test supabase/functions/bog-payment/handler.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOG_TERMINAL_FAILURE_STATUSES, createHandler, receiptMatchesBooking, secretsEqual, type AuthUser } from './handler.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ─── Console capture (handler logs are asserted on, and kept out of test output) ─

const LOGS: string[] = [];
for (const k of ['log', 'error', 'warn'] as const) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (console as any)[k] = (...args: unknown[]) => { LOGS.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
}

const NOW = Date.parse('2099-01-01T08:00:00Z');

// ─── Fake Supabase ────────────────────────────────────────────────────────────

class FakeDb {
  tables: Record<string, Row[]>;
  writes: { table: string; op: string; payload: Row | null; filters: string }[] = [];
  failWhen: (table: string, op: string) => boolean = () => false;
  seq = 0;
  constructor(tables: Record<string, Row[]>) { this.tables = tables; }
  from(table: string) { if (!this.tables[table]) this.tables[table] = []; return new FakeQuery(this, table); }
  rows(t: string) { return this.tables[t] ?? []; }
  booking(id: string) { return this.rows('bookings').find((b) => b.id === id); }

  // ── In-memory emulation of the SQL functions in *_booking_no_overlap.sql ──
  // (the real functions are exercised against Postgres in supabase/tests/db).
  nowMs = NOW;
  rpcCalls: { name: string; args: Row }[] = [];
  rpcFail: (name: string) => boolean = () => false;
  rpc(name: string, args: Row) {
    this.rpcCalls.push({ name, args });
    const out = (() => {
      if (this.rpcFail(name)) return { data: null, error: { message: 'connection reset internal-detail', code: 'XX000' } };
      if (name === 'create_booking_checked') return this.createBookingChecked(args.p_booking);
      if (name === 'apply_paid_status') return this.applyPaidStatus(String(args.p_booking_id), args.p_updates);
      return { data: null, error: { message: `unknown rpc ${name}` } };
    })();
    return Promise.resolve(out);
  }
  static OCCUPYING = ['confirmed', 'pending', 'pending_host_approval', 'pending_payment'];
  releaseExpiredHolds(propertyId: string, except?: string) {
    for (const b of this.rows('bookings')) {
      if (b.property_id !== propertyId || b.status !== 'pending_payment' || b.id === except) continue;
      if (Date.parse(b.created_at ?? '1970-01-01') < this.nowMs - 20 * 60_000) {
        Object.assign(b, { status: 'payment_failed', payment_status: 'payment_failed' });
        this.rows('booking_status_logs').push({ booking_id: b.id, event_type: 'payment_hold_expired', from_status: 'pending_payment', to_status: 'payment_failed', changed_by: 'system' });
      }
    }
  }
  datesFree(propertyId: string, ci: string, co: string, except?: string) {
    const busy = this.rows('bookings').some((b) => b.property_id === propertyId && b.id !== except && FakeDb.OCCUPYING.includes(b.status) && b.check_in < co && b.check_out > ci);
    const blocked = ['blocked_dates', 'ical_blocked_dates'].some((t) => this.rows(t).some((d) => d.property_id === propertyId && d.start_date <= co && d.end_date >= ci));
    return !busy && !blocked;
  }
  createBookingChecked(p: Row) {
    if (!p.property_id || !p.check_in || !p.check_out || p.check_out <= p.check_in || !FakeDb.OCCUPYING.includes(p.status)) return { data: null, error: { message: 'INVALID_BOOKING', code: 'P0001' } };
    this.releaseExpiredHolds(String(p.property_id));
    if (!this.datesFree(String(p.property_id), p.check_in, p.check_out)) return { data: null, error: { message: 'DATES_UNAVAILABLE', code: 'P0001' } };
    this.seq += 1;
    const row: Row = { id: `bk-${String(this.seq).padStart(4, '0')}-0000-4000-8000-000000000000`, created_at: new Date(this.nowMs).toISOString(), ...p };
    this.rows('bookings').push(row);
    this.writes.push({ table: 'bookings', op: 'insert', payload: { ...p }, filters: 'rpc:create_booking_checked' });
    return { data: { ...row }, error: null };
  }
  applyPaidStatus(id: string, u: Row) {
    const b = this.booking(id);
    if (!b) return { data: { result: 'noop', booking: null }, error: null };
    if (!['pending_payment', 'payment_failed'].includes(b.status)) return { data: { result: 'noop', booking: { ...b } }, error: null };
    this.releaseExpiredHolds(String(b.property_id), id);
    if (b.property_id && !this.datesFree(String(b.property_id), b.check_in, b.check_out, id)) {
      Object.assign(b, { status: 'rejected', payment_status: 'paid', payment_transaction_id: u.payment_transaction_id ?? b.payment_transaction_id, canceled_by: 'system', canceled_at: new Date(this.nowMs).toISOString(), rejection_note: 'DATES_UNAVAILABLE_AFTER_PAYMENT' });
      this.writes.push({ table: 'bookings', op: 'update', payload: { status: 'rejected' }, filters: `rpc:apply_paid_status:${id}` });
      return { data: { result: 'conflict', booking: { ...b } }, error: null };
    }
    Object.assign(b, { payment_status: u.payment_status ?? b.payment_status, status: u.status, payment_transaction_id: u.payment_transaction_id ?? b.payment_transaction_id, ...('approval_deadline' in u ? { approval_deadline: u.approval_deadline } : {}) });
    this.writes.push({ table: 'bookings', op: 'update', payload: { ...u }, filters: `rpc:apply_paid_status:${id}` });
    return { data: { result: 'applied', booking: { ...b } }, error: null };
  }
  bookingWrites() { return this.writes.filter((w) => w.table === 'bookings'); }
}

class FakeQuery {
  private op: 'select' | 'update' | 'insert' | 'delete' = 'select';
  private payload: Row | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private filterText: string[] = [];
  private single = false;
  private db: FakeDb;
  private table: string;
  constructor(db: FakeDb, table: string) { this.db = db; this.table = table; }
  select(_c?: string) { return this; }
  insert(p: Row) { this.op = 'insert'; this.payload = p; return this; }
  update(p: Row) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: unknown) { this.filterText.push(`${c}=${String(v)}`); this.filters.push((r) => r[c] != null && String(r[c]) === String(v)); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.some((v) => String(r[c]) === String(v))); return this; }
  order() { return this; }
  limit() { return this; }
  maybeSingle() { this.single = true; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(resolve: (v: any) => void, reject: (e: unknown) => void) {
    Promise.resolve().then(() => { try { resolve(this.exec()); } catch (e) { reject(e); } });
  }
  private exec() {
    if (this.db.failWhen(this.table, this.op)) return { data: null, error: { message: 'duplicate key value violates unique constraint "secret_internal"; host=10.0.0.5' } };
    const rows = this.db.tables[this.table];
    const match = () => rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === 'select') {
      const out = match().map((r) => ({ ...r }));
      return { data: this.single ? (out[0] ?? null) : out, error: null };
    }
    if (this.op === 'insert') {
      this.db.seq += 1;
      const row: Row = { id: `${this.table === 'bookings' ? 'bk' : 'row'}-${String(this.db.seq).padStart(4, '0')}-0000-4000-8000-000000000000`, created_at: '2099-01-01T00:00:00.000Z', ...this.payload };
      rows.push(row);
      this.db.writes.push({ table: this.table, op: 'insert', payload: { ...this.payload }, filters: '' });
      return { data: this.single ? { ...row } : [{ ...row }], error: null };
    }
    if (this.op === 'update') {
      const m = match();
      for (const r of m) Object.assign(r, this.payload);
      this.db.writes.push({ table: this.table, op: 'update', payload: { ...this.payload }, filters: this.filterText.join('&') });
      return { data: null, error: null };
    }
    const m = match();
    this.db.tables[this.table] = rows.filter((r) => !m.includes(r));
    this.db.writes.push({ table: this.table, op: 'delete', payload: null, filters: this.filterText.join('&') });
    return { data: null, error: null };
  }
}

// ─── Fake network (BOG, Resend, hCaptcha) ─────────────────────────────────────

interface Call { url: string; method: string; headers: Record<string, string>; body: string }

class FakeNet {
  calls: Call[] = [];
  captchaOk = true;
  tokenOk = true;
  orderCreateOk = true;
  orderRedirect: string | null = 'https://payment.bog.test/checkout/abc';
  receipts: Record<string, Row | null> = {};
  actionOk: Record<string, boolean> = { approve: true, cancel: true, refund: true };
  orderSeq = 0;

  fetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const headers: Record<string, string> = {};
    new Headers(init.headers ?? {}).forEach((v, k) => { headers[k] = v; });
    const call = { url: String(input), method: init.method ?? 'GET', headers, body: typeof init.body === 'string' ? init.body : '' };
    this.calls.push(call);
    const u = call.url;
    const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
    if (u === 'https://hcaptcha.com/siteverify') return json({ success: this.captchaOk });
    if (u.startsWith('https://oauth2.bog.ge/')) return this.tokenOk ? json({ access_token: 'bog-access-token-secret' }) : new Response('invalid_client secret-detail', { status: 401 });
    if (u === 'https://api.bog.ge/payments/v1/ecommerce/orders') {
      if (!this.orderCreateOk) return new Response('order failed internal-detail', { status: 500 });
      this.orderSeq += 1;
      return json({ id: `bog-order-${this.orderSeq}`, _links: this.orderRedirect ? { redirect: { href: this.orderRedirect } } : {} });
    }
    const receipt = /^https:\/\/api\.bog\.ge\/payments\/v1\/receipt\/(.+)$/.exec(u);
    if (receipt) {
      const r = this.receipts[decodeURIComponent(receipt[1])];
      return r ? json(r) : new Response('not found', { status: 404 });
    }
    const act = /^https:\/\/api\.bog\.ge\/payments\/v1\/payment\/(?:authorization\/(approve|cancel)|(refund))\/(.+)$/.exec(u);
    if (act) {
      const kind = act[1] ?? act[2];
      return this.actionOk[kind] ? json({ key: 'ok' }) : new Response('bog action failed detail', { status: 400 });
    }
    if (u === 'https://api.resend.com/emails') return json({ id: 'email-1' });
    return new Response('unexpected', { status: 599 });
  };

  bogCalls() { return this.calls.filter((c) => c.url.includes('bog.ge')); }
  emails() { return this.calls.filter((c) => c.url === 'https://api.resend.com/emails').map((c) => JSON.parse(c.body)); }
  orderCreates() { return this.calls.filter((c) => c.url === 'https://api.bog.ge/payments/v1/ecommerce/orders'); }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const INTERNAL_KEY = 'internal-key-0123456789abcdef';
const ENV: Record<string, string> = {
  'Test Public Key': 'bog-client-id-secret',
  'Test Secret Key': 'bog-client-secret-value',
  HCAPTCHA_SECRET_KEY: 'hcaptcha-secret-value',
  RESEND_API_KEY: 're_resend_secret_value',
  INTERNAL_API_KEY: INTERNAL_KEY,
  SUPABASE_URL: 'https://proj.supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-value',
};

const GUEST_EMAIL = 'guest.private@example.test';
const GUEST_NAME = 'Private Guest';
const HOST_EMAIL = 'host.private@example.test';
const CUSTOMER_ID = 'cust-1111-4111-8111-111111111111';
const PROP = 'prop-2222-4222-8222-222222222222';
const PROP_PAP = 'prop-3333-4333-8333-333333333333';

function tables(): Record<string, Row[]> {
  return {
    profiles: [
      { id: CUSTOMER_ID, phone_verified: true },
      { id: 'cust-unverified', phone_verified: false },
    ],
    property_applications: [
      { id: PROP, title: 'Alpha Cottage', location: 'Batumi', price_per_night: 100, pricing_type: 'per_night', guest_pricing_tiers: null, accepted_payment_methods: 'both', booking_approval_mode: 'manual_24h', host_email: HOST_EMAIL, host_first_name: 'Nino' },
      { id: PROP_PAP, title: 'Beta House', location: 'Kazbegi', price_per_night: 80, pricing_type: 'per_guest', guest_pricing_tiers: [{ min_guests: 1, max_guests: 2, price_per_night: 80 }, { min_guests: 3, max_guests: 6, price_per_night: 120 }], accepted_payment_methods: 'pay_at_property_only', booking_approval_mode: 'auto_confirm', host_email: HOST_EMAIL, host_first_name: 'Giorgi' },
    ],
    corporate_applications: [
      { id: 'corp-approved', user_id: CUSTOMER_ID, status: 'approved', agency_name: 'Trusted Travel' },
      { id: 'corp-pending', user_id: CUSTOMER_ID, status: 'pending', agency_name: 'Pending Travel' },
      { id: 'corp-other', user_id: 'someone-else', status: 'approved', agency_name: 'Other Travel' },
    ],
    promos: [],
    host_offers: [],
    bookings: [],
    booking_status_logs: [],
  };
}

const USERS: Record<string, AuthUser> = {
  'tok-guest': { id: CUSTOMER_ID, email: GUEST_EMAIL, emailConfirmed: true },
  'tok-unverified-phone': { id: 'cust-unverified', email: 'unverified@example.test', emailConfirmed: true },
  'tok-no-profile': { id: 'cust-missing', email: 'noprofile@example.test', emailConfirmed: true },
  'tok-unconfirmed': { id: CUSTOMER_ID, email: GUEST_EMAIL, emailConfirmed: false },
  'tok-no-email': { id: CUSTOMER_ID, email: null, emailConfirmed: true },
};
const SESSION = { Authorization: 'Bearer tok-guest' };

interface H { db: FakeDb; net: FakeNet; handler: (r: Request) => Promise<Response>; tokensChecked: string[] }

function harness(envOverride: Record<string, string | undefined> = {}): H {
  const db = new FakeDb(tables());
  const net = new FakeNet();
  const env = { ...ENV, ...envOverride };
  const tokensChecked: string[] = [];
  const handler = createHandler({
    getUserFromToken: async (t) => { tokensChecked.push(t); return USERS[t] ?? null; },
    db,
    fetch: net.fetch,
    env: (n) => env[n],
    now: () => NOW,
  });
  return { db, net, handler, tokensChecked };
}

const FN = 'https://proj.supabase.test/functions/v1/bog-payment';

function orderBody(extra: Row = {}): Row {
  return {
    captcha_token: 'captcha-ok',
    user_email: GUEST_EMAIL,
    user_name: GUEST_NAME,
    customer_id: CUSTOMER_ID,
    property_id: PROP,
    property_title: 'Alpha Cottage',
    property_location: 'Batumi',
    check_in: '2099-06-10',
    check_out: '2099-06-13',
    guests: 2,
    price_per_night: 100,
    total_price: 300,
    payment_method: 'pay_now',
    ...extra,
  };
}

async function call(h: H, method: string, query: string, body?: Row | string, headers: Record<string, string> = {}) {
  const res = await h.handler(new Request(`${FN}${query}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  }));
  const text = await res.text();
  let json: Row = {};
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
}

const createOrder = (h: H, body: Row, headers: Record<string, string> = SESSION) => call(h, 'POST', '?action=create-order', body, headers);

function seedBooking(h: H, extra: Row = {}): Row {
  const row: Row = {
    id: `bk-seed-${h.db.rows('bookings').length + 1}-4000-8000-000000000000`,
    user_email: GUEST_EMAIL, user_name: GUEST_NAME, customer_id: CUSTOMER_ID,
    property_id: PROP, property_title: 'Alpha Cottage', property_location: 'Batumi',
    check_in: '2099-06-10', check_out: '2099-06-13', guests: 2, total_price: 300,
    status: 'pending_payment', payment_status: 'pending_payment', payment_method: 'pay_now',
    payment_transaction_id: 'bog-order-seeded', corporate_id: null,
    ...extra,
  };
  h.db.rows('bookings').push(row);
  return row;
}

const receipt = (orderId: string, externalId: string, key: string, amount = '300', currency = 'GEL'): Row => ({
  order_id: orderId, external_order_id: externalId, order_status: { key }, capture: 'automatic',
  purchase_units: { request_amount: amount, transfer_amount: key === 'completed' ? amount : '0', currency_code: currency },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Characterization: routing
// ═══════════════════════════════════════════════════════════════════════════════

test('ROUTE OPTIONS → 200 ok; unknown action → 404; unsupported method → 405', async () => {
  const h = harness();
  const opt = await call(h, 'OPTIONS', '');
  assert.deepEqual([opt.status, opt.text], [200, 'ok']);
  assert.deepEqual((await call(h, 'GET', '?action=nope')).body, { error: 'Not found' });
  assert.equal((await call(h, 'POST', '?action=nope', {})).status, 404);
  assert.equal((await call(h, 'PUT', '?action=verify')).status, 405);
  assert.equal(h.db.writes.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// create-order: gates
// ═══════════════════════════════════════════════════════════════════════════════

test('CREATE captcha: missing → 400, failed verification → 403; nothing written, no BOG call', async () => {
  const h = harness();
  const missing = await createOrder(h, orderBody({ captcha_token: undefined }));
  assert.deepEqual([missing.status, missing.body.error], [400, 'CAPTCHA token is required.']);
  h.net.captchaOk = false;
  const bad = await createOrder(h, orderBody());
  assert.equal(bad.status, 403);
  assert.match(bad.body.error, /CAPTCHA verification failed/);
  assert.equal(h.db.writes.length, 0);
  assert.equal(h.net.bogCalls().length, 0);
  const verifyCall = h.net.calls.find((c) => c.url === 'https://hcaptcha.com/siteverify')!;
  assert.match(verifyCall.body, /secret=hcaptcha-secret-value/);
  assert.match(verifyCall.body, /response=captcha-ok/);
});

test('CREATE captcha secret not configured → treated as failed (403)', async () => {
  const h = harness({ HCAPTCHA_SECRET_KEY: undefined });
  assert.equal((await createOrder(h, orderBody())).status, 403);
  assert.equal(h.db.writes.length, 0);
});

test('CREATE phone verification (of the session user): unverified or unknown profile → 403 PHONE_NOT_VERIFIED; nothing written', async () => {
  const h = harness();
  const unverified = await createOrder(h, orderBody(), { Authorization: 'Bearer tok-unverified-phone' });
  assert.deepEqual([unverified.status, unverified.body.error], [403, 'PHONE_NOT_VERIFIED']);
  assert.equal((await createOrder(h, orderBody(), { Authorization: 'Bearer tok-no-profile' })).body.error, 'PHONE_NOT_VERIFIED');
  // A verified customer_id in the body does not help an unverified session user.
  assert.equal((await createOrder(h, orderBody({ customer_id: CUSTOMER_ID }), { Authorization: 'Bearer tok-unverified-phone' })).body.error, 'PHONE_NOT_VERIFIED');
  assert.equal(h.db.writes.length, 0);
  assert.equal(h.net.bogCalls().length, 0);
});

test('CREATE required fields, dates and property checks → 400/404 before any write', async () => {
  const h = harness();
  for (const f of ['property_title', 'check_in', 'check_out', 'total_price']) {
    const r = await createOrder(h, orderBody({ [f]: undefined }));
    assert.deepEqual([r.status, r.body.error], [400, `Missing required field: ${f}`], f);
  }
  assert.deepEqual((await createOrder(h, orderBody({ total_price: 'abc' }))).body, { error: 'Invalid total_price value' });
  assert.equal((await createOrder(h, orderBody({ total_price: -5 }))).status, 400);
  assert.match((await createOrder(h, orderBody({ check_in: '2098-12-30', check_out: '2099-01-02' }))).body.error, /cannot be in the past/);
  assert.match((await createOrder(h, orderBody({ check_in: '2099-06-13', check_out: '2099-06-13' }))).body.error, /must be after check-in/);
  assert.deepEqual((await createOrder(h, orderBody({ property_id: undefined }))).body, { error: 'Missing required field: property_id' });
  const nf = await createOrder(h, orderBody({ property_id: 'prop-missing' }));
  assert.deepEqual([nf.status, nf.body.error], [404, 'Property not found.']);
  assert.equal(h.db.writes.length, 0);
  assert.equal(h.net.bogCalls().length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// create-order: price
// ═══════════════════════════════════════════════════════════════════════════════

test('PRICE server total = nightly × nights; ±1 GEL tolerance; client value overridden; mismatch → 400 PRICE_MISMATCH', async () => {
  const h = harness();
  const ok = await createOrder(h, orderBody({ total_price: 300.9 }));
  assert.equal(ok.status, 200);
  assert.equal(h.db.rows('bookings')[0].total_price, 300);
  assert.equal(JSON.parse(h.net.orderCreates()[0].body).purchase_units.total_amount, 300);
  const low = await createOrder(h, orderBody({ total_price: 250 }));
  assert.deepEqual([low.status, low.body.error], [400, 'PRICE_MISMATCH: the price for these dates has changed. Please refresh and try again.']);
  assert.equal((await createOrder(h, orderBody({ total_price: 301.5 }))).status, 400);
  assert.equal(h.db.rows('bookings').length, 1);
});

test('PRICE per-guest tiers pick the matching tier (or the last tier when none matches)', async () => {
  const h = harness();
  const base = { property_id: PROP_PAP, property_title: 'Beta House', payment_method: 'pay_at_property', check_in: '2099-07-01', check_out: '2099-07-03' };
  // Separate stays (same length) so the bookings don't overlap.
  assert.equal((await createOrder(h, orderBody({ ...base, guests: 2, total_price: 160 }))).status, 200);
  assert.equal((await createOrder(h, orderBody({ ...base, check_in: '2099-08-01', check_out: '2099-08-03', guests: 4, total_price: 240 }))).status, 200);
  assert.equal((await createOrder(h, orderBody({ ...base, check_in: '2099-09-01', check_out: '2099-09-03', guests: 9, total_price: 240 }))).status, 200);
  assert.equal((await createOrder(h, orderBody({ ...base, guests: 4, total_price: 160 }))).body.error?.startsWith('PRICE_MISMATCH'), true);
  assert.deepEqual(h.db.rows('bookings').map((b) => b.total_price), [160, 240, 240]);
});

test('PRICE promo: discounted total accepted and recorded; full price still accepted without recording a discount', async () => {
  const h = harness();
  h.db.tables.promos = [{ id: 'promo-1', active: true, discount_percent: 10, location: 'Batumi', starts_at: null, ends_at: null, created_at: '2026-01-01', title: 'Sea' }];
  assert.equal((await createOrder(h, orderBody({ total_price: 270 }))).status, 200);
  assert.equal((await createOrder(h, orderBody({ total_price: 300, check_in: '2099-06-20', check_out: '2099-06-23' }))).status, 200);
  const [disc, full] = h.db.rows('bookings');
  assert.deepEqual([disc.total_price, disc.promo_id, disc.promo_discount_percent, disc.pre_discount_total], [270, 'promo-1', 10, 300]);
  assert.deepEqual([full.total_price, full.promo_id, full.pre_discount_total], [300, null, null]);
});

test('PRICE host offer (free nights) vs promo: cheapest single discount is matched, never stacked', async () => {
  const h = harness();
  h.db.tables.promos = [{ id: 'promo-1', active: true, discount_percent: 10, location: 'Batumi', starts_at: null, ends_at: null, created_at: '2026-01-01' }];
  h.db.tables.host_offers = [{ id: 'offer-1', property_id: PROP, active: true, offer_type: 'free_nights', buy_nights: 2, free_nights: 1, discount_percent: null, starts_at: null, ends_at: null, created_at: '2026-01-01' }];
  assert.equal((await createOrder(h, orderBody({ total_price: 200 }))).status, 200);          // 3 nights, 1 free
  assert.equal((await createOrder(h, orderBody({ total_price: 270, check_in: '2099-06-20', check_out: '2099-06-23' }))).status, 200); // promo candidate still valid
  assert.equal((await createOrder(h, orderBody({ total_price: 180 }))).body.error?.startsWith('PRICE_MISMATCH'), true); // stacked
  const [offer, promo] = h.db.rows('bookings');
  assert.deepEqual([offer.total_price, offer.host_offer_id, offer.host_offer_free_nights, offer.host_offer_discount_percent, offer.promo_id, offer.pre_discount_total], [200, 'offer-1', 1, null, null, 300]);
  assert.deepEqual([promo.total_price, promo.promo_id, promo.host_offer_id], [270, 'promo-1', null]);
});

test('PRICE accepted payment methods are enforced per property', async () => {
  const h = harness();
  h.db.rows('property_applications')[0].accepted_payment_methods = 'online_only';
  assert.deepEqual((await createOrder(h, orderBody({ payment_method: 'pay_at_property' }))).body, { error: 'This property only accepts online payment.' });
  const pap = await createOrder(h, orderBody({ property_id: PROP_PAP, guests: 2, total_price: 240, payment_method: 'pay_now' }));
  assert.deepEqual(pap.body, { error: 'This property only accepts pay-at-property.' });
  assert.equal(h.db.writes.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// create-order: pay at property
// ═══════════════════════════════════════════════════════════════════════════════

test('PAP manual approval: pending_host_approval + 24h deadline, created log, emails; no BOG call', async () => {
  const h = harness();
  const r = await createOrder(h, orderBody({ payment_method: 'pay_at_property' }));
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['bookingId', 'payAtProperty', 'success']);
  const b = h.db.booking(r.body.bookingId)!;
  assert.deepEqual([b.status, b.payment_status, b.payment_method, b.approval_deadline, b.customer_id, b.user_email], ['pending_host_approval', 'pending_on_arrival', 'pay_at_property', new Date(NOW + 86_400_000).toISOString(), CUSTOMER_ID, GUEST_EMAIL]);
  assert.deepEqual(h.db.rows('booking_status_logs').map((l) => [l.event_type, l.to_status, l.changed_by]), [['created', 'pending_host_approval', 'system']]);
  assert.equal(h.net.bogCalls().length, 0);
  const emails = h.net.emails();
  assert.deepEqual(emails.map((e) => e.to), ['info.rentcottage@gmail.com', GUEST_EMAIL, HOST_EMAIL]);
  const hostMail = emails[2];
  assert.ok(!hostMail.html.includes(GUEST_EMAIL) && !hostMail.html.includes(GUEST_NAME), 'host email has no guest PII');
  assert.equal(emails[0].from, 'bookings@rentcottage.ge');
});

test('PAP auto-confirm: confirmed, no deadline; agency name only from an approved agency owned by the customer', async () => {
  const h = harness();
  const base = { property_id: PROP_PAP, property_title: 'Beta House', payment_method: 'pay_at_property', guests: 2, total_price: 240 };
  const r1 = await createOrder(h, orderBody({ ...base, corporate_id: 'corp-approved' }));
  const r2 = await createOrder(h, orderBody({ ...base, check_in: '2099-07-10', check_out: '2099-07-13', corporate_id: 'corp-pending' }));
  const r3 = await createOrder(h, orderBody({ ...base, check_in: '2099-08-10', check_out: '2099-08-13', corporate_id: 'corp-other' }));
  const [b1, b2, b3] = [r1, r2, r3].map((r) => h.db.booking(r.body.bookingId)!);
  assert.deepEqual([b1.status, b1.approval_deadline, b1.corporate_id, b2.corporate_id, b3.corporate_id], ['confirmed', null, 'corp-approved', null, null]);
  const hostMails = h.net.emails().filter((e) => e.to === HOST_EMAIL);
  assert.equal(hostMails.length, 3);
  assert.ok(hostMails[0].html.includes('Trusted Travel'));
  assert.ok(!hostMails[1].html.includes('Pending Travel') && !hostMails[2].html.includes('Other Travel'));
});

// ═══════════════════════════════════════════════════════════════════════════════
// create-order: pay now
// ═══════════════════════════════════════════════════════════════════════════════

test('PAYNOW pending_payment booking, BOG order with server amount and booking id, transaction stored, checkout URL returned', async () => {
  const h = harness();
  const r = await createOrder(h, orderBody());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { checkoutUrl: 'https://payment.bog.test/checkout/abc', bookingId: r.body.bookingId, bogOrderId: 'bog-order-1' });
  const b = h.db.booking(r.body.bookingId)!;
  assert.deepEqual([b.status, b.payment_status, b.payment_method, b.payment_transaction_id, b.total_price], ['pending_payment', 'pending_payment', 'pay_now', 'bog-order-1', 300]);
  const order = JSON.parse(h.net.orderCreates()[0].body);
  assert.equal(order.external_order_id, b.id);
  assert.equal(order.callback_url, 'https://proj.supabase.test/functions/v1/bog-payment?action=callback');
  assert.deepEqual(order.redirect_urls, { success: `https://rentcottage.ge/payment/success?booking_id=${b.id}`, fail: `https://rentcottage.ge/payment/failed?booking_id=${b.id}` });
  assert.equal(order.purchase_units.currency, 'GEL');
  assert.equal(h.net.calls.find((c) => c.url.startsWith('https://oauth2.bog.ge/'))!.headers.authorization, `Basic ${btoa('bog-client-id-secret:bog-client-secret-value')}`);
  assert.deepEqual(h.db.rows('booking_status_logs').map((l) => l.event_type), ['payment_initiated']);
  assert.equal(h.net.emails().length, 0, 'no emails before payment');
});

test('PAYNOW BOG token / order / redirect failures mark the booking payment_failed', async () => {
  for (const setup of [(n: FakeNet) => { n.tokenOk = false; }, (n: FakeNet) => { n.orderCreateOk = false; }, (n: FakeNet) => { n.orderRedirect = null; }]) {
    const h = harness();
    setup(h.net);
    const r = await createOrder(h, orderBody());
    assert.equal(r.status, 500);
    const b = h.db.rows('bookings')[0];
    assert.deepEqual([b.status, b.payment_status], ['payment_failed', 'payment_failed']);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// callback
// ═══════════════════════════════════════════════════════════════════════════════

const callbackBody = (orderId: string, externalId: string, statusKey = 'completed') => ({
  event: 'order_payment', zoned_request_time: '2099-01-01T08:00:00Z',
  body: { order_id: orderId, external_order_id: externalId, order_status: { key: statusKey } },
});

test('CALLBACK completed (BOG re-fetch) → paid + pending_host_approval with deadline and emails; auto_confirm → confirmed', async () => {
  const h = harness();
  const b = seedBooking(h, { payment_transaction_id: 'bog-order-7' });
  h.net.receipts['bog-order-7'] = receipt('bog-order-7', b.id, 'completed');
  const r = await call(h, 'POST', '?action=callback', callbackBody('bog-order-7', b.id));
  assert.deepEqual([r.status, r.text], [200, 'ok']);
  assert.deepEqual([b.status, b.payment_status, b.approval_deadline], ['pending_host_approval', 'paid', new Date(NOW + 86_400_000).toISOString()]);
  assert.ok(h.net.calls.some((c) => c.url.endsWith('/receipt/bog-order-7')));
  assert.deepEqual(h.net.emails().map((e) => e.to).sort(), [GUEST_EMAIL, HOST_EMAIL, 'info.rentcottage@gmail.com'].sort());

  const auto = harness();
  const b2 = seedBooking(auto, { property_id: PROP_PAP, payment_transaction_id: 'bog-order-8' });
  auto.net.receipts['bog-order-8'] = receipt('bog-order-8', b2.id, 'completed');
  await call(auto, 'POST', '', callbackBody('bog-order-8', b2.id));   // no ?action= — detected by body shape
  assert.deepEqual([b2.status, b2.payment_status, b2.approval_deadline], ['confirmed', 'paid', null]);
});

test('CALLBACK the body status is never trusted: BOG says processing/rejected → not paid', async () => {
  const h = harness();
  const b = seedBooking(h, { payment_transaction_id: 'bog-order-9' });
  h.net.receipts['bog-order-9'] = receipt('bog-order-9', b.id, 'processing');
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-9', b.id, 'completed'));
  assert.deepEqual([b.status, b.payment_status], ['pending_payment', 'pending_payment']);
  h.net.receipts['bog-order-9'] = receipt('bog-order-9', b.id, 'rejected');
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-9', b.id, 'completed'));
  assert.deepEqual([b.status, b.payment_status], ['payment_failed', 'payment_failed']);
  assert.equal(h.net.emails().length, 0);
});

test('CALLBACK no state change: unknown booking, closed booking, BOG token or receipt unavailable, non-JSON body', async () => {
  const h = harness();
  const closed = seedBooking(h, { status: 'confirmed', payment_status: 'paid', payment_transaction_id: 'bog-order-c' });
  h.net.receipts['bog-order-c'] = receipt('bog-order-c', closed.id, 'refunded');
  assert.equal((await call(h, 'POST', '?action=callback', callbackBody('bog-order-c', closed.id))).text, 'ok');
  assert.equal((await call(h, 'POST', '?action=callback', callbackBody('bog-order-x', 'unknown-id'))).text, 'ok');
  assert.equal((await call(h, 'POST', '?action=callback', 'not json')).text, 'ok');
  const pending = seedBooking(h, { payment_transaction_id: 'bog-order-p' });
  h.net.tokenOk = false;
  assert.equal((await call(h, 'POST', '?action=callback', callbackBody('bog-order-p', pending.id))).text, 'ok');
  h.net.tokenOk = true;
  assert.equal((await call(h, 'POST', '?action=callback', callbackBody('bog-order-p', pending.id))).text, 'ok'); // no receipt
  assert.equal(h.db.bookingWrites().length, 0);
  assert.equal(closed.status, 'confirmed');
});

// ═══════════════════════════════════════════════════════════════════════════════
// verify
// ═══════════════════════════════════════════════════════════════════════════════

test('VERIFY pay_at_property trusts DB; pay_now without transaction → payment_failed view; missing → 400/404', async () => {
  const h = harness();
  const pap = seedBooking(h, { payment_method: 'pay_at_property', status: 'confirmed', payment_status: 'pending_on_arrival', payment_transaction_id: null });
  const r = await call(h, 'GET', `?action=verify&booking_id=${pap.id}`);
  assert.deepEqual(r.body, { bookingId: pap.id, paymentStatus: 'pending_on_arrival', bookingStatus: 'confirmed', verified: false, source: 'db_pay_at_property' });
  const noTx = seedBooking(h, { payment_transaction_id: null });
  assert.equal((await call(h, 'GET', `?action=verify&booking_id=${noTx.id}`)).body.source, 'no_transaction_id');
  assert.equal((await call(h, 'GET', '?action=verify')).status, 400);
  assert.equal((await call(h, 'GET', '?action=verify&booking_id=nope')).status, 404);
  assert.equal(h.db.bookingWrites().length, 0);
});

test('VERIFY pay_now uses the stored transaction id: completed → paid sync; rejected → payment_failed; processing → unchanged', async () => {
  const h = harness();
  const b = seedBooking(h, { payment_transaction_id: 'bog-order-v' });
  h.net.receipts['bog-order-v'] = receipt('bog-order-v', b.id, 'processing');
  const p = await call(h, 'GET', `?action=verify&booking_id=${b.id}`);
  assert.deepEqual([p.body.paymentStatus, p.body.verified, b.status], ['pending_payment', false, 'pending_payment']);
  h.net.receipts['bog-order-v'] = receipt('bog-order-v', b.id, 'completed');
  const c = await call(h, 'GET', `?action=verify&booking_id=${b.id}`);
  assert.deepEqual([c.body.paymentStatus, c.body.bookingStatus, c.body.verified, b.status, b.payment_status], ['paid', 'pending_host_approval', true, 'pending_host_approval', 'paid']);
  assert.deepEqual(h.db.rows('booking_status_logs').map((l) => l.event_type), ['verify_paid_sync']);

  const f = harness();
  const fb = seedBooking(f, { payment_transaction_id: 'bog-order-f' });
  f.net.receipts['bog-order-f'] = receipt('bog-order-f', fb.id, 'rejected');
  const fr = await call(f, 'GET', `?action=verify&booking_id=${fb.id}`);
  assert.deepEqual([fr.body.paymentStatus, fb.status], ['payment_failed', 'payment_failed']);
});

test('VERIFY BOG unavailable → current DB status, unverified, no write', async () => {
  const h = harness();
  const b = seedBooking(h, { payment_transaction_id: 'bog-order-u' });
  h.net.tokenOk = false;
  assert.equal((await call(h, 'GET', `?action=verify&booking_id=${b.id}`)).body.source, 'bog_token_unavailable');
  h.net.tokenOk = true;
  assert.equal((await call(h, 'GET', `?action=verify&booking_id=${b.id}`)).body.source, 'bog_order_unavailable');
  assert.equal(h.db.bookingWrites().length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// mark-failed
// ═══════════════════════════════════════════════════════════════════════════════

test('MARKFAILED pay_at_property skipped; non-pending untouched; completed at BOG → not downgraded; missing → 400/404', async () => {
  const h = harness();
  const pap = seedBooking(h, { payment_method: 'pay_at_property', status: 'confirmed', payment_status: 'pending_on_arrival' });
  assert.equal((await call(h, 'GET', `?action=mark-failed&booking_id=${pap.id}`)).body.skipped, 'pay_at_property');
  const paid = seedBooking(h, { status: 'pending_host_approval', payment_status: 'paid' });
  assert.equal((await call(h, 'GET', `?action=mark-failed&booking_id=${paid.id}`)).body.updated, false);
  const done = seedBooking(h, { payment_transaction_id: 'bog-order-done' });
  h.net.receipts['bog-order-done'] = receipt('bog-order-done', done.id, 'completed');
  const r = await call(h, 'GET', `?action=mark-failed&booking_id=${done.id}`);
  assert.deepEqual([r.body.updated, r.body.actualStatus, done.status], [false, 'paid', 'pending_payment']);
  assert.equal((await call(h, 'GET', '?action=mark-failed')).status, 400);
  assert.equal((await call(h, 'GET', '?action=mark-failed&booking_id=nope')).status, 404);
  assert.equal(h.db.bookingWrites().length, 0);
});

test('MARKFAILED BOG terminal failure (rejected) → payment_failed + log', async () => {
  const h = harness();
  const b = seedBooking(h, { payment_transaction_id: 'bog-order-r' });
  h.net.receipts['bog-order-r'] = receipt('bog-order-r', b.id, 'rejected');
  const r = await call(h, 'GET', `?action=mark-failed&booking_id=${b.id}`);
  assert.deepEqual([r.body.updated, b.status, b.payment_status], [true, 'payment_failed', 'payment_failed']);
  assert.deepEqual(h.db.rows('booking_status_logs').map((l) => l.event_type), ['mark_failed_redirect']);
});

// ═══════════════════════════════════════════════════════════════════════════════
// internal capture / release / refund
// ═══════════════════════════════════════════════════════════════════════════════

const internal = (h: H, action: string, bookingId: string, key: string | null = INTERNAL_KEY) =>
  call(h, 'POST', `?action=${action}`, { bookingId }, key === null ? {} : { 'x-internal-key': key });

test('INTERNAL capture → paid, release → canceled, refund → refund_pending; each calls the matching BOG endpoint for the stored order', async () => {
  for (const [action, path, status, from] of [['internal-capture', 'authorization/approve', 'paid', 'authorized'], ['internal-release', 'authorization/cancel', 'canceled', 'paid'], ['internal-refund', 'refund', 'refund_pending', 'paid']]) {
    const h = harness();
    const b = seedBooking(h, { status: 'confirmed', payment_status: from, payment_transaction_id: 'bog-order-i' });
    const r = await internal(h, action, b.id);
    assert.deepEqual([r.status, r.body], [200, { success: true, paymentStatus: status }], action);
    assert.equal(b.payment_status, status);
    assert.deepEqual(h.net.bogCalls().filter((c) => c.url.includes('/payment/')).map((c) => c.url), [`https://api.bog.ge/payments/v1/payment/${path}/bog-order-i`]);
    assert.deepEqual(h.db.rows('booking_status_logs').map((l) => l.event_type), [`bog_${action}_ok`]);
  }
});

test('INTERNAL skips non-online bookings; missing booking → 404; missing bookingId → 400; BOG failure → 500 + failure log, status unchanged', async () => {
  const h = harness();
  const pap = seedBooking(h, { payment_method: 'pay_at_property', payment_transaction_id: null });
  assert.deepEqual((await internal(h, 'internal-refund', pap.id)).body, { success: true, skipped: 'not_online_payment' });
  assert.equal((await internal(h, 'internal-refund', 'nope')).status, 404);
  assert.equal((await call(h, 'POST', '?action=internal-refund', {}, { 'x-internal-key': INTERNAL_KEY })).status, 400);
  const b = seedBooking(h, { status: 'rejected', payment_status: 'paid', payment_transaction_id: 'bog-order-z' });
  h.net.actionOk.refund = false;
  const r = await internal(h, 'internal-refund', b.id);
  assert.equal(r.status, 500);
  assert.equal(b.payment_status, 'paid');
  assert.deepEqual(h.db.rows('booking_status_logs').map((l) => l.event_type), ['bog_internal-refund_failed']);
});

test('INTERNAL wrong, missing or unconfigured key → 401 with no BOG call and no write', async () => {
  const h = harness();
  const b = seedBooking(h, { status: 'rejected', payment_status: 'paid' });
  for (const key of ['wrong', '', null, INTERNAL_KEY.slice(0, -1), INTERNAL_KEY + 'x']) {
    const r = await internal(h, 'internal-refund', b.id, key);
    assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }]);
  }
  const unconfigured = harness({ INTERNAL_API_KEY: undefined });
  const b2 = seedBooking(unconfigured, { status: 'rejected', payment_status: 'paid' });
  assert.equal((await internal(unconfigured, 'internal-refund', b2.id, '')).status, 401);
  assert.equal(h.net.bogCalls().length + unconfigured.net.bogCalls().length, 0);
  assert.equal(h.db.bookingWrites().length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY
// ═══════════════════════════════════════════════════════════════════════════════

test('SEC create-order without a verified session → 401 before captcha, DB or BOG (no side effects)', async () => {
  const h = harness();
  const variants: Record<string, string>[] = [
    {},
    { Authorization: 'Bearer ' },
    { Authorization: 'Basic abc' },
    { Authorization: 'Bearer invalid-token' },
    { Authorization: 'Bearer tok-unconfirmed' },
    { Authorization: 'Bearer tok-no-email' },
  ];
  for (const headers of variants) {
    for (const method of ['pay_now', 'pay_at_property']) {
      const r = await createOrder(h, orderBody({ payment_method: method }), headers);
      assert.deepEqual([r.status, r.body], [401, { error: 'Please sign in to book.' }], JSON.stringify(headers));
    }
  }
  assert.equal(h.db.writes.length, 0);
  assert.equal(h.net.calls.length, 0, 'no hCaptcha, BOG or email call');
});

test('SEC create-order identity comes only from the session: body customer_id / user_email are ignored everywhere', async () => {
  const h = harness();
  const body = orderBody({ user_email: 'attacker@example.test', customer_id: 'someone-else', corporate_id: 'corp-other', payment_method: 'pay_at_property' });
  const r = await createOrder(h, body);
  assert.equal(r.status, 200);
  const b = h.db.booking(r.body.bookingId)!;
  assert.deepEqual([b.customer_id, b.user_email, b.corporate_id], [CUSTOMER_ID, GUEST_EMAIL, null]);
  assert.ok(!h.net.emails().some((e) => e.to === 'attacker@example.test' || JSON.stringify(e).includes('attacker@example.test')));
  assert.deepEqual(h.tokensChecked, ['tok-guest']);

  // The session user's own approved agency still applies.
  const own = await createOrder(h, orderBody({ customer_id: 'someone-else', corporate_id: 'corp-approved', payment_method: 'pay_at_property', check_in: '2099-07-10', check_out: '2099-07-13' }));
  assert.equal(h.db.booking(own.body.bookingId)!.corporate_id, 'corp-approved');

  // Pay now: the BOG order and stored booking also use the session identity.
  const pn = await createOrder(h, orderBody({ user_email: 'attacker@example.test', customer_id: 'someone-else', check_in: '2099-08-10', check_out: '2099-08-13' }));
  assert.deepEqual([h.db.booking(pn.body.bookingId)!.customer_id, h.db.booking(pn.body.bookingId)!.user_email], [CUSTOMER_ID, GUEST_EMAIL]);
});

test('SEC debug-credentials is gone: 404 for GET and POST, no env names, no BOG call', async () => {
  const h = harness();
  for (const method of ['GET', 'POST']) {
    const r = await call(h, method, '?action=debug-credentials', method === 'POST' ? {} : undefined);
    assert.deepEqual([r.status, r.body], [404, { error: 'Not found' }]);
    for (const name of Object.keys(ENV)) assert.ok(!r.text.includes(name));
  }
  assert.equal(h.net.calls.length, 0);
});

test('SEC mark-failed never fails an in-progress, unknown, unreachable or mismatched payment', async () => {
  for (const key of ['created', 'processing', 'auth_requested', 'blocked', 'partial_completed', 'refund_requested', 'something_new', '']) {
    const h = harness();
    const b = seedBooking(h, { payment_transaction_id: 'bog-order-m' });
    h.net.receipts['bog-order-m'] = receipt('bog-order-m', b.id, key);
    const r = await call(h, 'GET', `?action=mark-failed&booking_id=${b.id}`);
    assert.deepEqual([r.body.updated, b.status, b.payment_status], [false, 'pending_payment', 'pending_payment'], key);
    assert.equal(h.db.bookingWrites().length, 0, key);
  }
  const cases: [string, (h: H, b: Row) => void][] = [
    ['token down', (h) => { h.net.tokenOk = false; }],
    ['receipt missing', () => { /* no receipt */ }],
    ['no order id yet', (_h, b) => { b.payment_transaction_id = null; }],
    ['receipt for another booking', (h, b) => { h.net.receipts['bog-order-m'] = receipt('bog-order-m', 'other-booking', 'rejected'); void b; }],
    ['receipt for another order', (h, b) => { h.net.receipts['bog-order-m'] = receipt('bog-order-zzz', b.id, 'rejected'); }],
  ];
  for (const [label, setup] of cases) {
    const h = harness();
    const b = seedBooking(h, { payment_transaction_id: 'bog-order-m' });
    setup(h, b);
    await call(h, 'GET', `?action=mark-failed&booking_id=${b.id}`);
    assert.deepEqual([b.status, b.payment_status], ['pending_payment', 'pending_payment'], label);
    assert.equal(h.db.bookingWrites().length, 0, label);
  }
});

test('SEC mark-failed applies every terminal BOG failure status (and still redirects paid ones)', async () => {
  assert.deepEqual(BOG_TERMINAL_FAILURE_STATUSES, ['rejected', 'failed', 'error', 'cancelled', 'canceled', 'abandoned', 'expired']);
  for (const key of BOG_TERMINAL_FAILURE_STATUSES) {
    const h = harness();
    const b = seedBooking(h, { payment_transaction_id: 'bog-order-t' });
    h.net.receipts['bog-order-t'] = receipt('bog-order-t', b.id, key.toUpperCase());
    const r = await call(h, 'GET', `?action=mark-failed&booking_id=${b.id}`);
    assert.equal(r.body.updated, true, key);
    assert.equal(b.status, 'payment_failed', key);
    assert.ok(['payment_failed', 'canceled'].includes(b.payment_status), key);
  }
  const h = harness();
  const paid = seedBooking(h, { payment_transaction_id: 'bog-order-ok' });
  h.net.receipts['bog-order-ok'] = receipt('bog-order-ok', paid.id, 'completed');
  assert.equal((await call(h, 'GET', `?action=mark-failed&booking_id=${paid.id}`)).body.actualStatus, 'paid');
});

test('SEC forged callbacks change nothing (other order, other booking, amount, currency, order mismatch, closed booking)', async () => {
  const scenarios: [string, (h: H) => Row][] = [
    ['cheap completed order named for a booking that has its own order', (h) => {
      const v = seedBooking(h, { total_price: 5000, payment_transaction_id: 'bog-order-victim' });
      h.net.receipts['bog-order-cheap'] = receipt('bog-order-cheap', 'attacker-booking', 'completed', '1');
      return { v, body: callbackBody('bog-order-cheap', v.id) };
    }],
    ['booking without stored order + receipt of another booking', (h) => {
      const v = seedBooking(h, { total_price: 5000, payment_transaction_id: null });
      h.net.receipts['bog-order-cheap'] = receipt('bog-order-cheap', 'attacker-booking', 'completed', '5000');
      return { v, body: callbackBody('bog-order-cheap', v.id) };
    }],
    ['booking without stored order + receipt with no external reference', (h) => {
      const v = seedBooking(h, { total_price: 5000, payment_transaction_id: null });
      const r = receipt('bog-order-cheap', '', 'completed', '5000');
      delete r.external_order_id;
      h.net.receipts['bog-order-cheap'] = r;
      return { v, body: callbackBody('bog-order-cheap', v.id) };
    }],
    ['right order, lower amount', (h) => {
      const v = seedBooking(h, { total_price: 5000, payment_transaction_id: 'bog-order-own' });
      h.net.receipts['bog-order-own'] = receipt('bog-order-own', v.id, 'completed', '4999.5');
      return { v, body: callbackBody('bog-order-own', v.id) };
    }],
    ['right order, other currency', (h) => {
      const v = seedBooking(h, { total_price: 300, payment_transaction_id: 'bog-order-own' });
      h.net.receipts['bog-order-own'] = receipt('bog-order-own', v.id, 'completed', '300', 'USD');
      return { v, body: callbackBody('bog-order-own', v.id) };
    }],
    ['receipt reports a different order id', (h) => {
      const v = seedBooking(h, { total_price: 300, payment_transaction_id: 'bog-order-own' });
      h.net.receipts['bog-order-own'] = receipt('bog-order-other', v.id, 'completed', '300');
      return { v, body: callbackBody('bog-order-own', v.id) };
    }],
    ['body says completed, BOG has no receipt', (h) => {
      const v = seedBooking(h, { payment_transaction_id: 'bog-order-own' });
      return { v, body: callbackBody('bog-order-own', v.id) };
    }],
    ['host-cancelled booking', (h) => {
      const v = seedBooking(h, { status: 'cancelled_by_host', payment_status: 'cancelled', payment_transaction_id: 'bog-order-own' });
      h.net.receipts['bog-order-own'] = receipt('bog-order-own', v.id, 'completed', '300');
      return { v, body: callbackBody('bog-order-own', v.id) };
    }],
  ];
  for (const [label, setup] of scenarios) {
    const h = harness();
    const { v, body } = setup(h);
    const before = JSON.stringify(v);
    const r = await call(h, 'POST', '?action=callback', body);
    assert.deepEqual([r.status, r.text], [200, 'ok'], label);
    assert.equal(JSON.stringify(v), before, label);
    assert.equal(h.db.bookingWrites().length, 0, label);
    assert.equal(h.net.emails().length, 0, label);
    if (label.startsWith('cheap completed order named')) {
      assert.equal(h.net.calls.filter((c) => c.url.includes('/receipt/')).length, 0, 'a mismatched order id is rejected before asking BOG');
    }
  }
});

test('SEC callback: genuine receipt without a stored order id is accepted and stored; duplicate delivery is a no-op', async () => {
  const h = harness();
  const b = seedBooking(h, { payment_transaction_id: null });
  h.net.receipts['bog-order-late'] = receipt('bog-order-late', b.id, 'completed', '300.00');
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-late', b.id));
  assert.deepEqual([b.payment_status, b.status, b.payment_transaction_id], ['paid', 'pending_host_approval', 'bog-order-late']);
  const writes = h.db.bookingWrites().length;
  const emails = h.net.emails().length;
  const deadline = b.approval_deadline;
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-late', b.id));
  assert.equal(h.db.bookingWrites().length, writes, 'no second update');
  assert.equal(h.net.emails().length, emails, 'no second emails');
  assert.equal(b.approval_deadline, deadline);
});

test('SEC callback mismatch leaves an audit log entry without changing the booking', async () => {
  const h = harness();
  const b = seedBooking(h, { total_price: 5000, payment_transaction_id: 'bog-order-own' });
  h.net.receipts['bog-order-own'] = receipt('bog-order-own', b.id, 'completed', '1');
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-own', b.id));
  assert.deepEqual(h.db.rows('booking_status_logs').map((l) => [l.event_type, l.from_status, l.to_status]), [['bog_callback_mismatch', 'pending_payment', 'pending_payment']]);
  assert.equal(b.payment_status, 'pending_payment');
});

test('SEC verify does not sync a paid receipt that does not match the booking', async () => {
  const h = harness();
  const b = seedBooking(h, { total_price: 5000, payment_transaction_id: 'bog-order-vm' });
  h.net.receipts['bog-order-vm'] = receipt('bog-order-vm', b.id, 'completed', '10');
  const r = await call(h, 'GET', `?action=verify&booking_id=${b.id}`);
  assert.deepEqual([r.body.source, r.body.verified, b.payment_status], ['bog_order_mismatch', false, 'pending_payment']);
  h.net.receipts['bog-order-vm'] = receipt('bog-order-vm', 'other-booking', 'completed', '5000');
  assert.equal((await call(h, 'GET', `?action=verify&booking_id=${b.id}`)).body.source, 'bog_order_mismatch');
  assert.equal(h.db.bookingWrites().length, 0);
});

test('SEC internal actions are idempotent: a second refund / release / capture never reaches BOG', async () => {
  const h = harness();
  const b = seedBooking(h, { status: 'rejected', payment_status: 'paid', payment_transaction_id: 'bog-order-rf' });
  assert.deepEqual((await internal(h, 'internal-refund', b.id)).body, { success: true, paymentStatus: 'refund_pending' });
  const second = await internal(h, 'internal-refund', b.id);
  assert.deepEqual([second.status, second.body], [200, { success: true, skipped: 'already_done', paymentStatus: 'refund_pending' }]);
  b.payment_status = 'refunded';
  await internal(h, 'internal-refund', b.id);
  assert.equal(h.net.bogCalls().filter((c) => c.url.includes('/payment/refund/')).length, 1);

  const rel = harness();
  const b2 = seedBooking(rel, { payment_status: 'canceled', payment_transaction_id: 'bog-order-rl' });
  assert.equal((await internal(rel, 'internal-release', b2.id)).body.skipped, 'already_done');
  const b3 = seedBooking(rel, { payment_status: 'paid', payment_transaction_id: 'bog-order-cp' });
  assert.equal((await internal(rel, 'internal-capture', b3.id)).body.skipped, 'already_done');
  assert.equal(rel.net.bogCalls().length, 0);
});

test('SEC secretsEqual: exact match only; empty expected never matches', async () => {
  assert.equal(await secretsEqual(INTERNAL_KEY, INTERNAL_KEY), true);
  for (const wrong of ['', 'x', INTERNAL_KEY.toUpperCase(), INTERNAL_KEY.slice(1), INTERNAL_KEY + ' ', ` ${INTERNAL_KEY}`]) {
    assert.equal(await secretsEqual(wrong, INTERNAL_KEY), false, JSON.stringify(wrong));
  }
  assert.equal(await secretsEqual('', ''), false);
});

test('SEC receiptMatchesBooking rules', () => {
  const booking = { id: 'bk-1', total_price: 300, payment_transaction_id: 'ord-1' };
  const ok = receipt('ord-1', 'bk-1', 'completed', '300');
  assert.equal(receiptMatchesBooking(ok, booking, 'ord-1', true), true);
  assert.equal(receiptMatchesBooking(ok, booking, 'ord-2', true), false);
  assert.equal(receiptMatchesBooking(receipt('ord-1', 'bk-2', 'completed', '300'), booking, 'ord-1', true), false);
  assert.equal(receiptMatchesBooking(receipt('ord-1', 'bk-1', 'completed', '299'), booking, 'ord-1', true), false);
  assert.equal(receiptMatchesBooking(receipt('ord-1', 'bk-1', 'rejected', '1'), booking, 'ord-1', false), true, 'amount only matters for paid');
  assert.equal(receiptMatchesBooking(receipt('ord-1', 'bk-1', 'completed', 'abc'), booking, 'ord-1', true), false);
  assert.equal(receiptMatchesBooking(receipt('ord-9', 'bk-1', 'completed', '300'), { ...booking, payment_transaction_id: null }, 'ord-9', true), true);
  assert.equal(receiptMatchesBooking({ order_id: 'ord-9', purchase_units: { request_amount: '300', currency_code: 'GEL' } }, { ...booking, payment_transaction_id: null }, 'ord-9', true), false);
  assert.equal(receiptMatchesBooking(ok, booking, '', true), false);
});

test('SEC create-order: if the BOG order id cannot be stored, no checkout URL is returned and the booking fails', async () => {
  const h = harness();
  let updates = 0;
  h.db.failWhen = (t, op) => t === 'bookings' && op === 'update' && ++updates === 1;
  const r = await createOrder(h, orderBody());
  assert.equal(r.status, 500);
  assert.equal(r.body.checkoutUrl, undefined);
  assert.equal(h.db.rows('bookings')[0].status, 'payment_failed');
});

test('SEC errors are generic and logs carry no keys, provider responses or personal data', async () => {
  LOGS.length = 0;
  const secrets = [...Object.values(ENV), 'bog-access-token-secret', GUEST_EMAIL, GUEST_NAME, HOST_EMAIL];
  const leaky = ['secret-detail', 'internal-detail', 'bog action failed detail', 'secret_internal', '10.0.0.5', 'payload sent', 'client_id preview', 'bog-order-'];

  const token = harness();
  token.net.tokenOk = false;
  const t = await createOrder(token, orderBody());
  assert.deepEqual([t.status, t.body], [500, { error: 'Online payment is temporarily unavailable. Please try again later.' }]);

  const order = harness();
  order.net.orderCreateOk = false;
  assert.deepEqual((await createOrder(order, orderBody())).body, { error: 'Online payment is temporarily unavailable. Please try again later.' });
  assert.ok(!JSON.stringify(order.db.rows('booking_status_logs')).includes('internal-detail'));

  const redirect = harness();
  redirect.net.orderRedirect = null;
  assert.deepEqual((await createOrder(redirect, orderBody())).body, { error: 'Online payment is temporarily unavailable. Please try again later.' });

  const db = harness();
  db.db.rpcFail = (name) => name === 'create_booking_checked';
  assert.deepEqual((await createOrder(db, orderBody({ payment_method: 'pay_at_property' }))).body, { error: 'Could not create the booking. Please try again.' });
  assert.deepEqual((await createOrder(db, orderBody())).body, { error: 'Could not create the booking. Please try again.' });

  const refund = harness();
  const b = seedBooking(refund, { status: 'rejected', payment_status: 'paid', payment_transaction_id: 'bog-order-e' });
  refund.net.actionOk.refund = false;
  const rf = await internal(refund, 'internal-refund', b.id);
  assert.deepEqual([rf.status, rf.body], [500, { error: 'Payment provider request failed' }]);
  assert.deepEqual(refund.db.rows('booking_status_logs').map((l) => l.note), ['BOG request failed (400)']);

  // A full happy path, then inspect everything that was logged by all of the above.
  const all = harness();
  await createOrder(all, orderBody());
  const pb = all.db.rows('bookings')[0];
  all.net.receipts[pb.payment_transaction_id] = receipt(pb.payment_transaction_id, pb.id, 'completed', '300');
  await call(all, 'POST', '?action=callback', callbackBody(pb.payment_transaction_id, pb.id));
  await call(all, 'GET', `?action=verify&booking_id=${pb.id}`);
  const combined = [LOGS.join('\n'), t.text].join('\n');
  for (const v of [...secrets, ...leaky]) assert.ok(!combined.includes(v), `leaked: ${v.slice(0, 12)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOUBLE BOOKING (create_booking_checked / apply_paid_status)
// ═══════════════════════════════════════════════════════════════════════════════

const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

test('OVERLAP create-order on taken dates → 409 DATES_UNAVAILABLE, no BOG call, no email, no row (both modes)', async () => {
  for (const method of ['pay_now', 'pay_at_property']) {
    const h = harness();
    seedBooking(h, { status: 'confirmed', payment_status: 'paid', check_in: '2099-06-12', check_out: '2099-06-15' });
    const before = h.db.rows('bookings').length;
    const r = await createOrder(h, orderBody({ payment_method: method }));
    assert.deepEqual([r.status, r.body], [409, { error: 'DATES_UNAVAILABLE' }], method);
    assert.equal(h.db.rows('bookings').length, before);
    assert.equal(h.net.bogCalls().length, 0, 'no BOG token or order before the dates are secured');
    assert.equal(h.net.emails().length, 0);
    assert.deepEqual(h.db.rpcCalls.map((c) => c.name), ['create_booking_checked']);
  }
});

test('OVERLAP create-order goes through create_booking_checked with the verified identity and status', async () => {
  const h = harness();
  const r = await createOrder(h, orderBody());
  assert.equal(r.status, 200);
  const call0 = h.db.rpcCalls[0];
  assert.equal(call0.name, 'create_booking_checked');
  assert.deepEqual([call0.args.p_booking.status, call0.args.p_booking.customer_id, call0.args.p_booking.user_email, call0.args.p_booking.total_price], ['pending_payment', CUSTOMER_ID, GUEST_EMAIL, 300]);
  assert.equal(h.db.writes.filter((w) => w.table === 'bookings' && w.op === 'insert' && !w.filters.startsWith('rpc:')).length, 0, 'no direct booking insert');
});

test('OVERLAP host and imported blocks use today\'s rule (a block starting on check-out day blocks)', async () => {
  for (const table of ['blocked_dates', 'ical_blocked_dates']) {
    const h = harness();
    h.db.tables[table] = [{ id: 'blk', property_id: PROP, start_date: '2099-06-13', end_date: '2099-06-13' }];
    assert.equal((await createOrder(h, orderBody())).status, 409, table);
    const free = harness();
    free.db.tables[table] = [{ id: 'blk', property_id: PROP, start_date: '2099-06-14', end_date: '2099-06-20' }];
    assert.equal((await createOrder(free, orderBody())).status, 200, table);
  }
});

test('OVERLAP back-to-back stays succeed; a hold older than 20 minutes is released, a younger hold blocks', async () => {
  const h = harness();
  seedBooking(h, { status: 'confirmed', check_in: '2099-06-05', check_out: '2099-06-10' });
  assert.equal((await createOrder(h, orderBody())).status, 200, 'check-in on previous check-out day');

  const expired = harness();
  const old = seedBooking(expired, { created_at: iso(21 * 60_000) });
  assert.equal((await createOrder(expired, orderBody())).status, 200);
  assert.deepEqual([old.status, old.payment_status], ['payment_failed', 'payment_failed']);

  const young = harness();
  const hold = seedBooking(young, { created_at: iso(19 * 60_000) });
  assert.equal((await createOrder(young, orderBody())).status, 409);
  assert.equal(hold.status, 'pending_payment');
});

test('OVERLAP BOG order is created with ttl = 15 minutes', async () => {
  const h = harness();
  await createOrder(h, orderBody());
  assert.equal(JSON.parse(h.net.orderCreates()[0].body).ttl, 15);
});

test('OVERLAP late paid callback on taken dates → rejected (system), exactly one refund, guest + admin email, no host email', async () => {
  const h = harness();
  const late = seedBooking(h, { status: 'payment_failed', payment_status: 'payment_failed', payment_transaction_id: 'bog-order-late', created_at: iso(40 * 60_000) });
  seedBooking(h, { status: 'confirmed', payment_status: 'paid', payment_transaction_id: 'bog-order-other', check_in: '2099-06-11', check_out: '2099-06-14' });
  h.net.receipts['bog-order-late'] = receipt('bog-order-late', late.id, 'completed', '300');

  assert.equal((await call(h, 'POST', '?action=callback', callbackBody('bog-order-late', late.id))).text, 'ok');
  assert.deepEqual([late.status, late.canceled_by, late.rejection_note, late.payment_status], ['rejected', 'system', 'DATES_UNAVAILABLE_AFTER_PAYMENT', 'refund_pending']);
  const refunds = () => h.net.bogCalls().filter((c) => c.url.includes('/payment/refund/'));
  assert.deepEqual(refunds().map((c) => c.url), ['https://api.bog.ge/payments/v1/payment/refund/bog-order-late']);
  const mails = h.net.emails();
  assert.deepEqual(mails.map((e) => e.to).sort(), ['info.rentcottage@gmail.com', GUEST_EMAIL].sort());
  assert.match(mails.find((e) => e.to === GUEST_EMAIL)!.subject, /no longer available — full refund issued/);
  assert.match(mails.find((e) => e.to === GUEST_EMAIL)!.html, /full refund has been issued/i);
  assert.ok(!mails.some((e) => e.to === HOST_EMAIL));
  assert.deepEqual(h.db.rows('booking_status_logs').map((l) => l.event_type), ['bog_internal-refund_ok', 'paid_dates_unavailable']);

  // Duplicate callback and a verify poll: no second refund, no more emails.
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-late', late.id));
  const v = await call(h, 'GET', `?action=verify&booking_id=${late.id}`);
  assert.deepEqual([v.body.source, v.body.bookingStatus, v.body.verified], ['dates_unavailable', 'rejected', false]);
  assert.equal(refunds().length, 1);
  assert.equal(h.net.emails().length, 2);
});

test('OVERLAP verify detects the conflict first → one refund; a later callback does not refund again', async () => {
  const h = harness();
  const late = seedBooking(h, { status: 'pending_payment', payment_transaction_id: 'bog-order-v2', created_at: iso(10 * 60_000) });
  h.db.tables.ical_blocked_dates = [{ id: 'ical-new', property_id: PROP, start_date: '2099-06-12', end_date: '2099-06-14' }];
  h.net.receipts['bog-order-v2'] = receipt('bog-order-v2', late.id, 'completed', '300');
  const v = await call(h, 'GET', `?action=verify&booking_id=${late.id}`);
  assert.deepEqual([v.body.source, v.body.bookingStatus, v.body.paymentStatus, v.body.verified], ['dates_unavailable', 'rejected', 'refund_pending', false]);
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-v2', late.id));
  await call(h, 'GET', `?action=verify&booking_id=${late.id}`);
  assert.equal(h.net.bogCalls().filter((c) => c.url.includes('/payment/refund/')).length, 1);
  assert.equal(h.net.emails().filter((e) => e.to === GUEST_EMAIL).length, 1);
});

test('OVERLAP expired hold whose dates are still free is re-occupied by a late payment (normal paid flow)', async () => {
  const h = harness();
  const late = seedBooking(h, { status: 'payment_failed', payment_status: 'payment_failed', payment_transaction_id: 'bog-order-free', created_at: iso(40 * 60_000) });
  h.net.receipts['bog-order-free'] = receipt('bog-order-free', late.id, 'completed', '300');
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-free', late.id));
  assert.deepEqual([late.status, late.payment_status, late.approval_deadline], ['pending_host_approval', 'paid', new Date(NOW + 86_400_000).toISOString()]);
  assert.equal(h.net.bogCalls().filter((c) => c.url.includes('/payment/refund/')).length, 0);
  assert.deepEqual(h.db.rows('booking_status_logs').map((l) => l.event_type), ['bog_paid_pending_approval']);
  assert.ok(h.net.emails().some((e) => e.to === HOST_EMAIL));
});

test('OVERLAP refund failure on a conflict is surfaced to the admin and logged for manual refund', async () => {
  const h = harness();
  const late = seedBooking(h, { status: 'payment_failed', payment_status: 'payment_failed', payment_transaction_id: 'bog-order-rf', created_at: iso(40 * 60_000) });
  seedBooking(h, { status: 'confirmed', check_in: '2099-06-10', check_out: '2099-06-13' });
  h.net.receipts['bog-order-rf'] = receipt('bog-order-rf', late.id, 'completed', '300');
  h.net.actionOk.refund = false;
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-rf', late.id));
  assert.deepEqual([late.status, late.payment_status], ['rejected', 'paid']);
  assert.match(h.net.emails().find((e) => e.to === 'info.rentcottage@gmail.com')!.subject, /REFUND FAILED/);
  assert.match(h.db.rows('booking_status_logs').find((l) => l.event_type === 'paid_dates_unavailable')!.note, /manual refund required/);
});

test('OVERLAP an in-progress callback never re-occupies a released booking', async () => {
  const h = harness();
  const b = seedBooking(h, { status: 'payment_failed', payment_status: 'payment_failed', payment_transaction_id: 'bog-order-pr', created_at: iso(40 * 60_000) });
  h.net.receipts['bog-order-pr'] = receipt('bog-order-pr', b.id, 'processing');
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-pr', b.id));
  assert.deepEqual([b.status, b.payment_status], ['payment_failed', 'payment_failed']);
  assert.equal(h.db.bookingWrites().length, 0);
});
