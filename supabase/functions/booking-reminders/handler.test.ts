// Tests for booking-reminders (server-side Cron version).
//
// Run (Node >= 22.18 / 24, built-in TypeScript type stripping):
//   node --test supabase/functions/booking-reminders/handler.test.ts
//
// Supabase (query-builder subset) and Resend are faked in memory. The fake
// resolves asynchronously so concurrent runs genuinely interleave. No network,
// no secrets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, dueReminder, MAX_ATTEMPTS, type HandlerDeps } from './handler.ts';
import { buildReminderEmailHtml } from './templates.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ─── Fake Supabase ────────────────────────────────────────────────────────────

type Hook = (table: string, op: string, payload: Row | null) => boolean;

class FakeDb {
  tables: Record<string, Row[]>;
  /** Return true to make the matching operation fail with a DB error. */
  failWhen: Hook = () => false;
  /** Called right before an UPDATE executes (to simulate concurrent changes). */
  beforeUpdate: (table: string, payload: Row) => void = () => {};
  writes: { table: string; op: string; payload: Row }[] = [];
  /** Column lists requested by SELECTs, per table. */
  selects: { table: string; cols: string }[] = [];
  /** When set, the first N discovery SELECTs on bookings wait for each other (true concurrency). */
  private barrierSize = 0;
  private barrierWaiters: (() => void)[] = [];
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
  setBarrier(n: number) { this.barrierSize = n; this.barrierWaiters = []; }
  arrive(): Promise<void> {
    if (this.barrierSize <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.barrierWaiters.push(resolve);
      if (this.barrierWaiters.length >= this.barrierSize) {
        const ws = this.barrierWaiters; this.barrierSize = 0; this.barrierWaiters = [];
        ws.forEach((w) => w());
      }
    });
  }
}

