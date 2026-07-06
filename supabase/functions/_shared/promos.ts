/**
 * Server-side promo lookup + discount math.
 *
 * ⚠️ KEEP IN SYNC with src/lib/promos.ts — the client must select the same
 * promo (highest %, tie-break oldest) and round the same way, otherwise the
 * bog-payment price verification would reject legitimate bookings.
 */
import { locationMatches, regionMatches } from './locationNormalizer.ts';

export interface ActivePromo {
  id: string;
  discount_percent: number;
}

/** Today as YYYY-MM-DD in Georgia's timezone — deterministic on any runtime. */
export function todayInGeorgia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());
}

/** Discounted total, rounded to cents. Identical formula on client + server. */
export function applyPromoDiscount(total: number, discountPercent: number): number {
  return Math.round(total * (1 - discountPercent / 100) * 100) / 100;
}

/**
 * Finds the active, date-valid promo matching a property location (bilingual:
 * "Batumi" matches "ბათუმი, აჭარა" and vice versa; region promos like
 * "Adjara" match their cities). Several matches → highest discount_percent
 * wins, tie-break oldest created_at.
 *
 * FAIL-SAFE: any error (missing table, network, bad data) returns null so a
 * promo problem can never block a booking — the guest just pays full price.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findActivePromoForLocation(supabase: any, propertyLocation: string): Promise<ActivePromo | null> {
  try {
    if (!propertyLocation) return null;
    const today = todayInGeorgia();
    const { data, error } = await supabase
      .from('promos')
      .select('id, discount_percent, location, starts_at, ends_at, created_at')
      .eq('active', true);
    if (error || !data) return null;

    const candidates = (data as Array<{
      id: string; discount_percent: number; location: string;
      starts_at: string | null; ends_at: string | null; created_at: string;
    }>).filter((p) => {
      if (p.starts_at && p.starts_at > today) return false;
      if (p.ends_at && p.ends_at < today) return false;
      const pct = Number(p.discount_percent);
      if (!isFinite(pct) || pct <= 0 || pct > 90) return false;
      return locationMatches(propertyLocation, p.location) || regionMatches(propertyLocation, p.location);
    });
    if (candidates.length === 0) return null;

    candidates.sort((a, b) =>
      Number(b.discount_percent) - Number(a.discount_percent) ||
      a.created_at.localeCompare(b.created_at));
    return { id: candidates[0].id, discount_percent: Number(candidates[0].discount_percent) };
  } catch (e) {
    console.error('[promos] lookup failed (treated as no promo):', e);
    return null;
  }
}
