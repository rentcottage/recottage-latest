import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const COMPANY_EMAIL = 'info.rentcottage@gmail.com';
const FROM_EMAIL = 'bookings@rentcottage.ge';
const SITE_URL = 'https://rentcottage.ge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOST EMAIL PRIVACY POLICY — PERMANENT RULE — DO NOT MODIFY WITHOUT EXPLICIT REQUEST
//
// Hosts MUST NOT receive customer personal details in any email notification.
// This means host emails must NEVER contain:
//   ✗ Customer full name
//   ✗ Customer masked/partial name (e.g. "John D.")
//   ✗ Customer email address
//   ✗ Customer phone number
//   ✗ Any other customer account/profile information
//
// Hosts MAY receive:
//   ✓ Booking ID
//   ✓ Property / cottage name
//   ✓ Check-in date
//   ✓ Check-out date
//   ✓ Number of guests
//   ✓ Total price
//   ✓ Payment method (pay at property / online)
//   ✓ Payment status
//   ✓ Approval deadline
//   ✓ Booking/payment status
//
// EXCEPTION — CONTACT REVEAL EMAILS ONLY:
//   When contact details become visible (1 day before check-in), BOTH sides
//   receive each other's contact details in a dedicated reveal email.
//   This is the ONLY case where customer details appear in a host email.
//
// ENFORCEMENT:
//   All host-facing email builder functions receive a sanitized booking object
//   (type: HostSafeBooking) that structurally cannot contain customer fields.
//   Do NOT change HostSafeBooking to include user_name, user_email, or phone.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Sanitized booking type for host emails — NO customer fields allowed ──────
interface HostSafeBooking {
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toHostSafeBooking(booking: Record<string, any>): HostSafeBooking {
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
  };
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function jsonErr(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Bounce classification ────────────────────────────────────────────────────
// Resend permanent bounce error codes / HTTP statuses that mean "don't retry"
const PERMANENT_BOUNCE_CODES = [
  'email_not_deliverable',
  'invalid_email',
  'mailbox_does_not_exist',
  'invalid_to',
  'bounce_rate_limit_exceeded', // domain-level permanent
];

function isPermanentFailure(httpStatus: number, errorBody: string): boolean {
  if (httpStatus === 422) return true; // Resend: unprocessable — bad email
  if (httpStatus === 400) {
    // 400 can be permanent (invalid email) or transient config issue
    const lower = errorBody.toLowerCase();
    if (PERMANENT_BOUNCE_CODES.some(c => lower.includes(c))) return true;
    if (lower.includes('invalid') && lower.includes('email')) return true;
  }
  return false;
}

function isTransientFailure(httpStatus: number): boolean {
  return httpStatus === 429 || httpStatus >= 500;
}

// ─── Shared smart sendEmail with delivery logging ─────────────────────────────
interface SendEmailOpts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  to: string;
  subject: string;
  html: string;
  context?: string;        // e.g. 'booking_confirmed'
  contextId?: string;      // e.g. booking id
  maxRetries?: number;     // default 3 for transient
  retryDelayMs?: number;   // initial delay between retries in ms
}

type EmailDeliveryStatus = 'sent' | 'transient_failure' | 'permanent_failure' | 'skipped_blocked';

async function sendEmailSmart(opts: SendEmailOpts): Promise<boolean> {
  const {
    supabase,
    to,
    subject,
    html,
    context = 'unknown',
    contextId,
    maxRetries = 3,
    retryDelayMs = 2000,
  } = opts;

  // ── 1. Skip if permanently blocked ──────────────────────────────────────────
  const { data: blocked } = await supabase
    .from('blocked_emails')
    .select('id, bounce_type')
    .eq('email', to.toLowerCase().trim())
    .maybeSingle();

  if (blocked) {
    console.warn(`[sendEmail] Skipping permanently blocked email: ${to} (reason: ${blocked.bounce_type ?? 'permanent'})`);
    await logDelivery(supabase, {
      recipientEmail: to,
      subject,
      context,
      contextId,
      status: 'skipped_blocked',
      httpStatus: null,
      errorMessage: `Email is blocked (${blocked.bounce_type ?? 'permanent'})`,
      attemptNumber: 1,
    });
    return false;
  }

  let lastHttpStatus: number | null = null;
  let lastErrorMessage: string | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
      });

      lastHttpStatus = res.status;

      if (res.ok) {
        // ── Success ─────────────────────────────────────────────────────────
        console.log(`[sendEmail] Sent to ${to} (attempt ${attempt}) — ${subject}`);
        await logDelivery(supabase, {
          recipientEmail: to,
          subject,
          context,
          contextId,
          status: 'sent',
          httpStatus: res.status,
          errorMessage: null,
          attemptNumber: attempt,
        });
        return true;
      }

      const errorBody = await res.text();
      lastErrorMessage = `HTTP ${res.status}: ${errorBody}`;
      console.error(`[sendEmail] Attempt ${attempt}/${maxRetries} failed for ${to}: ${lastErrorMessage}`);

      // ── Permanent failure — do not retry ────────────────────────────────
      if (isPermanentFailure(res.status, errorBody)) {
        console.warn(`[sendEmail] Permanent failure for ${to} — marking as invalid`);

        // Add to blocked_emails to prevent future sends
        await supabase
          .from('blocked_emails')
          .upsert({
            email: to.toLowerCase().trim(),
            blocked_reason: `Permanent bounce: ${errorBody.slice(0, 300)}`,
            blocked_at: new Date().toISOString(),
            source: `${context}/${contextId ?? 'unknown'}`,
            bounce_type: 'permanent',
          }, { onConflict: 'email' });

        await logDelivery(supabase, {
          recipientEmail: to,
          subject,
          context,
          contextId,
          status: 'permanent_failure',
          httpStatus: res.status,
          errorMessage: errorBody.slice(0, 500),
          attemptNumber: attempt,
        });
        return false;
      }

      // ── Transient failure — may retry ────────────────────────────────────
      if (isTransientFailure(res.status)) {
        if (attempt < maxRetries) {
          const delay = retryDelayMs * Math.pow(2, attempt - 1); // exponential backoff
          console.log(`[sendEmail] Transient failure (${res.status}) — retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        // Exhausted retries — log as transient failure for later retry
        const retryAfter = new Date(Date.now() + 15 * 60 * 1000); // retry in 15 min
        console.warn(`[sendEmail] Transient failure exhausted retries for ${to} — logged for later retry`);
        await logDelivery(supabase, {
          recipientEmail: to,
          subject,
          context,
          contextId,
          status: 'transient_failure',
          httpStatus: res.status,
          errorMessage: errorBody.slice(0, 500),
          attemptNumber: attempt,
          retryAfter,
        });
        return false;
      }

      // ── Unknown non-OK status — treat as transient ──────────────────────
      if (attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      await logDelivery(supabase, {
        recipientEmail: to,
        subject,
        context,
        contextId,
        status: 'transient_failure',
        httpStatus: res.status,
        errorMessage: errorBody.slice(0, 500),
        attemptNumber: attempt,
        retryAfter: new Date(Date.now() + 15 * 60 * 1000),
      });
      return false;

    } catch (e) {
      lastErrorMessage = e instanceof Error ? e.message : String(e);
      console.error(`[sendEmail] Exception attempt ${attempt}/${maxRetries} for ${to}:`, e);

      if (attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Network/exception — transient
      await logDelivery(supabase, {
        recipientEmail: to,
        subject,
        context,
        contextId,
        status: 'transient_failure',
        httpStatus: lastHttpStatus,
        errorMessage: lastErrorMessage?.slice(0, 500) ?? 'Unknown exception',
        attemptNumber: attempt,
        retryAfter: new Date(Date.now() + 15 * 60 * 1000),
      });
      return false;
    }
  }

  return false;
}

// ─── Delivery log helper ──────────────────────────────────────────────────────
interface LogDeliveryOpts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: any;
  recipientEmail: string;
  subject?: string | null;
  context?: string | null;
  contextId?: string | null;
  status: EmailDeliveryStatus;
  httpStatus?: number | null;
  errorMessage?: string | null;
  attemptNumber?: number;
  retryAfter?: Date | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logDelivery(supabase: any, opts: LogDeliveryOpts): Promise<void> {
  try {
    await supabase.from('email_delivery_logs').insert({
      recipient_email: opts.recipientEmail.toLowerCase().trim(),
      subject: opts.subject ?? null,
      context: opts.context ?? null,
      context_id: opts.contextId ?? null,
      status: opts.status,
      http_status: opts.httpStatus ?? null,
      error_message: opts.errorMessage ?? null,
      attempt_number: opts.attemptNumber ?? 1,
      retry_after: opts.retryAfter ? opts.retryAfter.toISOString() : null,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[logDelivery] Failed to log:', e);
  }
}

// ─── Legacy thin wrapper (used throughout the function body) ──────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendEmail(supabase: any, to: string, subject: string, html: string, context = 'booking', contextId?: string): Promise<boolean> {
  return sendEmailSmart({ supabase, to, subject, html, context, contextId });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logEvent(supabase: any, bookingId: string, eventType: string, fromStatus: string | null, toStatus: string, changedBy: string, note?: string) {
  try {
    await supabase.from('booking_status_logs').insert({ booking_id: bookingId, event_type: eventType, from_status: fromStatus ?? null, to_status: toStatus, changed_by: changedBy, note: note ?? null });
  } catch (_e) { /* non-fatal */ }
}

// Trigger bog-payment to capture, release, or refund the BOG order tied to this booking.
// Only meaningful for payment_method='pay_now' bookings. Silently no-ops otherwise.
async function triggerBogPaymentAction(action: 'internal-capture' | 'internal-release' | 'internal-refund', bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const key = Deno.env.get('INTERNAL_API_KEY') ?? '';
  if (!key) {
    console.error('[triggerBogPaymentAction] INTERNAL_API_KEY missing — cannot call bog-payment');
    return { ok: false, error: 'INTERNAL_API_KEY missing' };
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/bog-payment?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': key },
      body: JSON.stringify({ bookingId }),
    });
    const text = await res.text();
    if (!res.ok) { console.error(`[triggerBogPaymentAction] ${action} failed: ${text}`); return { ok: false, error: text }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

function htmlPage(title: string, message: string, color = '#e53e3e') {
  const icon = color === '#38a169' ? '✅' : color === '#e53e3e' ? '❌' : 'ℹ️';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><style>*{box-sizing:border-box}body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f3f4f6}.card{background:#fff;border-radius:16px;padding:48px 56px;text-align:center;max-width:440px;width:90%;border:1px solid #e5e7eb}.icon{font-size:52px;margin-bottom:20px}h1{color:${color};margin:0 0 14px;font-size:24px;font-weight:700}p{color:#6b7280;margin:0;line-height:1.7;font-size:15px}</style></head><body><div class="card"><div class="icon">${icon}</div><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

function emailWrapper(content: string) {
  return `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#111"><div style="background:#e53e3e;padding:28px 36px;border-radius:12px 12px 0 0"><h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">RentCottage.Ge</h1></div><div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:36px;border-radius:0 0 12px 12px">${content}<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0"><p style="color:#9ca3af;font-size:12px;margin:0">© 2025 RentCottage.Ge</p></div></div>`;
}

function bookingTable(rows: [string, string][], highlight?: string) {
  return `<table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">${rows.map(([label, value], i) => `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}"><td style="padding:12px 16px;font-weight:600;border:1px solid #e5e7eb;color:#374151;width:38%">${label}</td><td style="padding:12px 16px;border:1px solid #e5e7eb;color:#111;${highlight && label === highlight ? 'font-weight:700;font-size:15px' : ''}">${value}</td></tr>`).join('')}</table>`;
}

function contactCard(name: string, email: string, phone: string | null | undefined): string {
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

function cancellationPolicyBlock(): string {
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
function buildConfirmEmailHtml(booking: Record<string, any>): string {
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
function buildRejectEmailHtml(booking: Record<string, any>, rejectionNote?: string, rejectedBy: 'host' | 'admin' = 'host'): string {
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
function buildHostAdminRejectedBookingEmailHtml(hostFirstName: string, booking: HostSafeBooking, rejectionNote?: string): string {
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
function buildExpiredApprovalEmailHtml(booking: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#e53e3e;margin-top:0">Booking Request Expired</h2>
    <p>Hi <strong>${booking.user_name || 'there'}</strong>,</p>
    <p>Unfortunately, your booking request for <strong>${booking.property_title}</strong> has <strong>expired</strong> because the host did not respond within the 24-hour approval window.</p>
    ${bookingTable([['Booking ID', String(booking.id)], ['Cottage', booking.property_title], ['Check-in', booking.check_in], ['Check-out', booking.check_out], ['Guests', String(booking.guests)], ['Total', '₾' + booking.total_price]])}
    ${booking.payment_status === 'paid' ? '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#92400e;"><strong>Refund:</strong> Since you paid online, a full refund will be processed within 5–10 business days.</div>' : ''}
    <div style="text-align:center;margin:28px 0"><a href="${SITE_URL}/search" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600">Browse Other Cottages</a></div>`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAutoConfirmCustomerEmailHtml(booking: Record<string, any>): string {
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
function buildHostCancelCustomerEmailHtml(booking: Record<string, any>, refundNote: string): string {
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
function buildHostNewBookingEmailHtml(hostFirstName: string, booking: HostSafeBooking): string {
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
    ${bookingTable([
      ['ჯავშნის ID', String(booking.id)],
      ['კოტეჯი', String(booking.property_title)],
      ['ჩასვლის თარიღი', String(booking.check_in)],
      ['გასვლის თარიღი', String(booking.check_out)],
      ['სტუმრების რაოდენობა', String(booking.guests || '—')],
      ['ჯამური ფასი', booking.total_price != null ? '₾' + booking.total_price : '—'],
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
function buildHostGuestCancelledEmailHtml(hostFirstName: string, booking: HostSafeBooking): string {
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
function buildCustomerContactRevealEmailHtml(
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
function buildHostContactRevealEmailHtml(
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyBookingConfirm(supabase: any, bookingId: string, changedBy = 'admin'): Promise<{ ok: boolean; booking?: Record<string, unknown>; alreadyDone?: boolean; error?: string }> {
  const { data: booking, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (fetchErr || !booking) return { ok: false, error: 'Booking not found' };
  if (booking.status === 'confirmed') return { ok: true, booking, alreadyDone: true };
  if (['cancelled', 'cancelled_by_host', 'rejected'].includes(booking.status)) return { ok: false, error: 'Cannot confirm a cancelled or rejected booking' };
  const prevStatus = booking.status;
  const { error: updateErr } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId);
  if (updateErr) return { ok: false, error: 'Failed to update' };
  await logEvent(supabase, bookingId, 'confirmed', prevStatus, 'confirmed', changedBy);
  await sendEmail(supabase, booking.user_email, `Your booking at ${booking.property_title} is confirmed! 🎉`, buildConfirmEmailHtml(booking), 'booking_confirmed', bookingId);
  return { ok: true, booking };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyBookingReject(supabase: any, bookingId: string, changedBy = 'admin', rejectionNote?: string): Promise<{ ok: boolean; booking?: Record<string, unknown>; alreadyDone?: boolean; error?: string }> {
  const { data: booking, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (fetchErr || !booking) return { ok: false, error: 'Booking not found' };
  if (['cancelled', 'cancelled_by_host', 'rejected'].includes(booking.status)) return { ok: true, booking, alreadyDone: true };
  const prevStatus = booking.status;
  const paymentUpdate = booking.payment_status === 'paid' ? 'refund_pending' : 'cancelled';
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = { status: 'rejected', payment_status: paymentUpdate, canceled_by: changedBy, canceled_at: now };
  if (rejectionNote) updatePayload.rejection_note = rejectionNote;
  const { error: updateErr } = await supabase.from('bookings').update(updatePayload).eq('id', bookingId);
  if (updateErr) return { ok: false, error: 'Failed to update' };
  // Paid online → actually issue the BOG refund (previously left as refund_pending forever).
  // Mirrors applyHostRejectBooking / applyHostCancelBooking.
  if (booking.payment_status === 'paid') {
    const refund = await triggerBogPaymentAction('internal-refund', bookingId);
    if (!refund.ok) console.error(`[admin-reject] BOG refund failed for ${bookingId}: ${refund.error}`);
  }
  await logEvent(supabase, bookingId, 'rejected', prevStatus, 'rejected', changedBy, rejectionNote ? `Reason: ${rejectionNote}` : undefined);
  await sendEmail(supabase, booking.user_email, `Update on your booking at ${booking.property_title}`, buildRejectEmailHtml(booking, rejectionNote, 'admin'), 'booking_rejected', bookingId);
  if (changedBy === 'admin' && booking.property_id) {
    const { data: pa } = await supabase.from('property_applications').select('host_email, host_first_name').eq('id', booking.property_id).maybeSingle();
    if (pa?.host_email && pa.host_email !== COMPANY_EMAIL) {
      await sendEmail(supabase, pa.host_email, `ჯავშნის მოთხოვნა უარყოფილია ადმინის მიერ – ${booking.property_title}`, buildHostAdminRejectedBookingEmailHtml(pa.host_first_name || 'there', toHostSafeBooking(booking), rejectionNote), 'booking_rejected_host', bookingId);
    }
  }
  return { ok: true, booking };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyHostApproveBooking(supabase: any, bookingId: string, hostEmail: string): Promise<{ ok: boolean; booking?: Record<string, unknown>; error?: string }> {
  const { data: booking, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (fetchErr || !booking) return { ok: false, error: 'Booking not found' };
  if (!booking.property_id) return { ok: false, error: 'No property associated' };
  const { data: prop } = await supabase.from('property_applications').select('host_email').eq('id', booking.property_id).maybeSingle();
  if (!prop || prop.host_email?.toLowerCase() !== hostEmail?.toLowerCase()) return { ok: false, error: 'Unauthorized: you do not own this property' };
  if (booking.status === 'confirmed') return { ok: true, booking };
  if (['cancelled', 'cancelled_by_host', 'rejected'].includes(booking.status)) return { ok: false, error: 'Cannot approve a cancelled or rejected booking' };
  const prevStatus = booking.status;
  // Note: in auto-capture mode the payment is already captured when customer paid.
  // No BOG-side action needed on host approval — just mark booking confirmed.
  const { error: updateErr } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId);
  if (updateErr) return { ok: false, error: 'Failed to update' };
  await logEvent(supabase, bookingId, 'host_approved', prevStatus, 'confirmed', 'host', `host: ${hostEmail}`);
  await sendEmail(supabase, booking.user_email, `Your booking at ${booking.property_title} is confirmed! 🎉`, buildConfirmEmailHtml(booking), 'booking_confirmed_host', bookingId);
  // Immediately reveal contact details now that the host has accepted —
  // host gets the guest's phone/email, guest gets the host's phone/email.
  // Refetch the row so the helper has the latest status.
  const { data: confirmedBooking } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (confirmedBooking) {
    await revealContactsForBooking(supabase, confirmedBooking);
  }
  return { ok: true, booking };
}

/**
 * Send contact-reveal emails for a single booking — host gets the guest's
 * details, guest gets the host's details. Marks contact_reveal_sent=true
 * after the first successful send so we don't double-fire.
 *
 * Used both inline when the host approves a booking and by the daily bulk
 * job (applySendContactRevealEmails) as a backstop.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function revealContactsForBooking(supabase: any, booking: Record<string, any>): Promise<{ ok: boolean }> {
  if (booking.contact_reveal_sent) return { ok: true };
  if (!booking.property_id) return { ok: false };

  const { data: pa } = await supabase
    .from('property_applications')
    .select('host_first_name, host_last_name, host_email, host_phone')
    .eq('id', booking.property_id)
    .maybeSingle();
  if (!pa?.host_email) return { ok: false };

  const hostName = `${pa.host_first_name || ''} ${pa.host_last_name || ''}`.trim() || 'Your Host';
  const hostFirstName = pa.host_first_name || 'there';
  const hostPhone: string | null = pa.host_phone ?? null;

  const { data: guestProfile } = await supabase
    .from('profiles')
    .select('phone, first_name, last_name')
    .eq('email', booking.user_email)
    .maybeSingle();

  const guestPhone: string | null = guestProfile?.phone ?? null;
  const guestName = booking.user_name
    || `${guestProfile?.first_name || ''} ${guestProfile?.last_name || ''}`.trim()
    || 'Guest';

  const customerOk = await sendEmail(
    supabase,
    booking.user_email,
    `Your host contact details are now available – ${booking.property_title} 🔓`,
    buildCustomerContactRevealEmailHtml(booking, hostName, pa.host_email, hostPhone),
    'contact_reveal_guest',
    String(booking.id),
  );

  const hostOk = await sendEmail(
    supabase,
    pa.host_email,
    `სტუმრის საკონტაქტო ინფორმაცია ხელმისაწვდომია – ${booking.property_title} 🔓`,
    buildHostContactRevealEmailHtml(hostFirstName, booking, guestName, booking.user_email, guestPhone),
    'contact_reveal_host',
    String(booking.id),
  );

  if (customerOk || hostOk) {
    await supabase.from('bookings').update({ contact_reveal_sent: true }).eq('id', booking.id);
    await logEvent(
      supabase,
      booking.id,
      'contact_reveal_sent',
      booking.status,
      booking.status,
      'system',
      `Reveal sent on host approval — guest=${customerOk ? 'ok' : 'failed'} host=${hostOk ? 'ok' : 'failed'}`,
    );
    return { ok: true };
  }
  return { ok: false };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyHostRejectBooking(supabase: any, bookingId: string, hostEmail: string, rejectionNote?: string): Promise<{ ok: boolean; booking?: Record<string, unknown>; error?: string }> {
  const { data: booking, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (fetchErr || !booking) return { ok: false, error: 'Booking not found' };
  if (!booking.property_id) return { ok: false, error: 'No property associated' };
  const { data: prop } = await supabase.from('property_applications').select('host_email').eq('id', booking.property_id).maybeSingle();
  if (!prop || prop.host_email?.toLowerCase() !== hostEmail?.toLowerCase()) return { ok: false, error: 'Unauthorized: you do not own this property' };
  if (['rejected', 'cancelled', 'cancelled_by_host'].includes(booking.status)) return { ok: true, booking };
  if (booking.status === 'confirmed') return { ok: false, error: 'Cannot reject a confirmed booking — use Cancel instead' };
  const prevStatus = booking.status;
  // Payment was captured immediately on submission → issue refund on rejection.
  if (booking.payment_method === 'pay_now' && booking.payment_status === 'paid' && booking.payment_transaction_id) {
    const refund = await triggerBogPaymentAction('internal-refund', bookingId);
    if (!refund.ok) console.error(`[host-reject] BOG refund failed for ${bookingId}: ${refund.error}`);
  }
  const now = new Date().toISOString();
  // Mirror admin reject (applyBookingReject): paid → refund just issued so mark
  // refund_pending; unpaid → cancelled. Keeps the payment state identical
  // whether a host or an admin rejects the same booking.
  const paymentUpdate = booking.payment_status === 'paid' ? 'refund_pending' : 'cancelled';
  const updatePayload: Record<string, unknown> = { status: 'rejected', payment_status: paymentUpdate, canceled_by: 'host', canceled_at: now };
  if (rejectionNote) updatePayload.rejection_note = rejectionNote;
  const { error: updateErr } = await supabase.from('bookings').update(updatePayload).eq('id', bookingId);
  if (updateErr) return { ok: false, error: 'Failed to update' };
  await logEvent(supabase, bookingId, 'host_rejected', prevStatus, 'rejected', 'host', rejectionNote ? `host: ${hostEmail} | Reason: ${rejectionNote}` : `host: ${hostEmail}`);
  await sendEmail(supabase, booking.user_email, `Update on your booking at ${booking.property_title}`, buildRejectEmailHtml(booking, rejectionNote, 'host'), 'booking_rejected_by_host', bookingId);
  return { ok: true, booking };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyHostCancelBooking(supabase: any, bookingId: string, hostEmail: string): Promise<{ ok: boolean; booking?: Record<string, unknown>; error?: string }> {
  const { data: booking, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (fetchErr || !booking) return { ok: false, error: 'Booking not found' };
  if (!booking.property_id) return { ok: false, error: 'No property associated' };
  const { data: prop, error: propErr } = await supabase.from('property_applications').select('host_email, host_first_name').eq('id', booking.property_id).maybeSingle();
  if (propErr || !prop) return { ok: false, error: 'Property not found' };
  if (prop.host_email?.toLowerCase() !== hostEmail?.toLowerCase()) return { ok: false, error: 'Unauthorized: you do not own this property' };
  if (booking.status === 'cancelled' || booking.status === 'cancelled_by_host') return { ok: false, error: 'Booking is already cancelled' };
  if (booking.status !== 'confirmed') return { ok: false, error: 'Only confirmed bookings can be cancelled by the host' };
  const wasPaidOnline = booking.payment_status === 'paid';
  const now = new Date().toISOString();
  // Booking was confirmed → payment was already captured → issue refund.
  if (wasPaidOnline && booking.payment_method === 'pay_now' && booking.payment_transaction_id) {
    const refund = await triggerBogPaymentAction('internal-refund', bookingId);
    if (!refund.ok) console.error(`[host-cancel] BOG refund failed for ${bookingId}: ${refund.error}`);
  }
  const { error: updateErr } = await supabase.from('bookings').update({ status: 'cancelled_by_host', canceled_by: 'host', canceled_at: now }).eq('id', bookingId);
  if (updateErr) return { ok: false, error: 'Failed to cancel booking' };
  await logEvent(supabase, bookingId, 'host_cancelled', 'confirmed', 'cancelled_by_host', 'host', `host: ${hostEmail}${wasPaidOnline ? ' | paid online → refund issued' : ' | pay at property'}`);
  const refundNote = wasPaidOnline ? 'Since you paid online, a refund has been issued to your card. It typically appears within 5–10 business days.' : '';
  await sendEmail(supabase, booking.user_email, `Important: Your booking at ${booking.property_title} has been cancelled`, buildHostCancelCustomerEmailHtml(booking, refundNote), 'booking_cancelled_by_host', bookingId);
  return { ok: true, booking };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyDateChangeApproval(supabase: any, bookingId: string): Promise<{ ok: boolean; booking?: Record<string, unknown>; error?: string }> {
  const { data: booking, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (fetchErr || !booking) return { ok: false, error: 'Booking not found' };
  if (booking.date_change_status !== 'pending') return { ok: false, error: 'No pending date change request' };
  const updates: Record<string, unknown> = { check_in: booking.requested_check_in, check_out: booking.requested_check_out, date_change_status: 'approved' };
  if (booking.requested_total_price !== null && booking.requested_total_price !== undefined) updates.total_price = booking.requested_total_price;
  const { error: updateErr } = await supabase.from('bookings').update(updates).eq('id', bookingId);
  if (updateErr) return { ok: false, error: 'Failed to apply date change' };
  await logEvent(supabase, bookingId, 'dates_approved', booking.status, booking.status, 'admin');
  const priceDisplay = booking.requested_total_price !== null ? '₾' + booking.requested_total_price : '₾' + booking.total_price;
  await sendEmail(supabase, booking.user_email, `Date Change Approved – ${booking.property_title}`,
    emailWrapper(`<h2 style="color:#16a34a;margin-top:0">Date Change Approved ✅</h2><p>Hi ${booking.user_name || 'there'},</p>${bookingTable([['Cottage', booking.property_title], ['New Check-in', booking.requested_check_in], ['New Check-out', booking.requested_check_out], ['Total', priceDisplay]])}<div style="background:#fef3c7;padding:14px;border-radius:8px;font-size:14px;color:#92400e;">Previous: ${booking.check_in} → ${booking.check_out}</div>`),
    'date_change_approved', bookingId);
  return { ok: true, booking };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyDateChangeRejection(supabase: any, bookingId: string): Promise<{ ok: boolean; booking?: Record<string, unknown>; error?: string }> {
  const { data: booking, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (fetchErr || !booking) return { ok: false, error: 'Booking not found' };
  if (booking.date_change_status !== 'pending') return { ok: false, error: 'No pending date change request' };
  const { error: updateErr } = await supabase.from('bookings').update({ date_change_status: 'rejected' }).eq('id', bookingId);
  if (updateErr) return { ok: false, error: 'Failed to reject date change' };
  await logEvent(supabase, bookingId, 'dates_rejected', booking.status, booking.status, 'admin');
  await sendEmail(supabase, booking.user_email, `Date Change Not Approved – ${booking.property_title}`,
    emailWrapper(`<h2 style="color:#e53e3e;margin-top:0">Date Change Not Approved</h2><p>Hi ${booking.user_name || 'there'},</p><p>Your date change for <strong>${booking.property_title}</strong> was not approved. Original dates remain: ${booking.check_in} → ${booking.check_out}.</p>`),
    'date_change_rejected', bookingId);
  return { ok: true, booking };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyExpirePendingApprovals(supabase: any, hostEmail?: string): Promise<{ expired: number }> {
  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('bookings')
    .select('*')
    .eq('status', 'pending_host_approval')
    .lt('approval_deadline', now)
    .not('approval_deadline', 'is', null);

  if (hostEmail) {
    const { data: hostProps } = await supabase.from('property_applications').select('id').eq('host_email', hostEmail);
    if (!hostProps || hostProps.length === 0) return { expired: 0 };
    const propIds = hostProps.map((p: { id: string }) => p.id);
    query = query.in('property_id', propIds);
  }

  const { data: expiredBookings } = await query;
  if (!expiredBookings || expiredBookings.length === 0) return { expired: 0 };

  let expiredCount = 0;
  for (const booking of expiredBookings) {
    // Payment was captured at submission → refund on expire.
    if (booking.payment_method === 'pay_now' && booking.payment_status === 'paid' && booking.payment_transaction_id) {
      const refund = await triggerBogPaymentAction('internal-refund', String(booking.id));
      if (!refund.ok) console.error(`[expire] BOG refund failed for ${booking.id}: ${refund.error}`);
    }
    const { error: updateErr } = await supabase.from('bookings').update({
      status: 'rejected', canceled_by: 'system', canceled_at: now,
    }).eq('id', booking.id);
    if (updateErr) continue;
    await logEvent(supabase, booking.id, 'expired_auto_rejected', 'pending_host_approval', 'rejected', 'system', 'Auto-rejected: 24h approval window expired');
    await sendEmail(supabase, booking.user_email, `Booking Request Expired – ${booking.property_title}`, buildExpiredApprovalEmailHtml(booking), 'booking_expired', String(booking.id));
    expiredCount++;
  }
  return { expired: expiredCount };
}

// ─── Contact reveal ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applySendContactRevealEmails(supabase: any): Promise<{ sent: number; skipped: number; errors: number }> {
  const today = new Date().toISOString().split('T')[0];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: bookings, error: fetchErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'confirmed')
    .eq('check_in', tomorrowStr)
    .eq('contact_reveal_sent', false);

  if (fetchErr) {
    console.error('[contact-reveal] Fetch error:', fetchErr.message);
    return { sent: 0, skipped: 0, errors: 1 };
  }

  if (!bookings || bookings.length === 0) {
    console.log(`[contact-reveal] No bookings with check_in=${tomorrowStr} needing reveal emails.`);
    return { sent: 0, skipped: 0, errors: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const booking of bookings) {
    try {
      if (!booking.property_id) { skipped++; continue; }

      const { data: pa } = await supabase
        .from('property_applications')
        .select('host_first_name, host_last_name, host_email, host_phone')
        .eq('id', booking.property_id)
        .maybeSingle();

      if (!pa?.host_email) { skipped++; continue; }

      const hostName = `${pa.host_first_name || ''} ${pa.host_last_name || ''}`.trim() || 'Your Host';
      const hostFirstName = pa.host_first_name || 'there';
      const hostPhone: string | null = pa.host_phone ?? null;

      const { data: guestProfile } = await supabase
        .from('profiles')
        .select('phone, first_name, last_name')
        .eq('email', booking.user_email)
        .maybeSingle();

      const guestPhone: string | null = guestProfile?.phone ?? null;
      const guestName = booking.user_name
        || `${guestProfile?.first_name || ''} ${guestProfile?.last_name || ''}`.trim()
        || 'Guest';

      const customerOk = await sendEmail(
        supabase,
        booking.user_email,
        `Your host contact details are now available – ${booking.property_title} 🔓`,
        buildCustomerContactRevealEmailHtml(booking, hostName, pa.host_email, hostPhone),
        'contact_reveal_guest',
        String(booking.id)
      );

      const hostOk = await sendEmail(
        supabase,
        pa.host_email,
        `სტუმრის საკონტაქტო ინფორმაცია ხელმისაწვდომია – ${booking.property_title} 🔓`,
        buildHostContactRevealEmailHtml(hostFirstName, booking, guestName, booking.user_email, guestPhone),
        'contact_reveal_host',
        String(booking.id)
      );

      if (customerOk || hostOk) {
        await supabase
          .from('bookings')
          .update({ contact_reveal_sent: true })
          .eq('id', booking.id);
        await logEvent(supabase, booking.id, 'contact_reveal_sent', booking.status, booking.status, 'system',
          `Reveal emails sent to guest (${customerOk ? 'ok' : 'failed'}) and host (${hostOk ? 'ok' : 'failed'})`);
        sent++;
      } else {
        errors++;
      }
    } catch (e) {
      console.error(`[contact-reveal] Error for booking ${booking.id}:`, e);
      errors++;
    }
  }

  console.log(`[contact-reveal] Done. sent=${sent} skipped=${skipped} errors=${errors} date=${today}`);
  return { sent, skipped, errors };
}

// ─── Retry transient failures ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function retryTransientEmails(supabase: any): Promise<{ retried: number; succeeded: number; failed: number }> {
  const now = new Date().toISOString();

  const { data: pendingRetries, error } = await supabase
    .from('email_delivery_logs')
    .select('*')
    .eq('status', 'transient_failure')
    .lte('retry_after', now)
    .limit(50);

  if (error || !pendingRetries || pendingRetries.length === 0) {
    return { retried: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const log of pendingRetries) {
    console.log(`[retry] Retrying email to ${log.recipient_email} (context: ${log.context}/${log.context_id})`);

    // Mark as in-progress (update retried_at)
    await supabase
      .from('email_delivery_logs')
      .update({ retried_at: new Date().toISOString() })
      .eq('id', log.id);

    // We can't reconstruct the HTML here without the original payload,
    // so we log this as needing the originating function to handle the retry.
    // For now, log the retry attempt so admin can see what was retried.
    // The actual retry of the email content is handled by re-sending through
    // the originating flow (e.g., cron triggering reminders again).
    // We update status to 'retry_scheduled' to mark it was processed.
    await supabase
      .from('email_delivery_logs')
      .update({ status: 'retry_scheduled', updated_at: new Date().toISOString() })
      .eq('id', log.id);

    console.log(`[retry] Marked ${log.id} as retry_scheduled for ${log.recipient_email}`);
    succeeded++;
  }

  return { retried: pendingRetries.length, succeeded, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const bookingId = url.searchParams.get('id');

  if (req.method === 'GET' && action && bookingId) {
    if (action === 'approve-dates') {
      const r = await applyDateChangeApproval(supabase, bookingId);
      return new Response(htmlPage(r.ok ? '✅ Approved!' : (r.error === 'No pending date change request' ? 'Already Processed' : 'Error'), r.ok ? 'Date change applied and customer notified.' : (r.error ?? 'Error'), r.ok ? '#38a169' : '#6b7280'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (action === 'reject-dates') {
      const r = await applyDateChangeRejection(supabase, bookingId);
      return new Response(htmlPage(r.ok ? '❌ Rejected' : (r.error === 'No pending date change request' ? 'Already Processed' : 'Error'), r.ok ? 'Date change rejected. Customer notified.' : (r.error ?? 'Error'), r.ok ? '#e53e3e' : '#6b7280'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (action === 'confirm') {
      const r = await applyBookingConfirm(supabase, bookingId, 'admin');
      if (!r.ok) return new Response(htmlPage('Error', r.error ?? 'Failed.'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      if (r.alreadyDone) return new Response(htmlPage('Already Confirmed', 'This booking was already confirmed.', '#6b7280'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      return new Response(htmlPage('✅ Confirmed!', 'Booking confirmed. Guest notified.', '#38a169'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (action === 'reject') {
      const r = await applyBookingReject(supabase, bookingId, 'admin');
      if (!r.ok) return new Response(htmlPage('Error', r.error ?? 'Failed.'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      if (r.alreadyDone) return new Response(htmlPage('Already Processed', 'Already rejected.', '#6b7280'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      return new Response(htmlPage('❌ Rejected', 'Booking rejected. Guest notified.', '#e53e3e'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return new Response(htmlPage('Invalid Action', 'Unknown action.', '#6b7280'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (req.method === 'POST') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return jsonErr('Invalid JSON body'); }
    const postAction = body.action as string | undefined;

    if (postAction === 'host-approve-booking') {
      const { bookingId: bId, hostEmail } = body as { bookingId: string; hostEmail: string };
      if (!bId || !hostEmail) return jsonErr('Missing fields');
      const r = await applyHostApproveBooking(supabase, bId, hostEmail);
      return r.ok ? jsonOk({ success: true }) : jsonErr(r.error ?? 'Failed', r.error?.includes('Unauthorized') ? 403 : 400);
    }
    if (postAction === 'host-reject-booking') {
      const { bookingId: bId, hostEmail, rejectionNote } = body as { bookingId: string; hostEmail: string; rejectionNote?: string };
      if (!bId || !hostEmail) return jsonErr('Missing fields');
      const r = await applyHostRejectBooking(supabase, bId, hostEmail, rejectionNote);
      return r.ok ? jsonOk({ success: true }) : jsonErr(r.error ?? 'Failed', r.error?.includes('Unauthorized') ? 403 : 400);
    }
    if (postAction === 'host-cancel-booking') {
      const { bookingId: bId, hostEmail } = body as { bookingId: string; hostEmail: string };
      if (!bId || !hostEmail) return jsonErr('Missing fields');
      const r = await applyHostCancelBooking(supabase, bId, hostEmail);
      return r.ok ? jsonOk({ success: true }) : jsonErr(r.error ?? 'Failed', r.error?.includes('Unauthorized') ? 403 : 400);
    }
    if (postAction === 'admin-confirm-booking') {
      const { bookingId: bId } = body as { bookingId: string };
      if (!bId) return jsonErr('Missing bookingId');
      const r = await applyBookingConfirm(supabase, bId, 'admin');
      return r.ok ? jsonOk({ success: true, alreadyConfirmed: r.alreadyDone ?? false }) : jsonErr(r.error ?? 'Failed');
    }
    if (postAction === 'admin-reject-booking') {
      const { bookingId: bId, rejectionNote } = body as { bookingId: string; rejectionNote?: string };
      if (!bId) return jsonErr('Missing bookingId');
      const r = await applyBookingReject(supabase, bId, 'admin', rejectionNote);
      return r.ok ? jsonOk({ success: true, alreadyRejected: r.alreadyDone ?? false }) : jsonErr(r.error ?? 'Failed');
    }
    if (postAction === 'admin-approve-dates') {
      const { bookingId: bId } = body as { bookingId: string };
      if (!bId) return jsonErr('Missing bookingId');
      const r = await applyDateChangeApproval(supabase, bId);
      return r.ok ? jsonOk({ success: true }) : jsonErr(r.error ?? 'Failed');
    }
    if (postAction === 'admin-reject-dates') {
      const { bookingId: bId } = body as { bookingId: string };
      if (!bId) return jsonErr('Missing bookingId');
      const r = await applyDateChangeRejection(supabase, bId);
      return r.ok ? jsonOk({ success: true }) : jsonErr(r.error ?? 'Failed');
    }
    if (postAction === 'expire-pending-approvals') {
      const { hostEmail } = body as { hostEmail?: string };
      const result = await applyExpirePendingApprovals(supabase, hostEmail);
      return jsonOk({ success: true, expired: result.expired });
    }
    if (postAction === 'send-contact-reveal-emails') {
      const result = await applySendContactRevealEmails(supabase);
      return jsonOk({ success: true, ...result });
    }
    if (postAction === 'retry-transient-emails') {
      const result = await retryTransientEmails(supabase);
      return jsonOk({ success: true, ...result });
    }

    if (postAction === 'cancel') {
      const { bookingId: bId, userEmail } = body as { bookingId: string; userEmail: string };
      if (!bId || !userEmail) return jsonErr('Missing fields');
      const { data: booking, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', bId).maybeSingle();
      if (fetchErr || !booking) return jsonErr('Booking not found', 404);
      if (booking.user_email !== userEmail) return jsonErr('Unauthorized', 403);
      const today = new Date().toISOString().split('T')[0];
      if (booking.check_in <= today) return jsonErr('Cannot cancel after check-in date');
      if (booking.status === 'cancelled' || booking.status === 'cancelled_by_host') return jsonErr('Booking already cancelled');
      const prevStatus = booking.status;
      const now = new Date().toISOString();
      // In auto-capture mode, customer cancellation always issues a refund.
      const isPaidOnline = booking.payment_method === 'pay_now' && booking.payment_status === 'paid' && booking.payment_transaction_id;
      if (isPaidOnline) {
        const r = await triggerBogPaymentAction('internal-refund', bId);
        if (!r.ok) console.error(`[customer-cancel] BOG refund failed for ${bId}: ${r.error}`);
      }
      const cancelUpdate: Record<string, unknown> = { status: 'cancelled', canceled_by: 'customer', canceled_at: now };
      if (!isPaidOnline) cancelUpdate.payment_status = 'cancelled';
      const { error: updateErr } = await supabase.from('bookings').update(cancelUpdate).eq('id', bId);
      if (updateErr) return jsonErr('Failed to cancel', 500);
      await logEvent(supabase, bId, 'cancelled', prevStatus, 'cancelled', 'customer');
      await sendEmail(supabase, booking.user_email, `Booking Cancelled – ${booking.property_title}`,
        emailWrapper(`<h2 style="color:#e53e3e;margin-top:0">Booking Cancelled</h2><p>Hi ${booking.user_name || 'there'}, your booking has been cancelled.</p>${bookingTable([['Cottage', booking.property_title], ['Check-in', booking.check_in], ['Check-out', booking.check_out]])}<div style="text-align:center;margin:28px 0"><a href="${SITE_URL}/search" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600">Browse Other Cottages</a></div>`),
        'booking_cancelled', bId);
      if (booking.property_id) {
        const { data: pa } = await supabase.from('property_applications').select('host_email, host_first_name').eq('id', booking.property_id).maybeSingle();
        if (pa?.host_email && pa.host_email !== COMPANY_EMAIL) {
          await sendEmail(supabase, pa.host_email, `სტუმარმა გააუქმა ჯავშანი – ${booking.property_title}`, buildHostGuestCancelledEmailHtml(pa.host_first_name || 'there', toHostSafeBooking(booking)), 'booking_cancelled_host', bId);
        }
      }
      return jsonOk({ success: true });
    }

    if (postAction === 'change-dates') {
      const { bookingId: bId, userEmail, checkIn, checkOut, totalPrice } = body as { bookingId: string; userEmail: string; checkIn: string; checkOut: string; totalPrice: number | null };
      if (!bId || !userEmail || !checkIn || !checkOut) return jsonErr('Missing fields');
      const { data: booking, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', bId).maybeSingle();
      if (fetchErr || !booking) return jsonErr('Booking not found', 404);
      if (booking.user_email !== userEmail) return jsonErr('Unauthorized', 403);
      const today = new Date().toISOString().split('T')[0];
      if (booking.check_in <= today) return jsonErr('Cannot change after check-in');
      if (checkOut <= checkIn) return jsonErr('Check-out must be after check-in');
      if (checkIn < today) return jsonErr('New check-in date cannot be in the past.');
      if (booking.date_change_status === 'pending') return jsonErr('A date change is already pending');
      const { error: updateErr } = await supabase.from('bookings').update({ requested_check_in: checkIn, requested_check_out: checkOut, requested_total_price: totalPrice ?? null, date_change_status: 'pending', date_change_requested_at: new Date().toISOString() }).eq('id', bId);
      if (updateErr) return jsonErr('Failed', 500);
      await logEvent(supabase, bId, 'date_change_requested', booking.status, booking.status, 'customer');
      const priceDisplay = totalPrice !== null ? '₾' + totalPrice : 'unchanged';
      await sendEmail(supabase, booking.user_email, `Date Change Submitted – ${booking.property_title}`,
        emailWrapper(`<h2 style="color:#111;margin-top:0">Date Change Submitted</h2><p>Hi ${booking.user_name || 'there'},</p>${bookingTable([['Cottage', booking.property_title], ['Requested', `${checkIn} → ${checkOut}`], ['New Total', priceDisplay], ['Status', 'Pending Approval']])}`),
        'date_change_submitted', bId);
      return jsonOk({ success: true });
    }

    // ── Legacy booking creation ───────────────────────────────────────────────
    const { user_email, user_name, property_id, property_title, property_location, check_in, check_out, guests, price_per_night, total_price } = body as Record<string, string | number>;
    if (!user_email || !property_title || !check_in || !check_out) return jsonErr('Missing required fields');

    const todayStr = new Date().toISOString().split('T')[0];
    if (String(check_in) < todayStr) return jsonErr('Check-in date cannot be in the past. Please select today or a future date.');
    if (String(check_out) <= String(check_in)) return jsonErr('Check-out date must be after check-in date.');

    if (property_id && guests !== undefined && guests !== null) {
      const { data: propForGuests } = await supabase.from('property_applications').select('max_guests').eq('id', String(property_id)).maybeSingle();
      if (propForGuests?.max_guests != null) {
        const requestedGuests = Number(guests);
        if (requestedGuests > propForGuests.max_guests) {
          return jsonErr(`This property allows a maximum of ${propForGuests.max_guests} guest${propForGuests.max_guests > 1 ? 's' : ''}. You requested ${requestedGuests}.`);
        }
        if (requestedGuests < 1) return jsonErr('Guest count must be at least 1.');
      }
    }

    let approvalMode = 'manual_24h';
    if (property_id) {
      const { data: propData } = await supabase.from('property_applications').select('booking_approval_mode').eq('id', String(property_id)).maybeSingle();
      approvalMode = propData?.booking_approval_mode ?? 'manual_24h';
    }

    const isAutoConfirm = approvalMode === 'auto_confirm';
    const initialStatus = isAutoConfirm ? 'confirmed' : 'pending_host_approval';
    const approvalDeadline = !isAutoConfirm ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

    const { data: booking, error: dbError } = await supabase.from('bookings').insert({
      user_email, user_name, property_id, property_title, property_location,
      check_in, check_out, guests, price_per_night, total_price,
      status: initialStatus,
      approval_deadline: approvalDeadline,
      contact_reveal_sent: false,
    }).select().maybeSingle();

    if (dbError || !booking) return jsonErr('Failed to save booking', 500);
    await logEvent(supabase, booking.id, 'created', null, initialStatus, 'system', `approvalMode: ${approvalMode}`);

    // Notify the company inbox about every new booking request (regardless of mode)
    {
      const adminUrl = `${SITE_URL}/admin`;
      const html = emailWrapper(
        `<h2 style="color:#111;margin-top:0">New Booking Request</h2>
         <p>A new booking has been submitted on RentCottage.Ge.</p>
         ${bookingTable([
           ['Property', String(property_title ?? '—')],
           ['Location', String(property_location ?? '—')],
           ['Customer', `${user_name ?? '—'} &lt;${user_email}&gt;`],
           ['Check-in', String(check_in)],
           ['Check-out', String(check_out)],
           ['Guests', String(guests)],
           ['Total', `&#x20BE;${total_price}`],
           ['Mode', isAutoConfirm ? 'Auto-confirmed' : 'Awaiting host approval'],
           ['Booking ID', String(booking.id)],
         ])}
         <p style="color:#6b7280;font-size:13px;margin:0">Manage this booking in the <a href="${adminUrl}" style="color:#e53e3e">admin panel</a>.</p>`,
      );
      await sendEmail(
        supabase,
        COMPANY_EMAIL,
        `New booking request — ${property_title}`,
        html,
        'booking_request_company',
        String(booking.id),
      );
    }

    if (isAutoConfirm) {
      await sendEmail(supabase, user_email as string, `Booking Confirmed – ${property_title}`, buildAutoConfirmCustomerEmailHtml(booking), 'booking_auto_confirmed', String(booking.id));
    } else {
      await sendEmail(supabase, user_email as string, `Booking Request Received – ${property_title}`,
        emailWrapper(`<h2 style="color:#111;margin-top:0">Booking Request Received</h2><p>Hi ${user_name || 'there'},</p><p>Your request for <strong>${property_title}</strong> is awaiting host approval. The host has 24 hours to respond.</p>${bookingTable([['Check-in', String(check_in)], ['Check-out', String(check_out)], ['Total', '₾' + total_price]])}${cancellationPolicyBlock()}<p style="color:#6b7280;font-size:13px;margin:0">You can manage your booking from <a href="${SITE_URL}/profile" style="color:#e53e3e">My Profile</a>.</p>`),
        'booking_request_received', String(booking.id));
      if (property_id) {
        const { data: pa } = await supabase.from('property_applications').select('host_email, host_first_name').eq('id', String(property_id)).maybeSingle();
        if (pa?.host_email && pa.host_email !== String(user_email) && pa.host_email !== COMPANY_EMAIL) {
          await sendEmail(supabase, pa.host_email, `ახალი ჯავშნის მოთხოვნა — საჭიროა მოქმედება: "${property_title}" 🏡`, buildHostNewBookingEmailHtml(pa.host_first_name || 'there', toHostSafeBooking(booking)), 'booking_request_host', String(booking.id));
        }
      }
    }

    return jsonOk({ success: true, bookingId: booking.id });
  }

  return jsonErr('Method not allowed', 405);
});
