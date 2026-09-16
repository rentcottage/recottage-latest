// Email and HTML templates for booking-handler.
//
// Moved VERBATIM from the previous index.ts (git 2b0e1a3, including the promo
// host-email additions) so email content is unchanged. The only additions are
// at the bottom: escaping helpers, and templates that used to be written
// inline in the request router.
//
// SECURITY: these builders interpolate their arguments into HTML as-is.
// Callers MUST pass values through `safeRecord()` / `escapeHtml()` first
// (handler.ts does this for every email). Subjects go through `subjectSafe()`.

import { promoNoticeBlock, promoRows, type PromoContext } from '../_shared/promoEmail.ts';

export const COMPANY_EMAIL = 'info.rentcottage@gmail.com';
export const SITE_URL = 'https://rentcottage.ge';

// ─── Sanitized booking type for host emails — NO customer fields allowed ──────
export interface HostSafeBooking {
  id: string | number;
  property_title: string;
  check_in: string;
  check_out: string;
  guests?: number | string | null;
  total_price?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
  approval_deadline?: string | null;
  // Promo audit columns — booking-level money facts, NOT customer details, so
  // they belong in a host email: they are what explains the discounted total.
  promo_id?: string | null;
  promo_discount_percent?: number | string | null;
  pre_discount_total?: number | string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toHostSafeBooking(booking: Record<string, any>): HostSafeBooking {
  return {
    id: booking.id,
    property_title: booking.property_title,
    check_in: booking.check_in,
    check_out: booking.check_out,
    guests: booking.guests ?? null,
    total_price: booking.total_price ?? null,
    payment_method: booking.payment_method ?? null,
    payment_status: booking.payment_status ?? null,
    status: booking.status ?? null,
    approval_deadline: booking.approval_deadline ?? null,
    promo_id: booking.promo_id ?? null,
    promo_discount_percent: booking.promo_discount_percent ?? null,
    pre_discount_total: booking.pre_discount_total ?? null,
  };
}

export function emailWrapper(content: string) {
  return `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#111"><div style="background:#e53e3e;padding:28px 36px;border-radius:12px 12px 0 0"><h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">RentCottage.Ge</h1></div><div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:36px;border-radius:0 0 12px 12px">${content}<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0"><p style="color:#9ca3af;font-size:12px;margin:0">© 2025 RentCottage.Ge</p></div></div>`;
}

export function bookingTable(rows: [string, string][], highlight?: string) {
  return `<table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">${rows.map(([label, value], i) => `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}"><td style="padding:12px 16px;font-weight:600;border:1px solid #e5e7eb;color:#374151;width:38%">${label}</td><td style="padding:12px 16px;border:1px solid #e5e7eb;color:#111;${highlight && label === highlight ? 'font-weight:700;font-size:15px' : ''}">${value}</td></tr>`).join('')}</table>`;
}

export function contactCard(name: string, email: string, phone: string | null | undefined): string {
  const phoneRow = phone ? `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #e5e7eb">
      <span style="font-size:18px">📞</span>
      <div>
        <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Phone</p>
        <a href="tel:${phone}" style="color:#111;font-size:14px;font-weight:600;text-decoration:none">${phone}</a>
      </div>
    </div>` : '';
  return `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #e5e7eb">
        <span style="font-size:18px">👤</span>
        <div>
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Name</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:#111">${name}</p>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;${phone ? 'border-bottom:1px solid #e5e7eb' : ''}">
        <span style="font-size:18px">✉️</span>
        <div>
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Email</p>
          <a href="mailto:${email}" style="color:#16a34a;font-size:14px;font-weight:600;text-decoration:none">${email}</a>
        </div>
      </div>
      ${phoneRow}
    </div>`;
}

export function cancellationPolicyBlock(): string {
  return `
    <div style="background:#fff8f0;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:24px 0">
      <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#92400e">📋 Cancellation &amp; Refund Policy</p>
      <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #fed7aa">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <p style="margin:0;font-weight:700;color:#374151;font-size:14px">Flexible</p>
          <span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px">Most Popular</span>
        </div>
        <p style="margin:0 0 4px;color:#4b5563;font-size:14px;line-height:1.5">Guests can cancel 2 or more days before check-in and receive a full refund for online payments.</p>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5"><em>Refund Policy: For online payments, if the booking is canceled 2 or more days before the check-in date, the guest will receive a full refund.</em></p>
      </div>
      <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #fed7aa">
        <p style="margin:0 0 4px;font-weight:700;color:#374151;font-size:14px">Moderate</p>
        <p style="margin:0 0 4px;color:#4b5563;font-size:14px;line-height:1.5">Guests can cancel up to 2 days before check-in and receive a 90% refund for online payments.</p>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5"><em>Refund Policy: For online payments, if the booking is canceled within 2 days before check-in, the guest will receive a 90% refund.</em></p>
      </div>
      <div>
        <p style="margin:0 0 4px;font-weight:700;color:#374151;font-size:14px">Strict</p>
        <p style="margin:0 0 4px;color:#4b5563;font-size:14px;line-height:1.5">If the booking is canceled within 24 hours before check-in, the guest will receive an 80% refund for online payments.</p>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5"><em>Refund Policy: For online payments, if the booking is canceled within 24 hours before check-in, the guest will receive an 80% refund.</em></p>
      </div>
    </div>`;
}

