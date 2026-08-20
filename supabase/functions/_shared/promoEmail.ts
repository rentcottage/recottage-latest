/**
 * Promo / discount disclosure for automatic emails.
 *
 * A discounted booking stores three audit columns (see db/promos-create.sql):
 * `promo_discount_percent`, `pre_discount_total`, and the ALREADY-DISCOUNTED
 * `total_price`. Before this module the emails only ever printed `total_price`,
 * so a host received a total lower than their own nightly rate × nights with
 * nothing explaining the gap — it read like an error, or like the platform had
 * quietly shaved their price. These helpers turn those columns into an explicit
 * "was → discount → now" breakdown.
 *
 * The stored booking row is the only input: the email can never show a discount
 * that was not actually recorded on the booking, and never a different number
 * from the one the guest was charged.
 *
 * FAIL-SAFE, exactly like the promo lookup in ./promos.ts — anything missing,
 * unparseable, or inconsistent yields null, and every email then renders
 * character-for-character as it did before promos existed. A promo problem must
 * never cost a host their booking notification.
 *
 * Host-facing copy is Georgian, matching the other host emails.
 */

export interface PromoContext {
  /** Promo title, e.g. "ზაფხულის ფასდაკლება ბათუმში". Null if it was deleted. */
  title: string | null;
  percent: number;
  before: number;
  after: number;
  /** before − after, i.e. the money actually deducted. */
  amount: number;
}

/** ₾ with two decimals — emails must not show `405.0000000001` or a bare `405`. */
export function gel(n: number): string {
  return '₾' + n.toFixed(2);
}

/**
 * Reads the discount off a stored booking row and, when a promo_id is present,
 * looks up its title so the host sees WHICH offer applied, not just a number.
 * Returns null when the booking carries no usable discount.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPromoContext(supabase: any, booking: Record<string, any> | null): Promise<PromoContext | null> {
  try {
    if (!booking) return null;
    const percent = Number(booking.promo_discount_percent);
    const before  = Number(booking.pre_discount_total);
    const after   = Number(booking.total_price);
    if (!isFinite(percent) || percent <= 0) return null;
    if (!isFinite(before) || !isFinite(after)) return null;
    if (before <= after) return null; // nothing was actually deducted

    let title: string | null = null;
    if (booking.promo_id) {
      const { data } = await supabase
        .from('promos').select('title').eq('id', String(booking.promo_id)).maybeSingle();
      title = data?.title ? String(data.title) : null;
    }
    return { title, percent, before, after, amount: before - after };
  } catch (e) {
    console.error('[promos] email disclosure failed (rendering without it):', e);
    return null;
  }
}

/** Highlighted "why is this total lower than usual" box for host emails — GEORGIAN. */
export function promoNoticeBlock(promo: PromoContext | null): string {
  if (!promo) return '';
  const named = promo.title ? ` — <strong>${promo.title}</strong>` : '';
  return `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#166534;line-height:1.7">
      <strong>🏷️ ამ ჯავშანს ფასდაკლება მოაკლდა${named}</strong><br>
      ამიტომ არის ჯამური თანხა ჩვეულებრივ ფასზე ნაკლები:<br>
      ფასდაკლებამდე <strong>${gel(promo.before)}</strong>
      − ფასდაკლება <strong>${promo.percent}%</strong> (${gel(promo.amount)})
      = გადასახდელი <strong>${gel(promo.after)}</strong>
    </div>`;
}

/** The same breakdown as booking-detail rows — GEORGIAN (host emails). */
export function promoRows(promo: PromoContext | null): [string, string][] {
  if (!promo) return [];
  return [
    ['ფასდაკლებამდე ჯამი', gel(promo.before)],
    ['ფასდაკლება', `−${gel(promo.amount)} (${promo.percent}%${promo.title ? ` — ${promo.title}` : ''})`],
  ];
}
