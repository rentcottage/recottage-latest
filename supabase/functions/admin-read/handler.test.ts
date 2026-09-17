// Tests for admin-read. Supabase is faked in memory; no network, no secrets.
//
// Run: node --test supabase/functions/admin-read/handler.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, BOOKING_HISTORY_COLUMNS, PAYMENT_LOG_COLUMNS, createHandler, passwordMatches } from './handler.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const PASSWORD = 'correct-horse-Battery-staple-42';
const BOOKING_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const BOOKING_B = 'bbbbbbbb-2222-4222-8222-222222222222';

class FakeDb {
  calls: { table: string; select?: string; filters: string[]; order?: string; limit?: number }[] = [];
  fail = false;
  rows: Row[] = [
    { id: 'l1', booking_id: BOOKING_A, event_type: 'created', from_status: null, to_status: 'pending_host_approval', changed_by: 'system', note: 'note-a1', created_at: '2026-09-17T10:00:00Z' },
    { id: 'l2', booking_id: BOOKING_B, event_type: 'bog_paid_pending_approval', from_status: 'pending_payment', to_status: 'pending_host_approval', changed_by: 'bog_callback', note: 'note-b1', created_at: '2026-09-17T11:00:00Z' },
    { id: 'l3', booking_id: BOOKING_A, event_type: 'host_approved', from_status: 'pending_host_approval', to_status: 'confirmed', changed_by: 'host', note: null, created_at: '2026-09-17T12:00:00Z' },
  ];
  from(table: string) {
    const call: FakeDb['calls'][number] = { table, filters: [] };
    this.calls.push(call);
    let rows = [...this.rows];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const db = this;
    const q = {
      select(cols: string) { call.select = cols; return q; },
      eq(c: string, v: string) { call.filters.push(`${c}=${v}`); rows = rows.filter((r) => String(r[c]) === v); return q; },
      lt(c: string, v: string) { call.filters.push(`${c}<${v}`); rows = rows.filter((r) => String(r[c]) < v); return q; },
      order(c: string, o: { ascending: boolean }) { call.order = `${c}:${o.ascending ? 'asc' : 'desc'}`; rows.sort((a, b) => (a[c] < b[c] ? -1 : 1) * (o.ascending ? 1 : -1)); return q; },
      limit(n: number) { call.limit = n; rows = rows.slice(0, n); return q; },
      then(resolve: (v: Row) => void) {
        if (db.fail) return resolve({ data: null, error: { message: 'relation secret_table violates something host=10.0.0.9' } });
        const withJoin = (call.select ?? '').includes('booking:bookings')
          ? rows.map((r) => ({ ...r, booking: { user_email: 'g@example.test', user_name: 'G', property_title: 'T', total_price: 1, payment_status: 'paid', payment_method: 'pay_now' } }))
          : rows;
        resolve({ data: withJoin, error: null });
      },
    };
    return q;
  }
}

// Passing { adminPassword: undefined } explicitly simulates an unset secret
// (a default parameter would silently replace undefined).
function harness(opts: { adminPassword?: string } = { adminPassword: PASSWORD }) {
  const adminPassword = 'adminPassword' in opts ? opts.adminPassword : PASSWORD;
  const db = new FakeDb();
  const logs: string[] = [];
  const handler = createHandler({ db, adminPassword, log: (e, f) => logs.push(`${e} ${JSON.stringify(f ?? {})}`) });
  const call = async (body: unknown, headers: Record<string, string> = { 'x-admin-password': PASSWORD }, method = 'POST') => {
    const res = await handler(new Request('https://fn.local/admin-read', {
      method, headers: { 'Content-Type': 'application/json', Origin: 'https://rentcottage.ge', ...headers },
      body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let json: Row = {};
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, body: json, text, headers: res.headers };
  };
  return { db, logs, call };
}

test('AUTH missing, empty, wrong, wrong-case, prefix and suffix passwords → 401 with zero DB calls', async () => {
  const h = harness();
  const bad: Record<string, string>[] = [
    {}, { 'x-admin-password': '' }, { 'x-admin-password': 'wrong' }, { 'x-admin-password': PASSWORD.toUpperCase() },
    // (Surrounding whitespace is trimmed by the Fetch Headers API itself, so it cannot be tested here.)
    { 'x-admin-password': PASSWORD.slice(0, -1) }, { 'x-admin-password': PASSWORD + 'x' }, { 'x-admin-password': `${PASSWORD} ${PASSWORD}` },
    { Authorization: `Bearer ${PASSWORD}` },
  ];
  for (const headers of bad) {
    for (const action of ['booking-history', 'payment-logs', 'nope']) {
      const r = await h.call({ action, booking_id: BOOKING_A, adminPassword: PASSWORD }, headers);
      assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }], JSON.stringify(headers));
    }
  }
  assert.equal(h.db.calls.length, 0);
});

test('AUTH ADMIN_PANEL_PASSWORD unset or empty → 401 even with any header', async () => {
  for (const configured of [undefined, '']) {
    const h = harness({ adminPassword: configured });
    for (const pw of ['', 'anything', PASSWORD]) {
      assert.equal((await h.call({ action: 'payment-logs' }, { 'x-admin-password': pw })).status, 401);
    }
    assert.equal(h.db.calls.length, 0);
  }
  assert.equal(await passwordMatches('', ''), false);
  assert.equal(await passwordMatches(PASSWORD, PASSWORD), true);
});