// ─── Customer-facing email templates ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildConfirmEmailHtml(booking: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#16a34a;margin-top:0">Your booking is confirmed! 🎉</h2>
    <p>Hi <strong>${booking.user_name || 'there'}</strong>, your booking has been <strong>approved</strong>.</p>
    ${bookingTable([
      ['Booking ID', String(booking.id)], ['Cottage', booking.property_title],
      ['Check-in', booking.check_in], ['Check-out', booking.check_out],
      ['Guests', String(booking.guests)], ['Total', '₾' + booking.total_price], ['Status', 'Confirmed ✅'],
    ], 'Total')}
    ${cancellationPolicyBlock()}
    <p style="color:#6b7280;font-size:13px;margin:0">To cancel your booking, visit <a href="${SITE_URL}/profile" style="color:#e53e3e">My Profile</a> and go to My Bookings.</p>`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRejectEmailHtml(booking: Record<string, any>, rejectionNote?: string, rejectedBy: 'host' | 'admin' = 'host'): string {
  const noteLabel = rejectedBy === 'admin' ? 'Reason for rejection:' : 'Reason from host:';
  const noteBlock = rejectionNote
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0">
        <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#991b1b">${noteLabel}</p>
        <p style="margin:0;font-size:14px;color:#7f1d1d;line-height:1.6">${rejectionNote}</p>
      </div>`
    : '';
  return emailWrapper(`
    <h2 style="color:#e53e3e;margin-top:0">Booking Update</h2>
    <p>Hi <strong>${booking.user_name || 'there'}</strong>, your booking request for <strong>${booking.property_title}</strong> was not approved.</p>
    ${bookingTable([['Booking ID', String(booking.id)], ['Cottage', booking.property_title], ['Check-in', booking.check_in], ['Check-out', booking.check_out]])}
    ${noteBlock}
    <div style="text-align:center;margin:28px 0"><a href="${SITE_URL}/search" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600">Browse Other Cottages</a></div>`);
}

