/**
 * Coordinate formatting for the map pin.
 *
 * `property_applications.latitude` and `.longitude` are numeric(10,7), so a
 * value carried to more than seven decimals is silently rounded by Postgres.
 * Formatting to exactly that precision here means what the host sees under the
 * map is what the row will hold — and what the listing's JSON-LD will publish.
 */

/** Decimal places the database keeps. numeric(10,7). */
export const COORD_DECIMALS = 7;

/** A number as the column will store it, without trailing zero noise. */
export function formatCoord(n: number): string {
  return n.toFixed(COORD_DECIMALS).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * A form field's text as a usable coordinate, or null. Out-of-range values are
 * rejected rather than clamped: 91° north is a typo, not a place, and quietly
 * moving the pin to the pole would hide it.
 */
export function parseCoord(value: string, max: number): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

export const MAX_LATITUDE = 90;
export const MAX_LONGITUDE = 180;
