// Tests for the shared admin gate: header-only password, constant-time
// comparison that leaks no length, fail-closed behaviour, and the 10-in-15-
// minutes throttle. No network, no secrets, no Deno globals.
//
// Run: node --test supabase/functions/_shared/adminAuth.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FAILURES,
  WINDOW_MS,
  FAILURES_TABLE,
  authorizeAdmin,
  clientKey,
  isThrottled,
  passwordMatches,
  providedPassword,
  recordFailure,
} from './adminAuth.ts';

const PASSWORD = 'correct-horse-Battery-staple-42';

/** In-memory stand-in for the service-role client, only for FAILURES_TABLE. */
class FakeDb {
  rows: { ip_hash: string; function_name: string; failed_at: number }[] = [];
  now = Date.now();
  selectError: unknown = null;
  insertCalls = 0;

  from(table: string) {
    assert.equal(table, FAILURES_TABLE, 'the gate must only touch the failures table');
    const self = this;
    let ip: string | null = null;
    let since = 0;
    const query = {
      select(_cols: string, _opts: { count: string; head: boolean }) { return query; },
      eq(col: string, value: string) { assert.equal(col, 'ip_hash'); ip = value; return query; },
      gte(col: string, value: string) {
        assert.equal(col, 'failed_at');
        since = Date.parse(value);
        return query;
      },
      then(resolve: (r: { count: number | null; error: unknown }) => void) {
        if (self.selectError) return resolve({ count: null, error: self.selectError });
        const count = self.rows.filter((r) => r.ip_hash === ip && r.failed_at >= since).length;
        resolve({ count, error: null });
      },
    };
    return {
      ...query,
      insert(row: { ip_hash: string; function_name: string }) {
        self.insertCalls++;
        self.rows.push({ ...row, failed_at: self.now });
        return Promise.resolve({ error: null });
      },
    };
  }
}

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/fn', { method: 'POST', headers });
}

// ── Password comparison ──────────────────────────────────────────────────────

test('correct password matches, wrong password does not', async () => {
  assert.equal(await passwordMatches(PASSWORD, PASSWORD), true);
  assert.equal(await passwordMatches(PASSWORD + 'x', PASSWORD), false);
  assert.equal(await passwordMatches('', PASSWORD), false);
});

test('fails closed when the secret is unset or empty', async () => {
  assert.equal(await passwordMatches(PASSWORD, undefined), false);
  assert.equal(await passwordMatches(PASSWORD, ''), false);
  assert.equal(await passwordMatches('', ''), false);
});

test('a wrong-length password is rejected the same way as a wrong value', async () => {
  assert.equal(await passwordMatches('short', PASSWORD), false);
  assert.equal(await passwordMatches('x'.repeat(4096), PASSWORD), false);
  assert.equal(await passwordMatches(PASSWORD.slice(0, -1) + 'X', PASSWORD), false);
});

test('the length of the password never short-circuits the comparison', async () => {
  // The leak this replaces (admin-host-actions v67) was an early return on a
  // length mismatch: a wrong-length guess came back before any hashing, so the
  // response time told an attacker the secret's length. Both sides must be
  // hashed and the full digest compared on EVERY path, so count the work.
  const lengths: number[] = [];
  let calls = 0;
  const counting = async (v: string) => {
    calls++;
    lengths.push(v.length);
    return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  };
  for (const guess of ['', 'x', 'short', 'x'.repeat(4096), PASSWORD.slice(0, -1), PASSWORD + 'x', PASSWORD]) {
    calls = 0;
    await passwordMatches(guess, PASSWORD, counting);
    assert.equal(calls, 2, `guess of length ${guess.length} hashed ${calls} value(s), not both`);
  }
  assert.ok(lengths.some((l) => l !== PASSWORD.length), 'sanity: wrong-length guesses were exercised');
});

// ── Header only ──────────────────────────────────────────────────────────────

test('the password is read from the header only', () => {
  assert.equal(providedPassword(req({ 'x-admin-password': PASSWORD })), PASSWORD);
  assert.equal(providedPassword(req()), '');
});

test('a password in the body is ignored', async () => {
  const db = new FakeDb();
  const request = new Request('https://example.test/fn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'fetch-all', adminPassword: PASSWORD }),
  });
  const outcome = await authorizeAdmin(request, { db, adminPassword: PASSWORD, functionName: 'test' });
  assert.deepEqual(outcome, { ok: false, status: 401 });
});