test('METHODS GET/PUT/DELETE → 405; OPTIONS → 200 with CORS only for allowed origins', async () => {
  const h = harness();
  for (const m of ['GET', 'PUT', 'DELETE', 'PATCH']) assert.equal((await h.call(undefined, {}, m)).status, 405, m);
  for (const [origin, allowed] of [['https://rentcottage.ge', true], ['https://www.rentcottage.ge', true], ['http://localhost:5173', true], ['http://127.0.0.1:3000', true],
    ['https://evil.example', false], ['https://rentcottage.ge.evil.example', false], ['http://rentcottage.ge', false], ['null', false]] as [string, boolean][]) {
    const r = await h.call(undefined, { Origin: origin }, 'OPTIONS');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('access-control-allow-origin'), allowed ? origin : null, origin);
    assert.match(r.headers.get('access-control-allow-headers') ?? '', /x-admin-password/);
  }
  assert.equal(h.db.calls.length, 0);
});

test('INPUT invalid JSON, unknown action, invalid booking_id, limit and before → 400 before any DB call', async () => {
  const h = harness();
  assert.equal((await h.call('not json')).status, 400);
  assert.deepEqual((await h.call({ action: 'delete-everything' })).body, { error: 'Unsupported action' });
  assert.deepEqual((await h.call({ action: '__proto__' })).body, { error: 'Unsupported action' });
  assert.deepEqual((await h.call({ action: 'toString' })).body, { error: 'Unsupported action' });
  for (const id of [undefined, '', 'abc', `${BOOKING_A}x`, `'; drop table x; --`, 123]) {
    assert.deepEqual((await h.call({ action: 'booking-history', booking_id: id })).body, { error: 'Invalid booking_id' }, String(id));
  }
  for (const limit of [0, -1, 201, 1000, 1.5, '50', null]) {
    assert.deepEqual((await h.call({ action: 'payment-logs', limit })).body, { error: 'Invalid limit' }, String(limit));
  }
  for (const before of ['yesterday', '2026-09-17', 123, '2026-13-45T99:99:99Z']) {
    assert.equal((await h.call({ action: 'payment-logs', before })).status, 400, String(before));
  }
  assert.equal(h.db.calls.length, 0);
});

test('booking-history returns only that booking\'s logs with the panel\'s fields, oldest first', async () => {
  const h = harness();
  const r = await h.call({ action: 'booking-history', booking_id: BOOKING_A.toUpperCase() });
  assert.equal(r.status, 200);
  assert.deepEqual(h.db.calls, [{ table: 'booking_status_logs', select: BOOKING_HISTORY_COLUMNS, filters: [`booking_id=${BOOKING_A}`], order: 'created_at:asc' }]);
  assert.deepEqual(r.body.logs.map((l: Row) => l.id), ['l1', 'l3']);
  assert.equal(BOOKING_HISTORY_COLUMNS, 'id, event_type, from_status, to_status, changed_by, note, created_at');
});

test('payment-logs: newest first, default and custom limit (≤200), before cursor, bookings join done server-side', async () => {
  const h = harness();
  const r = await h.call({ action: 'payment-logs' });
  assert.equal(r.status, 200);
  assert.deepEqual(h.db.calls[0], { table: 'booking_status_logs', select: PAYMENT_LOG_COLUMNS, filters: [], order: 'created_at:desc', limit: 200 });
  assert.deepEqual(r.body.logs.map((l: Row) => l.id), ['l3', 'l2', 'l1']);
  assert.deepEqual(Object.keys(r.body.logs[0].booking).sort(), ['payment_method', 'payment_status', 'property_title', 'total_price', 'user_email', 'user_name']);
  assert.match(PAYMENT_LOG_COLUMNS, /booking:bookings\(user_email, user_name, property_title, total_price, payment_status, payment_method\)/);

  const page = await h.call({ action: 'payment-logs', limit: 1, before: '2026-09-17T12:00:00Z' });
  assert.deepEqual(h.db.calls[1].filters, ['created_at<2026-09-17T12:00:00Z']);
  assert.equal(h.db.calls[1].limit, 1);
  assert.deepEqual(page.body.logs.map((l: Row) => l.id), ['l2']);
  assert.equal((await h.call({ action: 'payment-logs', limit: 200 })).status, 200);
});

test('ERRORS database failure → generic 500 without internal detail', async () => {
  const h = harness();
  h.db.fail = true;
  for (const body of [{ action: 'booking-history', booking_id: BOOKING_A }, { action: 'payment-logs' }]) {
    const r = await h.call(body);
    assert.deepEqual([r.status, r.body], [500, { error: 'Request failed' }]);
    assert.ok(!r.text.includes('secret_table') && !r.text.includes('10.0.0.9'));
  }
});

test('PRIVACY the password and header never appear in logs or responses', async () => {
  const h = harness();
  await h.call({ action: 'payment-logs' });
  await h.call({ action: 'booking-history', booking_id: BOOKING_A });
  await h.call({ action: 'payment-logs' }, { 'x-admin-password': 'wrong-guess-value' });
  await h.call({ action: 'nope' });
  const all = h.logs.join('\n');
  for (const secret of [PASSWORD, 'wrong-guess-value', 'x-admin-password']) assert.ok(!all.includes(secret), secret);
  const r = await h.call({ action: 'payment-logs' });
  assert.ok(!r.text.includes(PASSWORD));
  assert.ok(!all.includes('note-a1') && !all.includes('g@example.test'), 'no row content in logs');
});

test('ACTIONS registry contains exactly the read actions', () => {
  assert.deepEqual(Object.keys(ACTIONS).sort(), ['booking-history', 'payment-logs']);
});
