/**
 * Guest-facing availability, from the public `get_unavailable_ranges` RPC.
 *
 * The RPC returns only (start_date, end_date, source_kind) — no booking or block
 * records — and each kind keeps the end-date convention the server checks use
 * (assertDatesAvailable in booking-handler and booking_dates_free in the
 * database), so the page refuses exactly the stays the server would refuse:
 *
 *   'blocked'  host blocks and imported OTA blocks. end_date is INCLUSIVE.
 *              A stay conflicts when start_date <= checkOut && end_date >= checkIn.
 *   'booked'   occupying bookings. end_date is the check-out day, EXCLUSIVE.
 *              A stay conflicts when checkIn < end_date && checkOut > start_date.
 *
 * Dates are ISO 'YYYY-MM-DD' strings, compared lexicographically.
 */

export type UnavailableKind = 'booked' | 'blocked';

export interface UnavailableRange {
  start_date: string;
  end_date: string;
  source_kind: UnavailableKind;
}

export function rangeConflictsWithStay(range: UnavailableRange, checkIn: string, checkOut: string): boolean {
  if (range.source_kind === 'booked') {
    return checkIn < range.end_date && checkOut > range.start_date;
  }
  return !(checkOut < range.start_date || checkIn > range.end_date);
}

export function isStayUnavailable(ranges: UnavailableRange[], checkIn: string, checkOut: string): boolean {
  if (!checkIn || !checkOut) return false;
  return ranges.some((r) => rangeConflictsWithStay(r, checkIn, checkOut));
}

/** Keeps only well-formed rows from the RPC response. */
export function parseUnavailableRanges(data: unknown): UnavailableRange[] {
  if (!Array.isArray(data)) return [];
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return data.filter((r): r is UnavailableRange =>
    Boolean(r) && typeof r === 'object'
    && iso.test(String((r as UnavailableRange).start_date))
    && iso.test(String((r as UnavailableRange).end_date))
    && ((r as UnavailableRange).source_kind === 'booked' || (r as UnavailableRange).source_kind === 'blocked'));
}
