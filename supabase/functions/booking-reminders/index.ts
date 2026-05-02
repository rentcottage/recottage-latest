import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = 're_CZyr35EQ_Hu4oARihEKkNBC3s162dDtQv';
const FROM_EMAIL = 'bookings@rentcottage.ge';
const SITE_URL = 'https://rentcottage.ge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOST EMAIL PRIVACY POLICY — PERMANENT RULE
// Reminder emails to hosts must NEVER contain customer personal details:
//   ✗ No customer name, email, or phone
//   ✓ Only: Booking ID, property name, dates, guests, total price
// All host reminder emails are in Georgian.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Bounce classification ────────────────────────────────────────────────────
const PERMANENT_BOUNCE_CODES = [
  'email_not_deliverable',
  'invalid_email',
  'mailbox_does_not_exist',
  'invalid_to',
];

function isPermanentFailure(httpStatus: number, errorBody: string): boolean {
  if (httpStatus === 422) return true;
  if (httpStatus === 400) {
    const lower = errorBody.toLowerCase();
    if (PERMANENT_BOUNCE_CODES.some(c => lower.includes(c))) return true;
    if (lower.includes('invalid') && lower.includes('email')) return true;
  }
  return false;
}

function isTransientFailure(httpStatus: number): boolean {
  return httpStatus === 429 || httpStatus >= 500;
}

// ─── Delivery log ─────────────────────────────────────────────────────────────
type EmailDeliveryStatus = 'sent' | 'transient_failure' | 'permanent_failure' | 'skipped_blocked';

interface LogDeliveryOpts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
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

