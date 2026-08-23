/**
 * Server-side host-offer lookup + price math.
 *
 * Two kinds of deal, mirroring src/lib/hostOffers.ts exactly:
 *   'free_nights'  "2+1" — repeats per whole cycle.
 *   'discount'     a straight percentage off the stay.
 *
 * ⚠️ KEEP IN SYNC with src/lib/hostOffers.ts — the client must select the same
 * offer (cheapest resulting total, tie-break oldest created_at), apply the same
 * date-window eligibility, and round the same way, otherwise bog-payment's
 * price verification would reject legitimate bookings with PRICE_MISMATCH.
 */

export interface ActiveHostOffer {
  id: string;
  offer_type: 'free_nights' | 'discount';
  buy_nights: number | null;
  free_nights: number | null;
  discount_percent: number | null;
}

/** Today as YYYY-MM-DD in Georgia's timezone — deterministic on any runtime. */
export function todayInGeorgia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());
}

/**
 * Does the stay fall inside the offer's date window?
 *
 * The window gates the STAY, not the publication: "10% off the 1st–8th" means
 * guests staying those dates, so the whole stay must fit. Check-out day is not
 * a night, hence the last night is the day before check-out.
 */
export function stayInWindow(
  offer: { starts_at: string | null; ends_at: string | null },
  checkIn: string,
  checkOut: string,
): boolean {
  if (!offer.starts_at && !offer.ends_at) return true;
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
 * How many nights a free-nights offer makes free. The deal REPEATS: a 2+1
 * offer gives one free night per complete 3-night cycle, so a 7-night stay
 * yields 2. Shorter than one cycle → 0. Always 0 for discount offers.
 */
export function freeNightsFor(
  offer: { offer_type: string; buy_nights: number | null; free_nights: number | null },
  nights: number,
): number {
  if (offer.offer_type !== 'free_nights') return 0;
  const buy = Number(offer.buy_nights);
  const free = Number(offer.free_nights);
  if (!isFinite(nights) || nights <= 0) return 0;
  const cycle = buy + free;
  if (cycle <= 0 || nights < cycle) return 0;
  return Math.floor(nights / cycle) * free;
}

/** Stay total after the offer is applied. Identical formula on client + server. */
export function applyOfferToTotal(
  offer: ActiveHostOffer | null,
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

/**
 * The live host offer that gives this stay the lowest total — tie-break oldest
 * created_at. Same choice as the client.
 *
 * FAIL-SAFE: any error (missing table, network, bad data) returns null so an
 * offer problem can never block a booking — the guest just pays full price.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findActiveOfferForStay(
  supabase: any,
  propertyId: string,
  nights: number,
  checkIn: string,
  checkOut: string,
): Promise<ActiveHostOffer | null> {
  try {
    if (!propertyId || !isFinite(nights) || nights <= 0) return null;
    const today = todayInGeorgia();
    const { data, error } = await supabase
      .from('host_offers')
      .select('id, offer_type, buy_nights, free_nights, discount_percent, starts_at, ends_at, created_at')
      .eq('property_id', propertyId)
      .eq('active', true);
    if (error || !data) return null;

    type Row = ActiveHostOffer & { starts_at: string | null; ends_at: string | null; created_at: string };

    const candidates = (data as Row[]).filter((o) => {
      if (o.ends_at && o.ends_at < today) return false;          // window already over
      if (!stayInWindow(o, checkIn, checkOut)) return false;      // stay outside the window
      if (o.offer_type === 'discount') {
        const pct = Number(o.discount_percent);
        return isFinite(pct) && pct > 0 && pct <= 90;
      }
      const buy = Number(o.buy_nights);
      const free = Number(o.free_nights);
      if (!Number.isInteger(buy) || !Number.isInteger(free)) return false;
      if (buy < 1 || buy > 30 || free < 1 || free > 30 || free > buy) return false;
      return freeNightsFor(o, nights) > 0;
    });
    if (candidates.length === 0) return null;

    // Rank on a unit nightly rate — the ordering is rate-independent, since
    // both kinds scale linearly with it.
    candidates.sort((a, b) =>
      applyOfferToTotal(a, 1, nights) - applyOfferToTotal(b, 1, nights) ||
      a.created_at.localeCompare(b.created_at));

    const best = candidates[0];
    return {
      id: best.id,
      offer_type: best.offer_type,
      buy_nights: best.buy_nights === null ? null : Number(best.buy_nights),
      free_nights: best.free_nights === null ? null : Number(best.free_nights),
      discount_percent: best.discount_percent === null ? null : Number(best.discount_percent),
    };
  } catch (e) {
    console.error('[hostOffers] lookup failed (treated as no offer):', e);
    return null;
  }
}