// ─── Host-facing rejection email (admin rejected) — GEORGIAN ─────────────────
export function buildHostAdminRejectedBookingEmailHtml(hostFirstName: string, booking: HostSafeBooking, rejectionNote?: string): string {
  const noteBlock = rejectionNote
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0">
        <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#991b1b">უარყოფის მიზეზი:</p>
        <p style="margin:0;font-size:14px;color:#7f1d1d;line-height:1.6">${rejectionNote}</p>
      </div>`
    : '';
  return emailWrapper(`
    <h2 style="color:#e53e3e;margin-top:0">ჯავშნის მოთხოვნა უარყოფილია ადმინის მიერ</h2>
    <p>გამარჯობა ${hostFirstName},</p>
    <p>თქვენი ობიექტის <strong>${booking.property_title}</strong> ჯავშნის მოთხოვნა <strong>ადმინის მიერ უარყოფილია</strong>.</p>
    ${bookingTable([
      ['ჯავშნის ID', String(booking.id)],
      ['კოტეჯი', booking.property_title],
      ['ჩასვლის თარიღი', booking.check_in],
      ['გასვლის თარიღი', booking.check_out],
      ['სტუმრების რაოდენობა', String(booking.guests || '—')],
      ['სტატუსი', 'უარყოფილია ადმინის მიერ'],
    ])}
    ${noteBlock}
    <p style="color:#6b7280;font-size:13px;margin:0">კითხვების შემთხვევაში, დაგვიკავშირდით: <a href="mailto:${COMPANY_EMAIL}" style="color:#e53e3e">${COMPANY_EMAIL}</a>.</p>
    <div style="text-align:center;margin:24px 0"><a href="${SITE_URL}/host-dashboard" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700">პანელის ნახვა</a></div>
  `);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildExpiredApprovalEmailHtml(booking: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#e53e3e;margin-top:0">Booking Request Expired</h2>
    <p>Hi <strong>${booking.user_name || 'there'}</strong>,</p>
    <p>Unfortunately, your booking request for <strong>${booking.property_title}</strong> has <strong>expired</strong> because the host did not respond within the 24-hour approval window.</p>
    ${bookingTable([['Booking ID', String(booking.id)], ['Cottage', booking.property_title], ['Check-in', booking.check_in], ['Check-out', booking.check_out], ['Guests', String(booking.guests)], ['Total', '₾' + booking.total_price]])}
    ${booking.payment_status === 'paid' ? '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#92400e;"><strong>Refund:</strong> Since you paid online, a full refund will be processed within 5–10 business days.</div>' : ''}
    <div style="text-align:center;margin:28px 0"><a href="${SITE_URL}/search" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600">Browse Other Cottages</a></div>`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildAutoConfirmCustomerEmailHtml(booking: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#16a34a;margin-top:0">Booking Confirmed! 🎉</h2>
    <p>Hi <strong>${booking.user_name || 'there'}</strong>, your booking has been <strong>automatically confirmed</strong>!</p>
    ${bookingTable([
      ['Booking ID', String(booking.id)], ['Cottage', booking.property_title],
      ['Check-in', booking.check_in], ['Check-out', booking.check_out],
      ['Guests', String(booking.guests)], ['Total', '₾' + booking.total_price],
      ['Payment Method', booking.payment_method === 'pay_at_property' ? 'Pay at Property (on arrival)' : 'Online'],
      ['Status', 'Confirmed ✅'],
    ], 'Total')}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#166534;">
      <strong>All set!</strong> Your booking is confirmed. ${booking.payment_method === 'pay_at_property' ? 'You will pay when you arrive at the property.' : ''}
    </div>
    ${cancellationPolicyBlock()}
    <p style="color:#6b7280;font-size:13px;margin:0">To cancel your booking, visit <a href="${SITE_URL}/profile" style="color:#e53e3e">My Profile</a> and go to My Bookings.</p>
    <div style="text-align:center;margin:24px 0"><a href="${SITE_URL}/profile" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700">View My Bookings</a></div>`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildHostCancelCustomerEmailHtml(booking: Record<string, any>, refundNote: string): string {
  return emailWrapper(`
    <h2 style="color:#e53e3e;margin-top:0">Your booking has been cancelled by the host</h2>
    <p>Hi <strong>${booking.user_name || 'there'}</strong>, we are sorry — the host cancelled your confirmed booking for <strong>${booking.property_title}</strong>.</p>
    ${bookingTable([
      ['Booking ID', String(booking.id)], ['Cottage', booking.property_title],
      ['Location', booking.property_location || '—'], ['Check-in', booking.check_in],
      ['Check-out', booking.check_out], ['Total', '₾' + booking.total_price],
      ['Status', 'Cancelled by Host'],
    ])}
    ${refundNote ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#92400e"><strong>Refund:</strong> ${refundNote}</div>` : ''}
    <div style="text-align:center;margin:24px 0"><a href="${SITE_URL}/search" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700">Browse Other Cottages</a></div>`);
}

// ─── Host-facing email: new booking request — GEORGIAN ───────────────────────
export function buildHostNewBookingEmailHtml(hostFirstName: string, booking: HostSafeBooking, promo: PromoContext | null = null): string {
  const paymentMethodLabel = booking.payment_method === 'pay_at_property'
    ? 'ადგილზე გადახდა (ჩასვლისას)'
    : booking.payment_method === 'online'
    ? 'ონლაინ გადახდა'
    : '—';

  const deadlineLabel = booking.approval_deadline
    ? (() => {
        const d = new Date(booking.approval_deadline);
        return d.toLocaleString('ka-GE', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false,
        });
      })()
    : '—';

  return emailWrapper(`
    <h2 style="color:#16a34a;margin-top:0">თქვენ გაქვთ ახალი ჯავშნის მოთხოვნა! 🏡</h2>
    <p>გამარჯობა ${hostFirstName},</p>
    <p>სტუმარმა მოითხოვა თქვენი ობიექტის დაჯავშნა. გთხოვთ, განიხილოთ და <strong>24 საათის განმავლობაში</strong> უპასუხოთ.</p>
    ${promoNoticeBlock(promo)}
    ${bookingTable([
      ['ჯავშნის ID', String(booking.id)],
      ['კოტეჯი', String(booking.property_title)],
      ['ჩასვლის თარიღი', String(booking.check_in)],
      ['გასვლის თარიღი', String(booking.check_out)],
      ['სტუმრების რაოდენობა', String(booking.guests || '—')],
      ...promoRows(promo),
      [promo ? 'ჯამური ფასი (ფასდაკლებით)' : 'ჯამური ფასი', booking.total_price != null ? '₾' + booking.total_price : '—'],
      ['გადახდის მეთოდი', paymentMethodLabel],
      ['დადასტურების ბოლო ვადა', deadlineLabel],
      ['სტატუსი', 'დადასტურების მოლოდინში'],
    ])}
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:20px 0;font-size:14px;color:#92400e;">
      <strong>⏰ საჭიროა მოქმედება:</strong> თქვენ გაქვთ <strong>24 საათი</strong> ამ ჯავშნის დასადასტურებლად ან უარსაყოფად. თუ არ მოიქმედებთ, მოთხოვნა ავტომატურად გაუქმდება.
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE_URL}/host-dashboard" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700">გადადით მასპინძლის პანელში და დაადასტურეთ ან უარყავით ჯავშანი</a>
    </div>
  `);
}

