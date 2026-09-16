// Email templates for booking-reminders.
//
// emailWrapper, bookingTable and buildReminderEmailHtml are moved VERBATIM from
// the previous index.ts (git ae5de3a); only `export` was added. They
// interpolate their arguments as-is, so callers MUST escape values first
// (handler.ts passes everything through safeRecord()/escapeHtml(), and subjects
// through subjectSafe()).
//
// HOST EMAIL PRIVACY POLICY — PERMANENT RULE
// Reminder emails to hosts must NEVER contain customer personal details:
//   ✗ No customer name, email, or phone
//   ✓ Only: Booking ID, property name, dates, guests, total price
// All host reminder emails are in Georgian.

export const SITE_URL = 'https://rentcottage.ge';

export function emailWrapper(content: string): string {
  return `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#111">
    <div style="background:#e53e3e;padding:28px 36px;border-radius:12px 12px 0 0">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">RentCottage.Ge</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:36px;border-radius:0 0 12px 12px">
      ${content}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
      <p style="color:#9ca3af;font-size:12px;margin:0">© 2025 RentCottage.Ge</p>
    </div>
  </div>`;
}

export function bookingTable(rows: [string, string][]): string {
  return `<table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
    ${rows.map(([label, value], i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:12px 16px;font-weight:600;border:1px solid #e5e7eb;color:#374151;width:38%">${label}</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#111">${value}</td>
      </tr>`).join('')}
  </table>`;
}

// ─── Host reminder email builder — GEORGIAN ───────────────────────────────────
export function buildReminderEmailHtml(
  hostFirstName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: Record<string, any>,
  reminderNumber: 1 | 2,
  hoursElapsed: number
): string {
  const urgencyColor = reminderNumber === 2 ? '#dc2626' : '#d97706';
  const urgencyBg = reminderNumber === 2 ? '#fef2f2' : '#fffbeb';
  const urgencyBorder = reminderNumber === 2 ? '#fecaca' : '#fde68a';
  const urgencyText = reminderNumber === 2 ? '#991b1b' : '#92400e';
  const hoursLeft = Math.max(0, 24 - hoursElapsed);

  const urgencyLabel = reminderNumber === 2
    ? `⚠️ დარჩენილია მხოლოდ ~${hoursLeft} საათი ამ მოთხოვნის ვადის გასვლამდე!`
    : `⏰ ეს მოთხოვნა ${hoursElapsed} საათია ელოდება პასუხს.`;

  const titleText = reminderNumber === 2
    ? '⚠️ გადაუდებელი: ჯავშნის მოთხოვნა ვადის ამოწურვის პირასაა'
    : '⏰ შეხსენება: ჯავშნის მოთხოვნა საჭიროებს პასუხს';

  return emailWrapper(`
    <h2 style="color:${urgencyColor};margin-top:0">${titleText}</h2>
    <p>გამარჯობა ${hostFirstName},</p>
    <p>თქვენ გაქვთ <strong>განუხილველი ჯავშნის მოთხოვნა</strong>, რომელიც ჯერ კიდევ საჭიროებს თქვენს პასუხს.
    ჯავშნის მოთხოვნები <strong>ავტომატურად უარიყოფება 24 საათის შემდეგ</strong>, თუ არ მოიქმედებთ.</p>

    ${bookingTable([
      ['ჯავშნის ID', String(booking.id)],
      ['კოტეჯი', String(booking.property_title)],
      ['ჩასვლის თარიღი', String(booking.check_in)],
      ['გასვლის თარიღი', String(booking.check_out)],
      ['სტუმრების რაოდენობა', String(booking.guests || '—')],
      ['ჯამური ფასი', booking.total_price ? '₾' + booking.total_price : '—'],
      ['სტატუსი', 'დადასტურების მოლოდინში'],
    ])}

    <div style="background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:${urgencyText}">
      <strong>${urgencyLabel}</strong><br>
      გთხოვთ, შეხვიდეთ ჰოსტის პანელში და დაადასტუროთ ან უარყოთ ეს მოთხოვნა.
    </div>

    <div style="text-align:center;margin:28px 0">
      <a href="${SITE_URL}/host-dashboard"
         style="display:inline-block;background:${urgencyColor};color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">
        მოთხოვნის განხილვა პანელში
      </a>
    </div>

    <p style="color:#6b7280;font-size:13px;margin:0">
      თუ 24 საათის განმავლობაში არ უპასუხეთ, ჯავშანი ავტომატურად უარყოფილი იქნება და სტუმარი შეატყობინება.
    </p>
  `);
}

// ─── Escaping helpers ─────────────────────────────────────────────────────────

/** HTML-escapes one value for element content or a quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Copy of a row with every string value HTML-escaped (numbers/booleans/nulls unchanged). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeRecord<T extends Record<string, any>>(row: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === 'string' ? escapeHtml(v) : v;
  return out as T;
}

// C0 controls, DEL and Unicode line/paragraph separators, built from char codes
// so this source file contains no control characters.
const SUBJECT_CONTROL_CHARS = new RegExp(
  '[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) +
    String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + ']+',
  'g',
);

/** Plain-text subject: no CR/LF or other control characters, length-capped. */
export function subjectSafe(value: unknown, max = 200): string {
  return String(value ?? '').replace(SUBJECT_CONTROL_CHARS, ' ').trim().slice(0, max);
}