// ── Client key ───────────────────────────────────────────────────────────────

test('the client key is a hash of the first x-forwarded-for hop, never the raw IP', async () => {
  const a = await clientKey(req({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' }));
  const b = await clientKey(req({ 'x-forwarded-for': '203.0.113.7' }));
  const c = await clientKey(req({ 'x-forwarded-for': '203.0.113.8' }));
  assert.equal(a, b, 'later hops must not change the bucket');
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes('203.0.113'));
  assert.match(await clientKey(req()), /^[0-9a-f]{64}$/, 'a missing header still gets a bucket');
});

// ── Throttle ─────────────────────────────────────────────────────────────────

test('throttles after MAX_FAILURES in the window and lets the window expire', async () => {
  const db = new FakeDb();
  const ip = 'hash-a';
  for (let i = 0; i < MAX_FAILURES - 1; i++) await recordFailure(db, ip, 'test');
  assert.equal(await isThrottled(db, ip), false, `${MAX_FAILURES - 1} failures must still be allowed`);

  await recordFailure(db, ip, 'test');
  assert.equal(await isThrottled(db, ip), true);

  // One second past the window, the same failures no longer count.
  const later = new Date(Date.now() + WINDOW_MS + 1000);
  assert.equal(await isThrottled(db, ip, later), false);
});

test('one client being throttled does not affect another, and success clears nothing', async () => {
  const db = new FakeDb();
  for (let i = 0; i < MAX_FAILURES; i++) await recordFailure(db, 'hash-a', 'test');
  assert.equal(await isThrottled(db, 'hash-a'), true);
  assert.equal(await isThrottled(db, 'hash-b'), false);

  // A successful login from hash-b writes nothing at all …
  const before = db.rows.length;
  const ok = await authorizeAdmin(
    req({ 'x-admin-password': PASSWORD, 'x-forwarded-for': '198.51.100.9' }),
    { db, adminPassword: PASSWORD, functionName: 'test' },
  );
  assert.deepEqual(ok, { ok: true });
  assert.equal(db.rows.length, before, 'a success must not clear or add failures');
  // … so hash-a is still blocked.
  assert.equal(await isThrottled(db, 'hash-a'), true);
});

test('authorizeAdmin returns 429 once the client is throttled, without checking the password', async () => {
  const db = new FakeDb();
  const headers = { 'x-forwarded-for': '203.0.113.7' };
  for (let i = 0; i < MAX_FAILURES; i++) {
    const outcome = await authorizeAdmin(req({ ...headers, 'x-admin-password': 'wrong' }), {
      db, adminPassword: PASSWORD, functionName: 'test',
    });
    assert.deepEqual(outcome, { ok: false, status: 401 }, `attempt ${i + 1} should be a plain 401`);
  }
  assert.equal(db.insertCalls, MAX_FAILURES);

  const throttled = await authorizeAdmin(req({ ...headers, 'x-admin-password': 'wrong' }), {
    db, adminPassword: PASSWORD, functionName: 'test',
  });
  assert.deepEqual(throttled, { ok: false, status: 429 });

  // Even the RIGHT password is refused while the client is throttled.
  const correct = await authorizeAdmin(req({ ...headers, 'x-admin-password': PASSWORD }), {
    db, adminPassword: PASSWORD, functionName: 'test',
  });
  assert.deepEqual(correct, { ok: false, status: 429 });
  assert.equal(db.insertCalls, MAX_FAILURES, 'throttled attempts must not extend the block');
});

test('an unset secret denies every request and still records the failure', async () => {
  const db = new FakeDb();
  const outcome = await authorizeAdmin(req({ 'x-admin-password': PASSWORD }), {
    db, adminPassword: undefined, functionName: 'test',
  });
  assert.deepEqual(outcome, { ok: false, status: 401 });
  assert.equal(db.insertCalls, 1);
});

test('a broken failure counter does not lock the admin out', async () => {
  const db = new FakeDb();
  db.selectError = { message: 'db down' };
  assert.equal(await isThrottled(db, 'hash-a'), false);
  const outcome = await authorizeAdmin(req({ 'x-admin-password': PASSWORD }), {
    db, adminPassword: PASSWORD, functionName: 'test',
  });
  assert.deepEqual(outcome, { ok: true });
});