async function logDelivery(opts: LogDeliveryOpts): Promise<void> {
  try {
    await opts.supabase.from('email_delivery_logs').insert({
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

// ─── Smart sendEmail with bounce detection ────────────────────────────────────
interface SendEmailOpts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  to: string;
  subject: string;
  html: string;
  context?: string;
  contextId?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

async function sendEmailSmart(opts: SendEmailOpts): Promise<boolean> {
  const { supabase, to, subject, html, context = 'reminder', contextId, maxRetries = 3, retryDelayMs = 2000 } = opts;

  // ── Skip if permanently blocked ──────────────────────────────────────────
  const { data: blocked } = await supabase
    .from('blocked_emails')
    .select('id, bounce_type')
    .eq('email', to.toLowerCase().trim())
    .maybeSingle();

  if (blocked) {
    console.warn(`[sendEmail] Skipping blocked email: ${to}`);
    await logDelivery({ supabase, recipientEmail: to, subject, context, contextId, status: 'skipped_blocked', errorMessage: `Blocked (${blocked.bounce_type ?? 'permanent'})` });
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
        console.log(`[sendEmail] Sent to ${to} (attempt ${attempt})`);
        await logDelivery({ supabase, recipientEmail: to, subject, context, contextId, status: 'sent', httpStatus: res.status, attemptNumber: attempt });
        return true;
      }

      const errorBody = await res.text();
      lastErrorMessage = `HTTP ${res.status}: ${errorBody}`;
      console.error(`[sendEmail] Attempt ${attempt}/${maxRetries} failed for ${to}: ${lastErrorMessage}`);

      if (isPermanentFailure(res.status, errorBody)) {
        console.warn(`[sendEmail] Permanent failure for ${to} — marking as invalid`);
        await supabase.from('blocked_emails').upsert({
          email: to.toLowerCase().trim(),
          blocked_reason: `Permanent bounce: ${errorBody.slice(0, 300)}`,
          blocked_at: new Date().toISOString(),
          source: `${context}/${contextId ?? 'unknown'}`,
          bounce_type: 'permanent',
        }, { onConflict: 'email' });
        await logDelivery({ supabase, recipientEmail: to, subject, context, contextId, status: 'permanent_failure', httpStatus: res.status, errorMessage: errorBody.slice(0, 500), attemptNumber: attempt });
        return false;
      }

      if (isTransientFailure(res.status)) {
        if (attempt < maxRetries) {
          const delay = retryDelayMs * Math.pow(2, attempt - 1);
          console.log(`[sendEmail] Transient (${res.status}) — retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        const retryAfter = new Date(Date.now() + 15 * 60 * 1000);
        await logDelivery({ supabase, recipientEmail: to, subject, context, contextId, status: 'transient_failure', httpStatus: res.status, errorMessage: errorBody.slice(0, 500), attemptNumber: attempt, retryAfter });
        return false;
      }

      if (attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      await logDelivery({ supabase, recipientEmail: to, subject, context, contextId, status: 'transient_failure', httpStatus: res.status, errorMessage: errorBody.slice(0, 500), attemptNumber: attempt, retryAfter: new Date(Date.now() + 15 * 60 * 1000) });
      return false;

    } catch (e) {
      lastErrorMessage = e instanceof Error ? e.message : String(e);
      console.error(`[sendEmail] Exception attempt ${attempt}/${maxRetries}:`, e);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt - 1)));
        continue;
      }
      await logDelivery({ supabase, recipientEmail: to, subject, context, contextId, status: 'transient_failure', httpStatus: lastHttpStatus, errorMessage: lastErrorMessage?.slice(0, 500) ?? 'Exception', attemptNumber: attempt, retryAfter: new Date(Date.now() + 15 * 60 * 1000) });
      return false;
    }
  }
  return false;
}

function emailWrapper(content: string): string {
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

function bookingTable(rows: [string, string][]): string {
  return `<table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
    ${rows.map(([label, value], i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:12px 16px;font-weight:600;border:1px solid #e5e7eb;color:#374151;width:38%">${label}</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#111">${value}</td>
      </tr>`).join('')}
  </table>`;
}

// ─── Host reminder email builder — GEORGIAN ───────────────────────────────────
function buildReminderEmailHtml(
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

// ─── Main reminder logic ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendPendingReminders(supabase: any): Promise<{
  checked: number;
  reminder12Sent: number;
  reminder16Sent: number;
  skipped: number;
  errors: number;
}> {
  const now = new Date();

  const cutoff12h = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const cutoff16h = new Date(now.getTime() - 16 * 60 * 60 * 1000).toISOString();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: pendingBookings, error: fetchErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'pending_host_approval')
    .lt('created_at', cutoff12h)
    .gt('created_at', cutoff24h);

  if (fetchErr) {
    console.error('[reminders] Fetch error:', fetchErr.message);
    return { checked: 0, reminder12Sent: 0, reminder16Sent: 0, skipped: 0, errors: 1 };
  }

  if (!pendingBookings || pendingBookings.length === 0) {
    console.log('[reminders] No pending bookings in reminder window.');
    return { checked: 0, reminder12Sent: 0, reminder16Sent: 0, skipped: 0, errors: 0 };
  }

  let reminder12Sent = 0;
  let reminder16Sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const booking of pendingBookings) {
    try {
      if (!booking.property_id) { skipped++; continue; }

      const { data: pa } = await supabase
        .from('property_applications')
        .select('host_email, host_first_name')
        .eq('id', booking.property_id)
        .maybeSingle();

      if (!pa?.host_email) { skipped++; continue; }

      const hostFirstName = pa.host_first_name || 'ჰოსტო';
      const createdAt = new Date(booking.created_at);
      const hoursElapsed = Math.floor((now.getTime() - createdAt.getTime()) / (60 * 60 * 1000));

      const needsReminder12 = !booking.reminder_12h_sent && createdAt < new Date(cutoff12h);
      const needsReminder16 = !booking.reminder_16h_sent && createdAt < new Date(cutoff16h);

      if (needsReminder16) {
        const ok = await sendEmailSmart({
          supabase,
          to: pa.host_email,
          subject: `⚠️ გადაუდებელი: ჯავშნის მოთხოვნა ვადის ამოწურვის პირასაა – ${booking.property_title}`,
          html: buildReminderEmailHtml(hostFirstName, booking, 2, hoursElapsed),
          context: 'host_reminder_16h',
          contextId: String(booking.id),
        });
        if (ok) {
          await supabase
            .from('bookings')
            .update({ reminder_12h_sent: true, reminder_16h_sent: true })
            .eq('id', booking.id);
          reminder16Sent++;
          console.log(`[reminders] 16h reminder sent for booking ${booking.id}`);
        } else {
          errors++;
        }
      } else if (needsReminder12) {
        const ok = await sendEmailSmart({
          supabase,
          to: pa.host_email,
          subject: `⏰ შეხსენება: გაქვთ განუხილველი ჯავშნის მოთხოვნა – ${booking.property_title}`,
          html: buildReminderEmailHtml(hostFirstName, booking, 1, hoursElapsed),
          context: 'host_reminder_12h',
          contextId: String(booking.id),
        });
        if (ok) {
          await supabase
            .from('bookings')
            .update({ reminder_12h_sent: true })
            .eq('id', booking.id);
          reminder12Sent++;
          console.log(`[reminders] 12h reminder sent for booking ${booking.id}`);
        } else {
          errors++;
        }
      } else {
        skipped++;
      }
    } catch (e) {
      console.error(`[reminders] Error for booking ${booking.id}:`, e);
      errors++;
    }
  }

  console.log(`[reminders] Done. checked=${pendingBookings.length} 12h=${reminder12Sent} 16h=${reminder16Sent} skipped=${skipped} errors=${errors}`);
  return { checked: pendingBookings.length, reminder12Sent, reminder16Sent, skipped, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  if (req.method === 'GET' || req.method === 'POST') {
    const result = await sendPendingReminders(supabase);
    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
