// Tests for bog-payment. Supabase, BOG, Resend and hCaptcha are faked in memory:
// no network, no real payments, no secrets.
//
// Run (Node >= 22.18 / 24, built-in TypeScript type stripping):
//   node --test supabase/functions/bog-payment/handler.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from './handler.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ─── Console capture (handler logs are asserted on, and kept out of test output) ─

const LOGS: string[] = [];
for (const k of ['log', 'error', 'warn'] as const) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (console as any)[k] = (...args: unknown[]) => { LOGS.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
}

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

const NOW = Date.parse('2099-01-01T08:00:00Z');
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

interface H { db: FakeDb; net: FakeNet; handler: (r: Request) => Promise<Response> }

function harness(envOverride: Record<string, string | undefined> = {}): H {
  const db = new FakeDb(tables());
  const net = new FakeNet();
  const env = { ...ENV, ...envOverride };
  const handler = createHandler({
    db,
    fetch: net.fetch,
    env: (n) => env[n],
    envNames: () => Object.keys(env).filter((k) => env[k] !== undefined),
    now: () => NOW,
  });
  LOGS.length = 0;
  return { db, net, handler };
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

const createOrder = (h: H, body: Row, headers: Record<string, string> = {}) => call(h, 'POST', '?action=create-order', body, headers);

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

test('ROUTE OPTIONS → 200 ok; unknown action/method → 405', async () => {
  const h = harness();
  const opt = await call(h, 'OPTIONS', '');
  assert.deepEqual([opt.status, opt.text], [200, 'ok']);
  assert.equal((await call(h, 'GET', '?action=nope')).status, 405);
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

test('CREATE phone verification: no customer → 403; unverified or unknown profile → 403 PHONE_NOT_VERIFIED; nothing written', async () => {
  const h = harness();
  assert.equal((await createOrder(h, orderBody({ customer_id: undefined }))).status, 403);
  const unverified = await createOrder(h, orderBody({ customer_id: 'cust-unverified' }));
  assert.deepEqual([unverified.status, unverified.body.error], [403, 'PHONE_NOT_VERIFIED']);
  assert.equal((await createOrder(h, orderBody({ customer_id: 'cust-missing' }))).body.error, 'PHONE_NOT_VERIFIED');
  assert.equal(h.db.writes.length, 0);
  assert.equal(h.net.bogCalls().length, 0);
});

test('CREATE required fields, dates and property checks → 400/404 before any write', async () => {
  const h = harness();
  for (const f of ['user_email', 'property_title', 'check_in', 'check_out', 'total_price']) {
    const r = await createOrder(h, orderBody({ [f]: undefined }));
    assert.deepEqual([r.status, r.body.error], [400, `Missing required field: ${f}`], f);
  }
  assert.equal((await createOrder(h, orderBody({ total_price: 'abc' }))).status, 400);
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
  assert.equal((await createOrder(h, orderBody({ ...base, guests: 2, total_price: 160 }))).status, 200);
  assert.equal((await createOrder(h, orderBody({ ...base, guests: 4, total_price: 240 }))).status, 200);
  assert.equal((await createOrder(h, orderBody({ ...base, guests: 9, total_price: 240 }))).status, 200);
  assert.equal((await createOrder(h, orderBody({ ...base, guests: 4, total_price: 160 }))).body.error?.startsWith('PRICE_MISMATCH'), true);
  assert.deepEqual(h.db.rows('bookings').map((b) => b.total_price), [160, 240, 240]);
});

test('PRICE promo: discounted total accepted and recorded; full price still accepted without recording a discount', async () => {
  const h = harness();
  h.db.tables.promos = [{ id: 'promo-1', active: true, discount_percent: 10, location: 'Batumi', starts_at: null, ends_at: null, created_at: '2026-01-01', title: 'Sea' }];
  assert.equal((await createOrder(h, orderBody({ total_price: 270 }))).status, 200);
  assert.equal((await createOrder(h, orderBody({ total_price: 300 }))).status, 200);
  const [disc, full] = h.db.rows('bookings');
  assert.deepEqual([disc.total_price, disc.promo_id, disc.promo_discount_percent, disc.pre_discount_total], [270, 'promo-1', 10, 300]);
  assert.deepEqual([full.total_price, full.promo_id, full.pre_discount_total], [300, null, null]);
});

test('PRICE host offer (free nights) vs promo: cheapest single discount is matched, never stacked', async () => {
  const h = harness();
  h.db.tables.promos = [{ id: 'promo-1', active: true, discount_percent: 10, location: 'Batumi', starts_at: null, ends_at: null, created_at: '2026-01-01' }];
  h.db.tables.host_offers = [{ id: 'offer-1', property_id: PROP, active: true, offer_type: 'free_nights', buy_nights: 2, free_nights: 1, discount_percent: null, starts_at: null, ends_at: null, created_at: '2026-01-01' }];
  assert.equal((await createOrder(h, orderBody({ total_price: 200 }))).status, 200);          // 3 nights, 1 free
  assert.equal((await createOrder(h, orderBody({ total_price: 270 }))).status, 200);          // promo candidate still valid
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
  const r2 = await createOrder(h, orderBody({ ...base, corporate_id: 'corp-pending' }));
  const r3 = await createOrder(h, orderBody({ ...base, corporate_id: 'corp-other' }));
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
  for (const [action, path, status] of [['internal-capture', 'authorization/approve', 'paid'], ['internal-release', 'authorization/cancel', 'canceled'], ['internal-refund', 'refund', 'refund_pending']]) {
    const h = harness();
    const b = seedBooking(h, { status: 'confirmed', payment_status: 'paid', payment_transaction_id: 'bog-order-i' });
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

test('INTERNAL wrong, missing or unconfigured key → 403 with no BOG call and no write', async () => {
  const h = harness();
  const b = seedBooking(h, { status: 'rejected', payment_status: 'paid' });
  for (const key of ['wrong', '', null, INTERNAL_KEY.slice(0, -1), INTERNAL_KEY + 'x']) {
    const r = await internal(h, 'internal-refund', b.id, key);
    assert.deepEqual([r.status, r.body], [403, { error: 'Forbidden' }]);
  }
  const unconfigured = harness({ INTERNAL_API_KEY: undefined });
  const b2 = seedBooking(unconfigured, { status: 'rejected', payment_status: 'paid' });
  assert.equal((await internal(unconfigured, 'internal-refund', b2.id, '')).status, 403);
  assert.equal(h.net.bogCalls().length + unconfigured.net.bogCalls().length, 0);
  assert.equal(h.db.bookingWrites().length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CURRENT (pre-hardening) behaviour, pinned so the security commit's changes are
// explicit. Each of these is replaced by a SECURITY test in the next commit.
// ═══════════════════════════════════════════════════════════════════════════════

test('CURRENT debug-credentials is public: 200 with presence/length flags and env var names (no values)', async () => {
  const h = harness();
  const r = await call(h, 'GET', '?action=debug-credentials');
  assert.equal(r.status, 200);
  assert.equal(r.body.credentials['Test Secret Key present'], true);
  for (const v of Object.values(ENV)) assert.ok(!r.text.includes(v));
});

test('CURRENT create-order trusts body customer_id and user_email; no Authorization header needed', async () => {
  const h = harness();
  const r = await createOrder(h, orderBody({ user_email: 'anyone@example.test', payment_method: 'pay_at_property' }));
  assert.equal(r.status, 200);
  assert.deepEqual([h.db.rows('bookings')[0].customer_id, h.db.rows('bookings')[0].user_email], [CUSTOMER_ID, 'anyone@example.test']);
});

test('CURRENT mark-failed downgrades a booking BOG still reports as in progress', async () => {
  const h = harness();
  const b = seedBooking(h, { payment_transaction_id: 'bog-order-inprog' });
  h.net.receipts['bog-order-inprog'] = receipt('bog-order-inprog', b.id, 'processing');
  await call(h, 'GET', `?action=mark-failed&booking_id=${b.id}`);
  assert.equal(b.status, 'payment_failed');
});

test('CURRENT forged callback: another completed order id + victim external_order_id marks the victim booking paid', async () => {
  const h = harness();
  const victim = seedBooking(h, { total_price: 5000, payment_transaction_id: 'bog-order-victim' });
  h.net.receipts['bog-order-cheap'] = receipt('bog-order-cheap', 'some-other-booking', 'completed', '1');
  await call(h, 'POST', '?action=callback', callbackBody('bog-order-cheap', victim.id));
  assert.deepEqual([victim.payment_status, victim.status, victim.payment_transaction_id], ['paid', 'pending_host_approval', 'bog-order-cheap']);
});

test('CURRENT internal-refund is not idempotent: a second call refunds again at BOG', async () => {
  const h = harness();
  const b = seedBooking(h, { status: 'rejected', payment_status: 'paid', payment_transaction_id: 'bog-order-rf' });
  await internal(h, 'internal-refund', b.id);
  await internal(h, 'internal-refund', b.id);
  assert.equal(h.net.bogCalls().filter((c) => c.url.includes('/payment/refund/')).length, 2);
});

test('CURRENT error responses and logs expose BOG detail and a partial client id', async () => {
  const h = harness();
  h.net.tokenOk = false;
  const r = await createOrder(h, orderBody());
  assert.match(r.body.error, /secret-detail/);
  const ok = harness();
  await createOrder(ok, orderBody());
  assert.ok(LOGS.some((l) => l.includes('client_id preview')));
});