// ─── Host-facing email: guest cancelled — GEORGIAN ───────────────────────────
export function buildHostGuestCancelledEmailHtml(hostFirstName: string, booking: HostSafeBooking): string {
  return emailWrapper(`
    <h2 style="color:#e53e3e;margin-top:0">სტუმარმა გააუქმა ჯავშანი</h2>
    <p>გამარჯობა ${hostFirstName},</p>
    <p>სტუმარმა გააუქმა ჯავშანი <strong>${booking.property_title}</strong>-ისთვის. თარიღები ახლა ხელმისაწვდომია ახალი ჯავშნებისთვის.</p>
    ${bookingTable([
      ['ჯავშნის ID', String(booking.id)],
      ['კოტეჯი', booking.property_title],
      ['ჩასვლის თარიღი', booking.check_in],
      ['გასვლის თარიღი', booking.check_out],
      ['სტუმრების რაოდენობა', String(booking.guests || '—')],
      ['სტატუსი', 'გაუქმებულია სტუმრის მიერ'],
    ])}
    <div style="text-align:center;margin:24px 0"><a href="${SITE_URL}/host-dashboard" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700">პანელში ნახვა</a></div>
  `);
}

// ─── Contact reveal email — customer ─────────────────────────────────────────
export function buildCustomerContactRevealEmailHtml(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: Record<string, any>,
  hostName: string,
  hostEmail: string,
  hostPhone: string | null
): string {
  return emailWrapper(`
    <h2 style="color:#16a34a;margin-top:0">Your host contact details are now available 🔓</h2>
    <p>Hi <strong>${booking.user_name || 'there'}</strong>,</p>
    <p>Your check-in for <strong>${booking.property_title}</strong> is <strong>tomorrow</strong>! You can now see your host's contact details below.</p>
    ${bookingTable([
      ['Booking ID', String(booking.id)],
      ['Cottage', booking.property_title],
      ['Check-in', String(booking.check_in)],
      ['Check-out', String(booking.check_out)],
      ['Guests', String(booking.guests || '—')],
    ])}
    <p style="font-size:15px;font-weight:700;color:#111;margin:24px 0 8px">Your Host</p>
    ${contactCard(hostName, hostEmail, hostPhone)}
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:20px 0;font-size:14px;color:#92400e;">
      <strong>Tip:</strong> Reach out to your host to confirm arrival time and any last-minute details.
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE_URL}/profile" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700">View My Bookings</a>
    </div>
  `);
}

// ─── Contact reveal email — host ─────────────────────────────────────────────
export function buildHostContactRevealEmailHtml(
  hostFirstName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: Record<string, any>,
  guestName: string,
  guestEmail: string,
  guestPhone: string | null
): string {
  return emailWrapper(`
    <h2 style="color:#16a34a;margin-top:0">სტუმრის საკონტაქტო ინფორმაცია ხელმისაწვდომია 🔓</h2>
    <p>გამარჯობა ${hostFirstName},</p>
    <p>ჯავშნის <strong>#${booking.id}</strong> ჩასვლა <strong>${booking.property_title}</strong>-ში <strong>ხვალ</strong> არის. სტუმრის საკონტაქტო ინფორმაცია ახლა ხელმისაწვდომია.</p>
    ${bookingTable([
      ['ჯავშნის ID', String(booking.id)],
      ['კოტეჯი', booking.property_title],
      ['ჩასვლის თარიღი', String(booking.check_in)],
      ['გასვლის თარიღი', String(booking.check_out)],
      ['სტუმრების რაოდენობა', String(booking.guests || '—')],
    ])}
    <p style="font-size:15px;font-weight:700;color:#111;margin:24px 0 8px">თქვენი სტუმარი</p>
    ${contactCard(guestName, guestEmail, guestPhone)}
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:20px 0;font-size:14px;color:#92400e;">
      <strong>რჩევა:</strong> დაუკავშირდით სტუმარს ჩასვლის დროის და სპეციალური მოთხოვნების დასადასტურებლად.
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE_URL}/host-dashboard" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700">პანელში ნახვა</a>
    </div>
  `);
}