class FakeQuery {
  private op: 'select' | 'update' | 'insert' | 'upsert' = 'select';
  private payload: Row | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private returning = false;
  private single = false;
  private conflictKey = 'id';
  private db: FakeDb;
  private table: string;
  constructor(db: FakeDb, table: string) {
    this.db = db;
    this.table = table;
  }
  select(cols?: string) {
    if (this.op !== 'select') this.returning = true;
    else this.db.selects.push({ table: this.table, cols: cols ?? '*' });
    return this;
  }
  update(p: Row) { this.op = 'update'; this.payload = p; return this; }
  insert(p: Row) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p: Row, opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.conflictKey = opts?.onConflict ?? 'id'; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => same(r[c], v)); return this; }
  lt(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) < v); return this; }
  lte(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) <= v); return this; }
  gt(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) > v); return this; }
  gte(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) >= v); return this; }
  maybeSingle() { this.single = true; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(resolve: (v: any) => void, reject: (e: unknown) => void) {
    const gate = this.table === 'bookings' && this.op === 'select' ? this.db.arrive() : Promise.resolve();
    gate.then(() => Promise.resolve()).then(() => {
      try { resolve(this.execute()); } catch (e) { reject(e); }
    });
  }
  private execute(): { data: unknown; error: unknown } {
    if (this.db.failWhen(this.table, this.op, this.payload)) return { data: null, error: { message: 'simulated failure for host.private@example.test' } };
    const rows = this.db.tables[this.table];
    const match = () => rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === 'select') {
      const out = match().map((r) => ({ ...r }));
      return { data: this.single ? (out[0] ?? null) : out, error: null };
    }
    if (this.op === 'update') {
      this.db.beforeUpdate(this.table, this.payload as Row);
      const hit = match();
      for (const r of hit) Object.assign(r, this.payload);
      this.db.writes.push({ table: this.table, op: 'update', payload: { ...(this.payload as Row) } });
      return { data: this.returning ? hit.map((r) => ({ id: r.id })) : null, error: null };
    }
    if (this.op === 'insert') {
      rows.push({ ...(this.payload as Row) });
      this.db.writes.push({ table: this.table, op: 'insert', payload: { ...(this.payload as Row) } });
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

const CRON = 'cron-test-secret-only';
const ANON_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.anon-signature';
const HOST_A = 'host.alpha.private@example.test';
const HOST_BLOCKED = 'host.blocked.private@example.test';
const HOST_C = 'host.charlie.private@example.test';
const HOST_D = 'host.delta.private@example.test';
const GUEST_EMAIL = 'guest.private@example.test';
const GUEST_NAME = 'Privateguestname';
const GUEST_PHONE = '+995555000999';
const PRIVATE = [HOST_A, HOST_BLOCKED, HOST_C, HOST_D, GUEST_EMAIL, GUEST_NAME, GUEST_PHONE, CRON, 'host.private@example.test'];

const NOW = new Date('2026-09-16T10:00:00Z');
const H = 60 * 60 * 1000;
const inHours = (h: number) => new Date(NOW.getTime() + h * H).toISOString();

function bk(id: string, hoursLeft: number | null, over: Row = {}): Row {
  return {
    id, property_id: 'prop-a', property_title: 'Alpha Cottage',
    user_email: GUEST_EMAIL, user_name: GUEST_NAME, guest_phone: GUEST_PHONE,
    check_in: '2026-10-10', check_out: '2026-10-13', guests: 2, total_price: 300,
    status: 'pending_host_approval', payment_method: 'pay_now', payment_status: 'paid',
    created_at: '2026-09-15T00:00:00Z',
    approval_deadline: hoursLeft === null ? null : inHours(hoursLeft),
    reminder_12h_sent: false, reminder_16h_sent: false,
    ...over,
  };
}

function tables(bookings: Row[]): Record<string, Row[]> {
  return {
    bookings,
    property_applications: [
      { id: 'prop-a', host_email: HOST_A, host_first_name: 'Nino', host_last_name: 'Private' },
      { id: 'prop-noemail', host_email: null, host_first_name: 'Nobody' },
      { id: 'prop-blank', host_email: '   ', host_first_name: 'Blank' },
      { id: 'prop-blocked', host_email: HOST_BLOCKED, host_first_name: 'Blocked' },
      { id: 'prop-c', host_email: HOST_C, host_first_name: 'Cara' },
      { id: 'prop-d', host_email: HOST_D, host_first_name: 'Dato' },
    ],
    blocked_emails: [{ id: 'blk-1', email: HOST_BLOCKED, bounce_type: 'permanent' }],
    email_delivery_logs: [],
  };
}

interface Harness {
  run: (headers?: Record<string, string>, init?: RequestInit) => Promise<{ status: number; body: Row; text: string }>;
  db: FakeDb;
  sends: { to: string; subject: string; html: string; idempotencyKey: string }[];
  logs: { event: string; fields?: Row }[];
  setResend: (fn: (n: number) => number) => void;
  advance: (ms: number) => void;
}

function harness(bookings: Row[], opts: { cronSecret?: string; resendStatus?: number } = {}): Harness {
  const db = new FakeDb(tables(bookings));
  const sends: Harness['sends'] = [];
  const logs: Harness['logs'] = [];
  let clock = NOW.getTime();
  let resendStatus = (_n: number) => opts.resendStatus ?? 200;
  const deps: HandlerDeps = {
    db,
    cronSecret: 'cronSecret' in opts ? opts.cronSecret : CRON,
    sendResend: async (m) => {
      sends.push({ to: m.to, subject: m.subject, html: m.html, idempotencyKey: m.idempotencyKey });
      const status = resendStatus(sends.length);
      const body = status === 422 ? `{"name":"validation_error","message":"Invalid to: ${m.to}"}` : status >= 300 ? `{"message":"upstream failure for ${m.to}"}` : '{"id":"msg"}';
      return { status, body };
    },
    now: () => new Date(clock),
    log: (event, fields) => logs.push({ event, fields }),
  };
  const handler = createHandler(deps);
  return {
    db, sends, logs,
    setResend: (fn) => { resendStatus = fn; },
    advance: (ms) => { clock += ms; },
    run: async (headers = { 'x-cron-secret': CRON }, init: RequestInit = {}) => {
      const res = await handler(new Request('https://fn.local/functions/v1/booking-reminders', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{}', ...init }));
      const text = await res.text();
      let body: Row = {};
      try { body = JSON.parse(text); } catch { /* not json */ }
      return { status: res.status, body, text };
    },
  };
}

const cron = { 'x-cron-secret': CRON };
const row = (h: Harness, id: string) => h.db.rows('bookings').find((r) => r.id === id) as Row;
const deliveries = (h: Harness, id: string, type: '12h' | '16h') =>
  h.db.rows('email_delivery_logs').filter((l) => l.context_id === id && l.context === `host_reminder_${type}`);

// ─── AUTH ─────────────────────────────────────────────────────────────────────

test('A1 missing secret → 401, nothing read or sent', async () => {
  const h = harness([bk('b1', 6)]);
  const r = await h.run({});
  assert.deepEqual([r.status, r.body], [401, { error: 'Unauthorized' }]);
  assert.equal(h.sends.length, 0);
  assert.equal(h.db.writes.length, 0);
});

test('A2 wrong secret, near-miss secret, and unconfigured server → 401', async () => {
  const h = harness([bk('b1', 6)]);
  for (const s of ['wrong', CRON + 'x', CRON.slice(0, -1), CRON.toUpperCase()]) {
    assert.equal((await h.run({ 'x-cron-secret': s })).status, 401);
  }
  const unconfigured = harness([bk('b1', 6)], { cronSecret: '' });
  assert.equal((await unconfigured.run({ 'x-cron-secret': '' })).status, 401);
  assert.equal(h.sends.length + unconfigured.sends.length, 0);
});

test('A3 public key only → 401', async () => {
  const h = harness([bk('b1', 6)]);
  assert.equal((await h.run({ apikey: ANON_JWT, Authorization: `Bearer ${ANON_JWT}` })).status, 401);
  assert.equal(h.sends.length, 0);
});

test('A4 user session token → 401 (no user auth alternative)', async () => {
  const h = harness([bk('b1', 6)]);
  assert.equal((await h.run({ Authorization: 'Bearer eyJ.user-session-token.sig' })).status, 401);
  assert.equal((await h.run({ Authorization: `Bearer ${CRON}` })).status, 401, 'secret as Bearer is not accepted');
  assert.equal(h.sends.length, 0);
});

test('A5 admin password → 401', async () => {
  const h = harness([bk('b1', 6)]);
  assert.equal((await h.run({ 'x-admin-password': CRON })).status, 401);
  assert.equal(h.sends.length, 0);
});

test('A6 GET and other methods → 405 even with the secret', async () => {
  const h = harness([bk('b1', 6)]);
  for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
    const r = await h.run(cron, { method, body: undefined });
    assert.equal(r.status, 405, method);
  }
  assert.equal(h.sends.length, 0);
});

test('A7 valid secret → 200 with counts only', async () => {
  const h = harness([bk('b1', 6)]);
  const r = await h.run();
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['blocked', 'checked', 'errors', 'reminder12Sent', 'reminder16Sent', 'retriesScheduled', 'skipped', 'success']);
  assert.equal(r.body.reminder16Sent, 1);
});

// ─── ELIGIBILITY ──────────────────────────────────────────────────────────────

test('E1 more than 12h remaining → no reminder', async () => {
  const h = harness([bk('b1', 12.5), bk('b2', 20)]);
  const r = await h.run();
  assert.equal(r.body.reminder12Sent + r.body.reminder16Sent, 0);
  assert.equal(h.sends.length, 0);
});

test('E2 12h or less remaining → 12h reminder only', async () => {
  const h = harness([bk('b1', 12), bk('b2', 9)]);
  const r = await h.run();
  assert.equal(r.body.reminder12Sent, 2);
  assert.equal(r.body.reminder16Sent, 0);
  for (const id of ['b1', 'b2']) assert.deepEqual([row(h, id).reminder_12h_sent, row(h, id).reminder_16h_sent], [true, false]);
  assert.ok(h.sends.every((s) => s.subject.startsWith('⏰ შეხსენება')));
});

test('E3 8h or less remaining → urgent 16h reminder, sets both flags', async () => {
  const h = harness([bk('b1', 8), bk('b2', 0.5)]);
  const r = await h.run();
  assert.equal(r.body.reminder16Sent, 2);
  for (const id of ['b1', 'b2']) assert.deepEqual([row(h, id).reminder_12h_sent, row(h, id).reminder_16h_sent], [true, true]);
  assert.ok(h.sends.every((s) => s.subject.startsWith('⚠️ გადაუდებელი')));
});

test('E4 8h or less remaining never sends the older 12h reminder, even on later runs', async () => {
  const h = harness([bk('b1', 7)]);
  await h.run();
  await h.run();
  h.advance(2 * H);
  await h.run();
  assert.equal(h.sends.length, 1);
  assert.equal(deliveries(h, 'b1', '12h').length, 0);
});

test('E5 12h reminder first, then 16h reminder when 8h remain', async () => {
  const h = harness([bk('b1', 11)]);
  await h.run();
  h.advance(3.5 * H); // 7.5h left
  await h.run();
  assert.equal(h.sends.length, 2);
  assert.ok(h.sends[0].subject.startsWith('⏰ შეხსენება'));
  assert.ok(h.sends[1].subject.startsWith('⚠️ გადაუდებელი'));
});

test('E6 past deadline → no reminder', async () => {
  const h = harness([bk('b1', -0.1), bk('b2', 0)]);
  const r = await h.run();
  assert.equal(h.sends.length, 0);
  assert.equal(r.body.checked, 0, 'excluded by discovery');
});

test('E7 missing or invalid deadline → skipped', async () => {
  const h = harness([bk('b1', null), bk('b2', null, { approval_deadline: 'not-a-date' })]);
  await h.run();
  assert.equal(h.sends.length, 0);
  assert.equal(dueReminder(bk('x', null), NOW), null);
  assert.equal(dueReminder({ ...bk('x', null), approval_deadline: 'garbage' }, NOW), null);
});

test('E8 timing uses approval_deadline, not created_at', async () => {
  // Created 30h ago (old logic: outside window) but deadline in 6h → urgent reminder.
  const oldCreated = harness([bk('b1', 6, { created_at: new Date(NOW.getTime() - 30 * H).toISOString() })]);
  assert.equal((await oldCreated.run()).body.reminder16Sent, 1);
  // Created 13h ago (old logic: 12h reminder) but deadline in 20h → nothing.
  const recentDeadline = harness([bk('b2', 20, { created_at: new Date(NOW.getTime() - 13 * H).toISOString() })]);
  assert.equal(recentDeadline.sends.length + (await recentDeadline.run()).body.reminder12Sent, 0);
});

test('E9 late-paid pay-now booking is timed from its real approval deadline', async () => {
  // Order created 20h ago, paid 9h ago → deadline in 15h: no reminder yet.
  const h = harness([bk('b1', 15, { created_at: new Date(NOW.getTime() - 20 * H).toISOString() })]);
  await h.run();
  assert.equal(h.sends.length, 0);
  h.advance(3 * H); // 12h left
  await h.run();
  assert.equal(h.sends.length, 1);
  assert.ok(h.sends[0].subject.startsWith('⏰'));
  assert.match(h.sends[0].html, /ეს მოთხოვნა 12 საათია ელოდება პასუხს/);
});

// ─── STATUS ───────────────────────────────────────────────────────────────────

test('S1–S5 non-pending statuses never get a reminder', async () => {
  for (const status of ['confirmed', 'rejected', 'cancelled', 'pending_payment', 'payment_failed', 'cancelled_by_host']) {
    const h = harness([bk('b1', 6, { status })]);
    const r = await h.run();
    assert.equal(h.sends.length, 0, status);
    assert.equal(r.body.checked, 0);
    assert.equal(dueReminder(bk('x', 6, { status }), NOW), null);
  }
});

test('S6 status changes between discovery and claim → no email, flags untouched', async () => {
  for (const newStatus of ['confirmed', 'rejected', 'cancelled', 'pending_payment', 'payment_failed']) {
    const h = harness([bk('b1', 6)]);
    h.db.beforeUpdate = (table, payload) => {
      if (table === 'bookings' && payload.reminder_16h_sent === true) row(h, 'b1').status = newStatus;
    };
    const r = await h.run();
    assert.equal(h.sends.length, 0, newStatus);
    assert.equal(row(h, 'b1').reminder_16h_sent, false);
    assert.equal(r.body.skipped, 1);
  }
});

test('S7 deadline passing between discovery and claim → no email', async () => {
  const h = harness([bk('b1', 0.001)]);
  // Time passes after discovery (during the host lookup), before the claim is built.
  h.db.failWhen = (table, op) => { if (table === 'property_applications' && op === 'select') h.advance(10 * 60 * 1000); return false; };
  await h.run();
  assert.equal(h.sends.length, 0);
  assert.equal(row(h, 'b1').reminder_16h_sent, false);
});

// ─── DUPLICATES ───────────────────────────────────────────────────────────────

test('D1 two sequential executions → one email', async () => {
  const h = harness([bk('b1', 6)]);
  await h.run();
  await h.run();
  assert.equal(h.sends.length, 1);
});

test('D2 two concurrent executions → one email', async () => {
  const h = harness([bk('b1', 6), bk('b2', 10)]);
  h.db.setBarrier(2);
  const rs = await Promise.all([h.run(), h.run()]);
  assert.equal(h.sends.filter((s) => s.idempotencyKey.endsWith('b1')).length, 1);
  assert.equal(h.sends.filter((s) => s.idempotencyKey.endsWith('b2')).length, 1);
  assert.equal(rs.reduce((n, r) => n + r.body.reminder16Sent + r.body.reminder12Sent, 0), 2);
});

test('D3 three concurrent executions → one email per booking', async () => {
  const h = harness([bk('b1', 6), bk('b2', 11), bk('b3', 2)]);
  h.db.setBarrier(3);
  await Promise.all([h.run(), h.run(), h.run()]);
  assert.equal(h.sends.length, 3);
  assert.deepEqual(h.sends.map((s) => s.idempotencyKey).sort(), ['booking-reminder-12h-b2', 'booking-reminder-16h-b1', 'booking-reminder-16h-b3']);
});

test('D4 repeated execution after success → no second email, no extra writes', async () => {
  const h = harness([bk('b1', 6)]);
  await h.run();
  const writes = h.db.writes.length;
  for (let i = 0; i < 5; i++) await h.run();
  assert.equal(h.sends.length, 1);
  assert.equal(h.db.writes.length, writes);
});

test('D5 a sent delivery row blocks re-sending even if a flag were reset', async () => {
  const h = harness([bk('b1', 6)]);
  await h.run();
  row(h, 'b1').reminder_16h_sent = false; // simulate manual/accidental reset
  await h.run();
  assert.equal(h.sends.length, 1);
});

// ─── FAILURES ─────────────────────────────────────────────────────────────────

test('F1 transient failure releases the claim and a later run retries (same idempotency key)', async () => {
  const h = harness([bk('b1', 6)]);
  h.setResend((n) => (n === 1 ? 503 : 200));
  const r1 = await h.run();
  assert.deepEqual([r1.body.errors, r1.body.retriesScheduled], [1, 1]);
  assert.equal(row(h, 'b1').reminder_16h_sent, false, 'released');
  assert.equal(row(h, 'b1').reminder_12h_sent, true, '12h flag stays set so the older reminder never follows');
  const r2 = await h.run();
  assert.equal(r2.body.reminder16Sent, 1);
  assert.equal(h.sends.length, 2);
  assert.equal(h.sends[0].idempotencyKey, h.sends[1].idempotencyKey);
  assert.equal(row(h, 'b1').reminder_16h_sent, true);
  assert.deepEqual(deliveries(h, 'b1', '16h').map((d) => [d.status, d.attempt_number]), [['transient_failure', 1], ['sent', 2]]);
});

test(`F2 at most ${MAX_ATTEMPTS} attempts per booking + reminder type`, async () => {
  const h = harness([bk('b1', 10)]);
  h.setResend(() => 500);
  for (let i = 0; i < 10; i++) await h.run();
  assert.equal(h.sends.length, MAX_ATTEMPTS);
  assert.equal(row(h, 'b1').reminder_12h_sent, true, 'claim kept after the last attempt');
  assert.deepEqual(deliveries(h, 'b1', '12h').map((d) => d.attempt_number), [1, 2, 3]);
  // Network errors and 429 count the same way.
  const h2 = harness([bk('b2', 10)]);
  h2.setResend((n) => (n % 2 ? 0 : 429));
  for (let i = 0; i < 10; i++) await h2.run();
  assert.equal(h2.sends.length, MAX_ATTEMPTS);
});

test('F3 permanent failure is not retried; host is blocked; no further writes on later runs', async () => {
  const h = harness([bk('b1', 10)], { resendStatus: 422 });
  const r = await h.run();
  assert.equal(r.body.errors, 1);
  assert.equal(r.body.retriesScheduled, 0);
  assert.equal(row(h, 'b1').reminder_12h_sent, true);
  assert.ok(h.db.rows('blocked_emails').some((b) => b.email === HOST_A && b.bounce_type === 'permanent'));
  const writes = h.db.writes.length;
  for (let i = 0; i < 4; i++) await h.run();
  assert.equal(h.sends.length, 1);
  assert.equal(h.db.writes.length, writes);
  // Later 16h reminder for the now-blocked host is skipped without writes.
  h.advance(3 * H);
  const r2 = await h.run();
  assert.equal(r2.body.blocked, 1);
  assert.equal(h.sends.length, 1);
  assert.equal(h.db.writes.length, writes);
});

test('F4 blocked host is skipped with no claim and no accumulating log rows', async () => {
  const h = harness([bk('b1', 6, { property_id: 'prop-blocked' })]);
  for (let i = 0; i < 5; i++) {
    const r = await h.run();
    assert.equal(r.body.blocked, 1);
  }
  assert.equal(h.sends.length, 0);
  assert.equal(h.db.writes.length, 0);
  assert.equal(row(h, 'b1').reminder_16h_sent, false);
});

test('F5 claim DB error → no email', async () => {
  const h = harness([bk('b1', 6)]);
  h.db.failWhen = (table, op) => table === 'bookings' && op === 'update';
  const r = await h.run();
  assert.equal(h.sends.length, 0);
  assert.equal(r.body.errors, 1);
});

test('F6 release failure keeps the claim → no retry, no duplicate', async () => {
  const h = harness([bk('b1', 6)]);
  h.setResend((n) => (n === 1 ? 503 : 200));
  h.db.failWhen = (table, op, payload) => table === 'bookings' && op === 'update' && payload?.reminder_16h_sent === false;
  await h.run();
  for (let i = 0; i < 3; i++) await h.run();
  assert.equal(h.sends.length, 1);
  assert.equal(row(h, 'b1').reminder_16h_sent, true);
});

test('F7 transient attempt not recorded → claim kept (cap cannot be bypassed)', async () => {
  const h = harness([bk('b1', 6)]);
  h.setResend(() => 503);
  h.db.failWhen = (table, op) => table === 'email_delivery_logs' && op === 'insert';
  for (let i = 0; i < 5; i++) await h.run();
  assert.equal(h.sends.length, 1);
});

test('F8 successful send whose log write fails is never sent again', async () => {
  const h = harness([bk('b1', 6)]);
  h.db.failWhen = (table, op) => table === 'email_delivery_logs' && op === 'insert';
  await h.run();
  h.db.failWhen = () => false;
  for (let i = 0; i < 3; i++) await h.run();
  assert.equal(h.sends.length, 1);
});

test('F9 delivery-log read error under the claim → no send, claim kept', async () => {
  const h = harness([bk('b1', 6)]);
  let reads = 0;
  h.db.failWhen = (table, op) => table === 'email_delivery_logs' && op === 'select' && ++reads === 2;
  await h.run();
  await h.run();
  assert.equal(h.sends.length, 0);
  assert.equal(row(h, 'b1').reminder_16h_sent, true);
});

test('F10 transient failure during concurrent runs still yields one delivery per attempt', async () => {
  const h = harness([bk('b1', 6)]);
  h.setResend((n) => (n === 1 ? 503 : 200));
  h.db.setBarrier(3);
  await Promise.all([h.run(), h.run(), h.run()]);
  h.db.setBarrier(3);
  await Promise.all([h.run(), h.run(), h.run()]);
  const successes = deliveries(h, 'b1', '16h').filter((d) => d.status === 'sent').length;
  assert.equal(successes, 1);
  assert.ok(h.sends.length <= 2);
});

test('F11 discovery DB error → 500 generic, nothing sent', async () => {
  const h = harness([bk('b1', 6)]);
  h.db.failWhen = (table, op) => table === 'bookings' && op === 'select';
  const r = await h.run();
  assert.deepEqual([r.status, r.body], [500, { error: 'Request failed' }]);
  assert.equal(h.sends.length, 0);
});

// ─── PRIVACY ──────────────────────────────────────────────────────────────────

test('P1 email goes only to the host and contains no guest personal data', async () => {
  const h = harness([bk('b1', 6)]);
  await h.run();
  assert.equal(h.sends.length, 1);
  assert.equal(h.sends[0].to, HOST_A);
  for (const v of [GUEST_EMAIL, GUEST_NAME, GUEST_PHONE]) {
    assert.ok(!h.sends[0].html.includes(v) && !h.sends[0].subject.includes(v), 'guest data in email');
  }
});

test('P2 responses and logs contain no email addresses, secrets or provider bodies', async () => {
  const h = harness([bk('b1', 6), bk('b2', 10, { property_id: 'prop-c' }), bk('b3', 11, { property_id: 'prop-blocked' }), bk('b4', 7, { property_id: 'prop-d' })]);
  h.setResend((n) => (n === 1 ? 422 : n === 2 ? 503 : 200));
  const r1 = await h.run();
  assert.deepEqual([r1.body.reminder16Sent, r1.body.errors, r1.body.blocked, r1.body.retriesScheduled], [1, 2, 1, 1], 'success, permanent, transient and blocked paths all exercised');
  h.db.failWhen = (table) => table === 'bookings';
  const r2 = await h.run();
  const blob = r1.text + r2.text + JSON.stringify(h.logs);
  for (const v of PRIVATE) assert.ok(!blob.includes(v), `leaked ${v.slice(0, 6)}`);
  assert.ok(!/@/.test(blob), 'no email-like strings');
  assert.ok(!/validation_error|upstream failure/.test(blob), 'no provider bodies');
  // Provider bodies are not stored either.
  const stored = JSON.stringify(h.db.rows('email_delivery_logs')) + JSON.stringify(h.db.rows('blocked_emails'));
  assert.ok(!/validation_error|upstream failure/.test(stored));
});

test('P3 host name and property title are HTML-escaped; subject has no control characters', async () => {
  const h = harness([bk('b1', 6, { property_title: '<a href="https://evil.test">Verify</a>\r\nBcc: x' })]);
  h.db.rows('property_applications')[0].host_first_name = '<script>x</script>';
  await h.run();
  const { html, subject } = h.sends[0];
  assert.ok(!html.includes('<a href="https://evil.test">') && !html.includes('<script>'));
  assert.ok(html.includes('&lt;a href=&quot;https://evil.test&quot;&gt;') && html.includes('&lt;script&gt;'));
  assert.ok(!/[\r\n]/.test(subject));
});

test('P4 reads only required columns: no select(*), no guest fields', async () => {
  const h = harness([bk('b1', 6), bk('b2', 10, { property_id: 'prop-c' })]);
  await h.run();
  assert.ok(h.db.selects.length > 0);
  for (const { table, cols } of h.db.selects) {
    assert.ok(!cols.includes('*'), `select(*) on ${table}`);
    assert.ok(!/user_email|user_name|phone|customer|payment/.test(cols), `guest/payment columns read from ${table}: ${cols}`);
  }
});

// ─── INPUT ────────────────────────────────────────────────────────────────────

test('I1 request body with booking id, email and dates is ignored', async () => {
  const h = harness([bk('b1', 20), bk('b2', 6)]);
  const r = await h.run(cron, { body: JSON.stringify({ bookingId: 'b1', hostEmail: 'attacker@example.test', to: 'attacker@example.test', approval_deadline: inHours(1), now: inHours(19), reminder: '16h' }) });
  assert.equal(r.status, 200);
  assert.equal(h.sends.length, 1);
  assert.equal(h.sends[0].idempotencyKey, 'booking-reminder-16h-b2');
  assert.equal(h.sends[0].to, HOST_A);
  // Invalid JSON is irrelevant too.
  assert.equal((await h.run(cron, { body: 'not json' })).status, 200);
});

// ─── REGRESSION ───────────────────────────────────────────────────────────────

test('R1 subjects preserved', async () => {
  const h = harness([bk('b1', 10), bk('b2', 6)]);
  await h.run();
  const subjects = Object.fromEntries(h.sends.map((s) => [s.idempotencyKey, s.subject]));
  assert.equal(subjects['booking-reminder-12h-b1'], '⏰ შეხსენება: გაქვთ განუხილველი ჯავშნის მოთხოვნა – Alpha Cottage');
  assert.equal(subjects['booking-reminder-16h-b2'], '⚠️ გადაუდებელი: ჯავშნის მოთხოვნა ვადის ამოწურვის პირასაა – Alpha Cottage');
});

test('R2 HTML matches the preserved template with deadline-derived hours', async () => {
  const h = harness([bk('b1', 10.5), bk('b2', 6.25)]);
  await h.run();
  const byKey = Object.fromEntries(h.sends.map((s) => [s.idempotencyKey, s.html]));
  const fields = { id: 'b1', property_title: 'Alpha Cottage', check_in: '2026-10-10', check_out: '2026-10-13', guests: 2, total_price: 300 };
  assert.equal(byKey['booking-reminder-12h-b1'], buildReminderEmailHtml('Nino', fields, 1, 13));
  assert.equal(byKey['booking-reminder-16h-b2'], buildReminderEmailHtml('Nino', { ...fields, id: 'b2' }, 2, 17));
  assert.match(byKey['booking-reminder-16h-b2'], /დარჩენილია მხოლოდ ~7 საათი/);
  assert.match(byKey['booking-reminder-12h-b1'], /ჯავშნის ID[\s\S]*b1[\s\S]*₾300/);
});

test('R3 host without an email, and booking without property_id, are skipped without writes', async () => {
  const h = harness([bk('b1', 6, { property_id: 'prop-noemail' }), bk('b2', 6, { property_id: 'prop-blank' }), bk('b3', 6, { property_id: null }), bk('b4', 6, { property_id: 'missing' })]);
  const r = await h.run();
  assert.equal(h.sends.length, 0);
  assert.equal(r.body.skipped, 4);
  assert.equal(h.db.writes.length, 0);
});
