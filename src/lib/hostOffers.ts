/**
 * Host Offers — the two kinds of deal a host runs on their own property, and
 * the math that turns one into a price.
 *
 *   'free_nights'  "2+1" — stay 3 nights, pay for 2. Repeats per whole cycle.
 *   'discount'     a straight percentage off the stay, usually paired with a
 *                  date window ("10% off the 1st–8th").
 *
 * ⚠️ KEEP IN SYNC with supabase/functions/_shared/hostOffers.ts — the server
 * (bog-payment) verifies the charged amount using the same eligibility rule,
 * the same selection rule (cheapest resulting total, tie-break oldest
 * created_at) and the same rounding. If they diverge, legitimate bookings get
 * rejected with PRICE_MISMATCH.
 *
 * Public visibility is gated by FEATURE_FLAGS.ENABLE_HOST_OFFERS.
 */
import { supabase } from './supabase';

export type OfferType = 'free_nights' | 'discount';

export interface HostOffer {
  id: string;
  property_id: string;
  host_email: string;
  title: string | null;
  offer_type: OfferType;
  /** 'free_nights' only. */
  buy_nights: number | null;
  /** 'free_nights' only. */
  free_nights: number | null;
  /** 'discount' only. */
  discount_percent: number | null;
  active: boolean;
  /** Earliest stay date the deal covers; null = unbounded. */
  starts_at: string | null;
  /** Latest stay date the deal covers; null = unbounded. */
  ends_at: string | null;
  created_at: string;
}

/** Today as YYYY-MM-DD in Georgia's timezone — matches the server exactly. */
export function todayInGeorgia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());
}

/** The short label a deal is known by: "2+1" or "−10%". */
export function offerLabel(offer: Pick<HostOffer, 'offer_type' | 'buy_nights' | 'free_nights' | 'discount_percent'>): string {
  return offer.offer_type === 'discount'
    ? `−${formatPercent(offer.discount_percent)}%`
    : `${offer.buy_nights}+${offer.free_nights}`;
}