// ─── Escaping helpers ─────────────────────────────────────────────────────────

/** HTML-escapes one value for safe interpolation into element content or a quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Copy of a DB row with every string value HTML-escaped. Numbers, booleans and
 * nulls are kept as-is so `booking.total_price != null`-style checks and
 * `payment_status === 'paid'` comparisons in the templates behave unchanged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeRecord<T extends Record<string, any>>(row: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === 'string' ? escapeHtml(v) : v;
  return out as T;
}

// C0 controls, DEL, and the Unicode line/paragraph separators — built from
// char codes so the source file itself contains no control characters.
const SUBJECT_CONTROL_CHARS = new RegExp(
  '[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) +
    String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + ']+',
  'g',
);

/** Plain-text email subject: no CR/LF or other control characters, length-capped. */
export function subjectSafe(value: unknown, max = 200): string {
  return String(value ?? '').replace(SUBJECT_CONTROL_CHARS, ' ').trim().slice(0, max);
}

// ─── Templates previously inlined in the router (content unchanged) ───────────
// All arguments must already be escaped by the caller.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCustomerCancelledEmailHtml(booking: Record<string, any>): string {
  return emailWrapper(`<h2 style="color:#e53e3e;margin-top:0">Booking Cancelled</h2><p>Hi ${booking.user_name || 'there'}, your booking has been cancelled.</p>${bookingTable([['Cottage', booking.property_title], ['Check-in', booking.check_in], ['Check-out', booking.check_out]])}<div style="text-align:center;margin:28px 0"><a href="${SITE_URL}/search" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600">Browse Other Cottages</a></div>`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDateChangeSubmittedEmailHtml(booking: Record<string, any>, checkIn: string, checkOut: string, priceDisplay: string): string {
  return emailWrapper(`<h2 style="color:#111;margin-top:0">Date Change Submitted</h2><p>Hi ${booking.user_name || 'there'},</p>${bookingTable([['Cottage', booking.property_title], ['Requested', `${checkIn} → ${checkOut}`], ['New Total', priceDisplay], ['Status', 'Pending Approval']])}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDateChangeApprovedEmailHtml(booking: Record<string, any>, newCheckIn: string, newCheckOut: string, priceDisplay: string): string {
  return emailWrapper(`<h2 style="color:#16a34a;margin-top:0">Date Change Approved ✅</h2><p>Hi ${booking.user_name || 'there'},</p>${bookingTable([['Cottage', booking.property_title], ['New Check-in', newCheckIn], ['New Check-out', newCheckOut], ['Total', priceDisplay]])}<div style="background:#fef3c7;padding:14px;border-radius:8px;font-size:14px;color:#92400e;">Previous: ${booking.check_in} → ${booking.check_out}</div>`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDateChangeRejectedEmailHtml(booking: Record<string, any>): string {
  return emailWrapper(`<h2 style="color:#e53e3e;margin-top:0">Date Change Not Approved</h2><p>Hi ${booking.user_name || 'there'},</p><p>Your date change for <strong>${booking.property_title}</strong> was not approved. Original dates remain: ${booking.check_in} → ${booking.check_out}.</p>`);
}

/** Internal alert to the company inbox when a BOG refund could not be completed. Contains no guest/host contact data. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRefundFailedAlertHtml(booking: Record<string, any>, trigger: string): string {
  return emailWrapper(`<h2 style="color:#e53e3e;margin-top:0">Refund could not be completed</h2><p>The booking status was changed, but the Bank of Georgia refund failed. The payment is still marked as <strong>paid</strong> and needs manual follow-up.</p>${bookingTable([['Booking ID', String(booking.id)], ['Cottage', booking.property_title], ['Check-in', booking.check_in], ['Check-out', booking.check_out], ['Total', '₾' + booking.total_price], ['Trigger', trigger]])}<p style="color:#6b7280;font-size:13px;margin:0">Check the booking in the <a href="${SITE_URL}/admin" style="color:#e53e3e">admin panel</a> and the bog-payment function logs.</p>`);
}
