// Proves the property page's availability decision is unchanged for blocks and
// matches the server for bookings after switching to get_unavailable_ranges.
//
// Run: node --test tests/frontend/availability.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStayUnavailable, parseUnavailableRanges, type UnavailableRange } from '../../src/lib/availability.ts';

type Block = { start_date: string; end_date: string };
type Booking = { check_in: string; check_out: string; status: string; minutesOld?: number };

// ── The page BEFORE (direct table reads): blocks only, inclusive rule ─────────
function legacyPageBlocked(manual: Block[], ical: Block[], start: string, end: string): boolean {
  if (!start || !end) return false;
  const manualBlocked = manual.some((r) => !(end < r.start_date || start > r.end_date));
  const icalBlocked = ical.some((r) => !(end < r.start_date || start > r.end_date));
  return manualBlocked || icalBlocked;
}

// ── The server (assertDatesAvailable / booking_dates_free) ────────────────────
const OCCUPYING = ['confirmed', 'pending', 'pending_host_approval', 'pending_payment'];
function serverUnavailable(manual: Block[], ical: Block[], bookings: Booking[], ci: string, co: string): boolean {
  const live = bookings.filter((b) => OCCUPYING.includes(b.status) && !(b.status === 'pending_payment' && (b.minutesOld ?? 0) >= 20));
  return live.some((b) => b.check_in < co && b.check_out > ci)
    || [...manual, ...ical].some((d) => d.start_date <= co && d.end_date >= ci);
}

// ── What the RPC returns for the same rows (see the migration's convention) ────
function rpcRows(manual: Block[], ical: Block[], bookings: Booking[]): UnavailableRange[] {
  const live = bookings.filter((b) => OCCUPYING.includes(b.status) && !(b.status === 'pending_payment' && (b.minutesOld ?? 0) >= 20));
  return [
    ...live.map((b) => ({ start_date: b.check_in, end_date: b.check_out, source_kind: 'booked' as const })),
    ...manual.map((d) => ({ ...d, source_kind: 'blocked' as const })),
    ...ical.map((d) => ({ ...d, source_kind: 'blocked' as const })),
  ];
}

const day = (n: number) => new Date(Date.UTC(2027, 0, 1 + n)).toISOString().slice(0, 10);
const MANUAL: Block[] = [
  { start_date: day(10), end_date: day(10) },                 // single day
  { start_date: '2027-01-31', end_date: '2027-02-01' },       // month rollover
];
const ICAL: Block[] = [{ start_date: day(45), end_date: day(48) }];
const BOOKINGS: Booking[] = [
  { check_in: day(60), check_out: day(63), status: 'confirmed' },
  { check_in: day(63), check_out: day(65), status: 'pending_host_approval' },  // back-to-back
  { check_in: day(70), check_out: day(72), status: 'pending_payment', minutesOld: 10 },
  { check_in: day(80), check_out: day(82), status: 'pending_payment', minutesOld: 25 },  // expired hold
  { check_in: day(90), check_out: day(92), status: 'cancelled' },
];

function stays() {
  const out: [string, string][] = [];
  for (let i = 0; i < 100; i++) for (let n = 1; n <= 8; n++) out.push([day(i), day(i + n)]);
  return out;
}

test('blocks: new decision == old page decision for every stay (identical calendar behaviour)', () => {
  const ranges = rpcRows(MANUAL, ICAL, []);
  let blockedCount = 0;
  for (const [ci, co] of stays()) {
    const before = legacyPageBlocked(MANUAL, ICAL, ci, co);
    assert.equal(isStayUnavailable(ranges, ci, co), before, `${ci}→${co}`);
    if (before) blockedCount++;
  }
  assert.ok(blockedCount > 0);
});

test('blocks + bookings: new decision == server decision for every stay', () => {
  const ranges = rpcRows(MANUAL, ICAL, BOOKINGS);
  for (const [ci, co] of stays()) {
    assert.equal(isStayUnavailable(ranges, ci, co), serverUnavailable(MANUAL, ICAL, BOOKINGS, ci, co), `${ci}→${co}`);
  }
});

test('conventions: single-day block, month rollover, back-to-back bookings, holds', () => {
  const r = rpcRows(MANUAL, ICAL, BOOKINGS);
  assert.equal(isStayUnavailable(r, day(8), day(10)), true, 'check-out on a block day is blocked (today\'s rule)');
  assert.equal(isStayUnavailable(r, day(11), day(13)), false, 'day after a single-day block is free');
  assert.equal(isStayUnavailable(r, '2027-01-29', '2027-01-31'), true, 'month rollover block');
  assert.equal(isStayUnavailable(r, '2027-02-02', '2027-02-04'), false);
  assert.equal(isStayUnavailable(r, day(58), day(60)), false, 'check-out on a booking\'s check-in day is free');
  assert.equal(isStayUnavailable(r, day(65), day(67)), false, 'check-in on a booking\'s check-out day is free');
  assert.equal(isStayUnavailable(r, day(62), day(64)), true);
  assert.equal(isStayUnavailable(r, day(70), day(71)), true, 'live hold');
  assert.equal(isStayUnavailable(r, day(80), day(81)), false, 'expired hold');
  assert.equal(isStayUnavailable(r, day(90), day(91)), false, 'cancelled');
  assert.equal(isStayUnavailable(r, '', day(3)), false);
});

test('parseUnavailableRanges keeps only well-formed rows and never extra fields', () => {
  const rows = parseUnavailableRanges([
    { start_date: '2027-01-01', end_date: '2027-01-02', source_kind: 'booked' },
    { start_date: '2027-01-03', end_date: '2027-01-03', source_kind: 'blocked' },
    { start_date: 'bad', end_date: '2027-01-02', source_kind: 'booked' },
    { start_date: '2027-01-01', end_date: '2027-01-02', source_kind: 'airbnb' },
    null, 42,
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(parseUnavailableRanges(null), []);
  assert.deepEqual(parseUnavailableRanges({ error: 'x' }), []);
});
