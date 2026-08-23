/**
 * Property Activities — the extras a host offers alongside the stay
 * (masterclasses, wine degustation, tours, horse riding, …).
 *
 * PAID DIRECTLY TO THE HOST — never through RentCottage. These prices are
 * displayed so a guest knows what is available and what it costs; the guest
 * settles up with the host in person. They never feed the booking total, and
 * the platform takes no commission on them.
 *
 * This is enforced structurally, not by convention: nothing in this module is
 * imported by the booking widget, the property page's price math, or any
 * Supabase function. bog-payment independently recomputes every booking from
 * nightly rate x nights, so even a bug here could not charge a guest for an
 * activity — the server would reject the inflated total with PRICE_MISMATCH.
 */
import { supabase } from './supabase';

export type ActivityCategory =
  | 'cooking' | 'wine' | 'tour' | 'horse' | 'hiking' | 'spa' | 'transfer' | 'other';

export type PriceUnit = 'per_person' | 'per_group' | 'free' | 'on_request';

export interface PropertyActivity {
  id: string;
  property_id: string;
  host_email: string;
  title: string;
  description: string | null;
  category: ActivityCategory;
  price: number | null;
  price_unit: PriceUnit;
  duration_minutes: number | null;
  image_url: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
}

/** Category → emoji. Emoji rather than an icon font: these are decorative,
 *  render identically everywhere, and never depend on a stylesheet loading. */
export const CATEGORY_EMOJI: Record<ActivityCategory, string> = {
  cooking: '🍳',
  wine: '🍷',
  tour: '🗺️',
  horse: '🐴',
  hiking: '🥾',
  spa: '🧖',
  transfer: '🚐',
  other: '✨',
};

/** The order they're offered in the host's picker. */
export const CATEGORIES: ActivityCategory[] = [
  'cooking', 'wine', 'tour', 'horse', 'hiking', 'spa', 'transfer', 'other',
];

/** "1 h 30 min" from a minute count; null when the host left it blank. */
export function formatDuration(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/** ₾ amounts: whole numbers stay whole, fractional show 2 decimals. */
export function formatGel(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Rows a host can't have meant — guards the page against bad data. */
function isWellFormed(a: PropertyActivity): boolean {
  if (!a.title || !a.title.trim()) return false;
  if (a.price !== null && (!isFinite(Number(a.price)) || Number(a.price) < 0)) return false;
  return true;
}

/**
 * Active activities for one property, in the host's chosen order.
 * Fail-safe: any error returns [] so an activity problem can never break the
 * cottage page.
 */
export async function fetchActivitiesForProperty(propertyId: string): Promise<PropertyActivity[]> {
  try {
    if (!propertyId) return [];
    const { data, error } = await supabase
      .from('property_activities')
      .select('*')
      .eq('property_id', propertyId)
      .eq('active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return (data as PropertyActivity[]).filter(isWellFormed);
  } catch {
    return [];
  }
}
