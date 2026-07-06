/**
 * Offers & Promos — client-side lookup + discount math.
 *
 * ⚠️ KEEP IN SYNC with supabase/functions/_shared/promos.ts — the server
 * (bog-payment) verifies the charged amount with the same selection rule
 * (highest %, tie-break oldest created_at) and the same rounding formula.
 *
 * Public visibility is gated by FEATURE_FLAGS.ENABLE_PROMOS — the feature
 * ships dormant until the first real offers arrive.
 */
import { supabase } from './supabase';
import { locationMatches, regionMatches } from './locationNormalizer';

export interface Promo {
  id: string;
  title: string;
  description: string | null;
  discount_percent: number;
  location: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

/** Today as YYYY-MM-DD in Georgia's timezone — matches the server exactly. */
export function todayInGeorgia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());
}

/** Discounted total, rounded to cents. Identical formula on client + server. */
export function applyPromoDiscount(total: number, discountPercent: number): number {
  return Math.round(total * (1 - discountPercent / 100) * 100) / 100;
}

/**
 * All active, date-valid promos (highest discount first, then oldest).
 * Fail-safe: any error returns [] so promos can never break a page.
 */
export async function fetchActivePromos(): Promise<Promo[]> {
  try {
    const today = todayInGeorgia();
    const { data, error } = await supabase
      .from('promos')
      .select('*')
      .eq('active', true);
    if (error || !data) return [];
    return (data as Promo[])
      .filter((p) => {
        if (p.starts_at && p.starts_at > today) return false;
        if (p.ends_at && p.ends_at < today) return false;
        const pct = Number(p.discount_percent);
        return isFinite(pct) && pct > 0 && pct <= 90;
      })
      .sort((a, b) =>
        Number(b.discount_percent) - Number(a.discount_percent) ||
        a.created_at.localeCompare(b.created_at));
  } catch {
    return [];
  }
}

/**
 * The promo that applies to a property location, bilingually — "Batumi"
 * matches "ბათუმი, აჭარა"; region promos ("Adjara") match their cities.
 * `promos` must come from fetchActivePromos() (already sorted by the shared
 * rule), so the first match is the winning promo — same choice as the server.
 */
export function findPromoForLocation(promos: Promo[], propertyLocation: string): Promo | null {
  if (!propertyLocation) return null;
  return promos.find((p) =>
    locationMatches(propertyLocation, p.location) || regionMatches(propertyLocation, p.location),
  ) ?? null;
}