/** 10 → "10", 12.5 → "12.5" — trailing ".00" from numeric(5,2) never shown. */
export function formatPercent(pct: number | null): string {
  const n = Number(pct);
  if (!isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** Structurally usable — the same bounds the DB CHECKs enforce. */
function isWellFormed(o: HostOffer): boolean {
  if (o.offer_type === 'discount') {
    const pct = Number(o.discount_percent);
    return isFinite(pct) && pct > 0 && pct <= 90;
  }
  const buy = Number(o.buy_nights);
  const free = Number(o.free_nights);
  return Number.isInteger(buy) && Number.isInteger(free)
    && buy >= 1 && buy <= 30
    && free >= 1 && free <= 30
    && free <= buy;
}

/** Not yet over: an offer whose window has passed is dead for every stay. */
function isLiveToday(o: HostOffer, today: string): boolean {
  if (!o.active) return false;
  if (o.ends_at && o.ends_at < today) return false;
  return true;
}

/**
 * Does the stay fall inside the offer's date window?
 *
 * The window gates the STAY, not the publication: a host offering "10% off the
 * 1st–8th" means guests staying those dates. The whole stay must fit, so there
 * is never a half-discounted booking. Check-out day is not a night, hence the
 * last night is the day before check-out.
 *
 * Missing dates → treated as not covered rather than as covered: a stay whose
 * dates we don't know cannot be shown to qualify.
 */
export function stayInWindow(
  offer: Pick<HostOffer, 'starts_at' | 'ends_at'>,
  checkIn: string,
  checkOut: string,
): boolean {
  if (!offer.starts_at && !offer.ends_at) return true; // unbounded both ways
  if (!checkIn || !checkOut) return false;
  if (offer.starts_at && checkIn < offer.starts_at) return false;
  if (offer.ends_at) {
    const lastNight = new Date(checkOut + 'T00:00:00');
    lastNight.setDate(lastNight.getDate() - 1);
    if (toISODate(lastNight) > offer.ends_at) return false;
  }
  return true;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * How many nights of a stay a free-nights offer makes free.
 *
 * The deal REPEATS: a 2+1 offer turns each complete 3-night cycle into two
 * paid nights and one free one, so a 7-night stay (two whole cycles plus a
 * remainder) yields 2 free nights. A stay shorter than one full cycle yields
 * 0 — the guest hasn't earned the free night yet. Always 0 for discount
 * offers, which take a percentage instead.
 */
export function freeNightsFor(
  offer: Pick<HostOffer, 'offer_type' | 'buy_nights' | 'free_nights'>,
  nights: number,
): number {
  if (offer.offer_type !== 'free_nights') return 0;
  const buy = Number(offer.buy_nights);
  const free = Number(offer.free_nights);
  if (!Number.isFinite(nights) || nights <= 0) return 0;
  const cycle = buy + free;
  if (cycle <= 0 || nights < cycle) return 0;
  return Math.floor(nights / cycle) * free;
}

/** Stay total after the offer is applied. Identical formula on client + server. */
export function applyOfferToTotal(
  offer: Pick<HostOffer, 'offer_type' | 'buy_nights' | 'free_nights' | 'discount_percent'> | null,
  nightlyRate: number,
  nights: number,
): number {
  const full = nightlyRate * nights;
  if (!offer || nights <= 0) return round2(full);
  if (offer.offer_type === 'discount') {
    return round2(full * (1 - Number(offer.discount_percent) / 100));
  }
  return round2((nights - freeNightsFor(offer, nights)) * nightlyRate);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** True when this offer actually reduces the price of this particular stay. */
export function offerAppliesTo(
  offer: HostOffer,
  nights: number,
  checkIn: string,
  checkOut: string,
): boolean {
  if (!stayInWindow(offer, checkIn, checkOut)) return false;
  if (offer.offer_type === 'discount') return nights > 0;
  return freeNightsFor(offer, nights) > 0;
}

/**
 * The offer that gives this stay the lowest total — tie-break oldest
 * created_at, so the rule is deterministic and the server reaches the same
 * answer. Returns null when no offer covers the stay.
 *
 * `nights <= 0` (no dates picked yet) → the best offer to ADVERTISE, so the
 * property page can show "2+1" or "−10%" before dates are chosen. That preview
 * never feeds the price: applyOfferToTotal() with 0 nights returns 0.
 */
export function findOfferForStay(
  offers: HostOffer[],
  nights: number,
  checkIn = '',
  checkOut = '',
): HostOffer | null {
  if (offers.length === 0) return null;

  if (nights <= 0) {
    // Advertise the easiest deal to reach: discounts need no minimum stay, so
    // they lead; among free-night deals, the shortest cycle.
    return [...offers].sort((a, b) =>
      Number(a.offer_type !== 'discount') - Number(b.offer_type !== 'discount') ||
      cycleOf(a) - cycleOf(b) ||
      a.created_at.localeCompare(b.created_at))[0] ?? null;
  }

  const usable = offers.filter((o) => offerAppliesTo(o, nights, checkIn, checkOut));
  if (usable.length === 0) return null;

  // Compare on a unit nightly rate: the ranking is rate-independent, since
  // both kinds scale linearly with it.
  return usable.sort((a, b) =>
    applyOfferToTotal(a, 1, nights) - applyOfferToTotal(b, 1, nights) ||
    a.created_at.localeCompare(b.created_at))[0];
}

function cycleOf(o: HostOffer): number {
  return o.offer_type === 'free_nights' ? Number(o.buy_nights) + Number(o.free_nights) : 0;
}

/**
 * Live offers for one property.
 * Fail-safe: any error returns [] so an offer problem can never break a page.
 */
export async function fetchOffersForProperty(propertyId: string): Promise<HostOffer[]> {
  try {
    if (!propertyId) return [];
    const { data, error } = await supabase
      .from('host_offers')
      .select('*')
      .eq('property_id', propertyId)
      .eq('active', true);
    if (error || !data) return [];
    const today = todayInGeorgia();
    return (data as HostOffer[]).filter((o) => isWellFormed(o) && isLiveToday(o, today));
  } catch {
    return [];
  }
}

/** The deal to advertise on a property's card. */
export type CardOffer = Pick<HostOffer, 'offer_type' | 'buy_nights' | 'free_nights' | 'discount_percent'>;

/** Card fields plus the stay window, which the booking widget also shows. */
export type WidgetOffer = CardOffer & Pick<HostOffer, 'starts_at' | 'ends_at'>;

/**
 * The offer's stay window as a short label ("1 – 8 Sep"), or null when the
 * offer is open-ended in both directions and there is nothing to say.
 *
 * Deliberately terse: it sits beside the deal badge on the cottage page, where
 * a guest needs to know at a glance whether their dates are in range.
 */
export function offerWindowParts(
  offer: Pick<HostOffer, 'starts_at' | 'ends_at'>,
): { kind: 'between' | 'from' | 'until'; from?: string; to?: string; date?: string } | null {
  const short = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (offer.starts_at && offer.ends_at) {
    return { kind: 'between', from: short(offer.starts_at), to: short(offer.ends_at) };
  }
  if (offer.starts_at) return { kind: 'from', date: short(offer.starts_at) };
  if (offer.ends_at) return { kind: 'until', date: short(offer.ends_at) };
  return null;
}
export type OfferByProperty = Record<string, CardOffer>;

/**
 * Every property that currently has a live offer, with the deal to advertise
 * on its card. Keyed by property id so the search page and the home grid can
 * stamp badges without an extra query per card.
 *
 * Advertises the easiest deal to reach (see findOfferForStay). The price a
 * guest pays is still decided per stay, and re-verified by the server.
 *
 * Fail-safe: any error returns {} so an offer problem can never break a page.
 */
export async function fetchOfferedProperties(): Promise<OfferByProperty> {
  try {
    const { data, error } = await supabase
      .from('host_offers')
      .select('*')
      .eq('active', true);
    if (error || !data) return {};
    const today = todayInGeorgia();

    const byProperty: Record<string, HostOffer[]> = {};
    for (const o of data as HostOffer[]) {
      if (!isWellFormed(o) || !isLiveToday(o, today)) continue;
      (byProperty[o.property_id] ??= []).push(o);
    }

    const out: OfferByProperty = {};
    for (const [propertyId, offers] of Object.entries(byProperty)) {
      const best = findOfferForStay(offers, 0);
      if (best) out[propertyId] = best;
    }
    return out;
  } catch {
    return {};
  }
}
