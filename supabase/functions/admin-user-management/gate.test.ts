// Tests for the admin-user-management gate, and specifically for verify-admin —
// the admin panel's login endpoint, which is the one an attacker guesses
// against. No network, no secrets, no Deno globals.
//
// Run: node --test supabase/functions/admin-user-management/gate.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUNCTION_NAME, PUBLIC_ACTIONS, gate, isPublicAction } from './gate.ts';
import { FAILURES_TABLE, MAX_FAILURES, WINDOW_MS } from '../_shared/adminAuth.ts';

const PASSWORD = 'correct-horse-Battery-staple-42';
const GATED = ['verify-admin', 'fetch-users', 'delete-user', 'block-email', 'unblock-email', 'fetch-blocked'];

/** In-memory stand-in for the service-role client (failures table only). */
class FakeDb {
  rows: { ip_hash: string; function_name: string; failed_at: number }[] = [];
  now = Date.now();

  from(table: string) {
    assert.equal(table, FAILURES_TABLE, 'the gate must only touch the failures table');
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const db = this;
    let ip: string | null = null;
    let since = 0;
    const q = {
      select(_c: string, _o: { count: string; head: boolean }) { return q; },
      eq(_c: string, v: string) { ip = v; return q; },
      gte(_c: string, v: string) { since = Date.parse(v); return q; },
      then(resolve: (v: { count: number; error: null }) => void) {
        resolve({ count: db.rows.filter((r) => r.ip_hash === ip && r.failed_at >= since).length, error: null });
      },
    };
    return {
      ...q,
      insert(row: { ip_hash: string; function_name: string }) {
        db.rows.push({ ...row, failed_at: db.now });
        return Promise.resolve({ error: null });
      },
    };
  }
}

const jsonErr = (msg: string, status: number) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });

function harness(opts: { adminPassword?: string } = { adminPassword: PASSWORD }) {
  const adminPassword = 'adminPassword' in opts ? opts.adminPassword : PASSWORD;
  const db = new FakeDb();
  let client = 0;
  const call = async (
    action: unknown,
    headers: Record<string, string> = {},
    body: Record<string, unknown> = {},
  ) => {
    const req = new Request('https://fn.local/admin-user-management', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.0.${++client}`, ...headers },
      body: JSON.stringify({ action, ...body }),
    });
    const res = await gate(req, action, { db, adminPassword, jsonErr });
    if (!res) return { allowed: true as const, status: 0, body: {} as Record<string, unknown> };
    return { allowed: false as const, status: res.status, body: await res.json() as Record<string, unknown> };
  };
  return { db, call };
}

// ── The password comes from the header only ──────────────────────────────────

test('verify-admin accepts the password in the header', async () => {
  const h = harness();
  const r = await h.call('verify-admin', { 'x-admin-password': PASSWORD });
  assert.equal(r.allowed, true, 'a correct password must pass the gate');
  assert.equal(h.db.rows.length, 0, 'a success records no failure');
});

test('verify-admin ignores a password in the body', async () => {
  const h = harness();
  const r = await h.call('verify-admin', {}, { adminPassword: PASSWORD });
  assert.equal(r.allowed, false);
  assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }]);
});

test('every gated action, verify-admin included, is refused without the header', async () => {
  const h = harness();
  for (const action of GATED) {
    const r = await h.call(action, {}, { adminPassword: PASSWORD });
    assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }], action);
  }
});

// ── Identical answers ────────────────────────────────────────────────────────

test('missing, empty, wrong-length and wrong-value passwords give byte-identical 401s', async () => {
  const h = harness();
  const answers: string[] = [];
  for (const headers of [
    {},
    { 'x-admin-password': '' },
    { 'x-admin-password': 'x' },
    { 'x-admin-password': 'x'.repeat(4096) },
    { 'x-admin-password': PASSWORD.slice(0, -1) },
    { 'x-admin-password': PASSWORD + 'x' },
    { 'x-admin-password': PASSWORD.toUpperCase() },
  ]) {
    const r = await h.call('verify-admin', headers);
    answers.push(`${r.status} ${JSON.stringify(r.body)}`);
  }
  assert.equal(new Set(answers).size, 1, `answers differ: ${[...new Set(answers)].join(' | ')}`);
  assert.equal(answers[0], '401 {"error":"Unauthorized"}');
});

test('an unset or empty secret denies verify-admin', async () => {
  for (const adminPassword of [undefined, '']) {
    const h = harness({ adminPassword });
    const r = await h.call('verify-admin', { 'x-admin-password': PASSWORD });
    assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }], String(adminPassword));
    const empty = await h.call('verify-admin', { 'x-admin-password': '' });
    assert.deepEqual([empty.status, empty.body], [401, { error: 'Unauthorized' }]);
  }
});

// ── Public actions ───────────────────────────────────────────────────────────

test('the public signup checks stay open and never touch the throttle', async () => {
  const h = harness();
  for (const action of PUBLIC_ACTIONS) {
    const r = await h.call(action);
    assert.equal(r.allowed, true, action);
  }
  assert.equal(h.db.rows.length, 0, 'public calls must not record admin failures');
  assert.equal(isPublicAction('verify-admin'), false);
  assert.equal(isPublicAction('fetch-users'), false);
  assert.equal(isPublicAction(undefined), false);
});

test('a throttled client can still use the public signup checks', async () => {
  const h = harness();
  const client = { 'x-forwarded-for': '203.0.113.7' };
  for (let i = 0; i < MAX_FAILURES; i++) await h.call('verify-admin', { ...client, 'x-admin-password': 'wrong' });
  const blocked = await h.call('verify-admin', { ...client, 'x-admin-password': 'wrong' });
  assert.equal(blocked.status, 429);
  for (const action of PUBLIC_ACTIONS) {
    assert.equal((await h.call(action, client)).allowed, true, `${action} must stay available`);
  }
});

// ── Throttle ─────────────────────────────────────────────────────────────────

test('10 failed logins from one client → 429, and the correct password is refused too', async () => {
  const h = harness();
  const client = { 'x-forwarded-for': '203.0.113.7' };
  for (let i = 0; i < MAX_FAILURES; i++) {
    const r = await h.call('verify-admin', { ...client, 'x-admin-password': `guess-${i}` });
    assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }], `attempt ${i + 1}`);
  }
  const eleventh = await h.call('verify-admin', { ...client, 'x-admin-password': 'guess-10' });
  assert.deepEqual([eleventh.status, eleventh.body], [429, { error: 'Too many attempts' }]);

  const correct = await h.call('verify-admin', { ...client, 'x-admin-password': PASSWORD });
  assert.deepEqual([correct.status, correct.body], [429, { error: 'Too many attempts' }]);
  assert.equal(h.db.rows.length, MAX_FAILURES, 'throttled attempts must not extend the block');
});

test('the block lifts once the window has passed', async () => {
  const h = harness();
  const client = { 'x-forwarded-for': '203.0.113.7' };
  for (let i = 0; i < MAX_FAILURES; i++) await h.call('verify-admin', { ...client, 'x-admin-password': 'wrong' });
  assert.equal((await h.call('verify-admin', { ...client, 'x-admin-password': PASSWORD })).status, 429);

  // Age every recorded failure past the window.
  for (const row of h.db.rows) row.failed_at -= WINDOW_MS + 1000;
  const after = await h.call('verify-admin', { ...client, 'x-admin-password': PASSWORD });
  assert.equal(after.allowed, true, 'the client must be able to log in again after the window');
});

test('another client is unaffected while one is throttled', async () => {
  const h = harness();
  for (let i = 0; i < MAX_FAILURES; i++) {
    await h.call('verify-admin', { 'x-forwarded-for': '203.0.113.7', 'x-admin-password': 'wrong' });
  }
  const other = await h.call('verify-admin', { 'x-forwarded-for': '198.51.100.9', 'x-admin-password': PASSWORD });
  assert.equal(other.allowed, true);
});

test('the throttle is keyed by client, not by action or function — it cannot be sidestepped', async () => {
  const h = harness();
  const client = { 'x-forwarded-for': '203.0.113.7' };
  // Spread the ten failures across every gated action …
  for (let i = 0; i < MAX_FAILURES; i++) {
    const action = GATED[i % GATED.length];
    const r = await h.call(action, { ...client, 'x-admin-password': `guess-${i}` });
    assert.equal(r.status, 401, `${action} attempt ${i + 1}`);
  }
  // … and every one of them still counts against the same client budget.
  for (const action of GATED) {
    const r = await h.call(action, { ...client, 'x-admin-password': 'wrong' });
    assert.deepEqual([r.status, r.body], [429, { error: 'Too many attempts' }], action);
  }
  assert.ok(new Set(h.db.rows.map((r) => r.function_name)).has(FUNCTION_NAME));
});

test('failures recorded by the other two functions count here as well', async () => {
  const h = harness();
  const clientHash = h.db.rows; // populated below through the gate itself
  const client = { 'x-forwarded-for': '203.0.113.7' };
  // Five failures through this function …
  for (let i = 0; i < 5; i++) await h.call('verify-admin', { ...client, 'x-admin-password': 'wrong' });
  assert.equal(clientHash.length, 5);
  // … and five already recorded by admin-read / admin-host-actions for the
  // same client (same ip_hash, different function_name).
  const ipHash = clientHash[0].ip_hash;
  for (const fn of ['admin-read', 'admin-host-actions', 'admin-read', 'admin-host-actions', 'admin-read']) {
    h.db.rows.push({ ip_hash: ipHash, function_name: fn, failed_at: h.db.now });
  }
  const r = await h.call('verify-admin', { ...client, 'x-admin-password': PASSWORD });
  assert.deepEqual([r.status, r.body], [429, { error: 'Too many attempts' }],
    'failures from the sibling functions must count towards the same budget');
});

test('the throttle stores a hash, never the raw client address', async () => {
  const h = harness();
  for (let i = 0; i < 3; i++) {
    await h.call('verify-admin', { 'x-forwarded-for': '203.0.113.7, 70.41.3.18', 'x-admin-password': 'wrong' });
  }
  for (const row of h.db.rows) {
    assert.match(row.ip_hash, /^[0-9a-f]{64}$/);
    assert.equal(row.ip_hash.includes('203.0.113'), false);
    assert.equal(row.function_name, FUNCTION_NAME);
  }
});
