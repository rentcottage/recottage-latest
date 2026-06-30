import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const COMPANY_EMAIL = 'info.rentcottage@gmail.com';
const FROM_EMAIL = 'noreply@rentcottage.ge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
};

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

// ─── Smart sendEmail ──────────────────────────────────────────────────────────
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
  const { supabase, to, subject, html, context = 'application', contextId, maxRetries = 3, retryDelayMs = 2000 } = opts;

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
        console.warn(`[sendEmail] Permanent failure for ${to} — blocking email`);
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
          console.log(`[sendEmail] Transient (${res.status}) — retry in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        const retryAfter = new Date(Date.now() + 15 * 60 * 1000);
        await logDelivery({ supabase, recipientEmail: to, subject, context, contextId, status: 'transient_failure', httpStatus: res.status, errorMessage: errorBody.slice(0, 500), attemptNumber: attempt, retryAfter });
        return false;
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt - 1)));
        continue;
      }

      await logDelivery({ supabase, recipientEmail: to, subject, context, contextId, status: 'transient_failure', httpStatus: res.status, errorMessage: errorBody.slice(0, 500), attemptNumber: attempt, retryAfter: new Date(Date.now() + 15 * 60 * 1000) });
      return false;

    } catch (e) {
      lastErrorMessage = e instanceof Error ? e.message : String(e);
      console.error(`[sendEmail] Exception attempt ${attempt}:`, e);
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

// ─── Legacy thin wrapper ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendEmail(supabase: any, to: string, subject: string, html: string, context = 'application', contextId?: string): Promise<boolean> {
  return sendEmailSmart({ supabase, to, subject, html, context, contextId });
}

// ── hCaptcha verification ────────────────────────────────────────────────────
async function verifyHCaptcha(token: string): Promise<boolean> {
  const secret = Deno.env.get('HCAPTCHA_SECRET_KEY');
  if (!secret) {
    console.error('[hCaptcha] HCAPTCHA_SECRET_KEY secret is not set');
    return false;
  }
  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    const res = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch (e) {
    console.error('[hCaptcha] Verification error:', e);
    return false;
  }
}

function buildSubmissionConfirmationEmailHtml(app: Record<string, unknown>): string {
  const hostName = `${app.host_first_name} ${app.host_last_name}`;
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
      <div style="background:#e53e3e;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">RentCottage.Ge</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px">
        <h2 style="color:#1a1a1a;margin-top:0">Application Received &#x1f4ec;</h2>
        <p>Hi ${hostName},</p>
        <p>Thank you for submitting your host application! We have successfully received your application and it is now <strong>under review</strong> by our team.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:24px 0">
          <h3 style="margin:0 0 12px;color:#444;font-size:15px">Application Summary</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr>
              <td style="padding:8px 0;font-weight:600;color:#555;width:40%">Applicant</td>
              <td style="padding:8px 0;color:#333">${hostName}</td>
            </tr>
            ${app.title ? `<tr><td style="padding:8px 0;font-weight:600;color:#555;border-top:1px solid #e5e7eb">Cottage Name</td><td style="padding:8px 0;color:#333;border-top:1px solid #e5e7eb">${app.title}</td></tr>` : ''}
            ${app.location ? `<tr><td style="padding:8px 0;font-weight:600;color:#555;border-top:1px solid #e5e7eb">Location</td><td style="padding:8px 0;color:#333;border-top:1px solid #e5e7eb">${app.location}</td></tr>` : ''}
            <tr>
              <td style="padding:8px 0;font-weight:600;color:#555;border-top:1px solid #e5e7eb">Status</td>
              <td style="padding:8px 0;border-top:1px solid #e5e7eb">
                <span style="background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:20px;font-size:13px;font-weight:600">&#x23f3; Under Review</span>
              </td>
            </tr>
          </table>
        </div>
        <h3 style="color:#444;font-size:15px;margin-top:0">What happens next?</h3>
        <ol style="padding-left:20px;margin:0 0 20px;font-size:14px;color:#555;line-height:1.8">
          <li>Our team will review your application — typically within <strong>24 hours</strong></li>
          <li>We may schedule a brief property inspection at your convenience</li>
          <li>You will receive another email once your application is <strong>approved or rejected</strong></li>
          <li>Upon approval, your cottage goes live and you can start accepting bookings</li>
        </ol>
        <p style="font-size:14px;color:#555">If you have any questions, feel free to reach out at <a href="mailto:${COMPANY_EMAIL}" style="color:#e53e3e">${COMPANY_EMAIL}</a>.</p>
        <p style="margin-top:24px">Warm regards,<br/><strong>The RentCottage.Ge Team</strong></p>
        <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">&#xa9; 2024 RentCottage.Ge — This is an automated confirmation email.</p>
      </div>
    </div>`;
}

function buildApprovalEmailHtml(app: Record<string, unknown>): string {
  const hostName = `${app.host_first_name} ${app.host_last_name}`;
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
      <div style="background:#e53e3e;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">RentCottage.Ge</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px">
        <h2 style="color:#38a169;margin-top:0">Congratulations! Your cottage is approved &#x1f389;</h2>
        <p>Hi ${hostName},</p>
        <p>Great news! Your cottage application has been <strong>approved</strong> by our team. Your listing is now <strong>live</strong> on RentCottage.Ge and visible to guests.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
          <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb;width:40%">Cottage</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${app.title}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Location</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${app.location}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Price per night</td><td style="padding:10px 14px;border:1px solid #e5e7eb">&#x20BE;${app.price_per_night}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Status</td><td style="padding:10px 14px;border:1px solid #e5e7eb;color:#38a169;font-weight:600">&#x2705; Approved &amp; Live</td></tr>
        </table>
        <p>Guests can now discover and book your cottage. You will be notified for every booking request.</p>
        <p style="color:#555;font-size:14px">For any questions, contact us at <a href="mailto:${COMPANY_EMAIL}" style="color:#e53e3e">${COMPANY_EMAIL}</a>.</p>
        <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">&#xa9; 2024 RentCottage.Ge</p>
      </div>
    </div>`;
}

function buildRejectionEmailHtml(app: Record<string, unknown>): string {
  const hostName = `${app.host_first_name} ${app.host_last_name}`;
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
      <div style="background:#e53e3e;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">RentCottage.Ge</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px">
        <h2 style="color:#e53e3e;margin-top:0">Application Update</h2>
        <p>Hi ${hostName},</p>
        <p>Thank you for your interest in listing your cottage on RentCottage.Ge. After careful review, we were unable to approve your application for <strong>"${app.title}"</strong> at this time.</p>
        <p>This may be due to our current listing criteria or capacity. We encourage you to contact us for more details and to explore resubmitting after making any necessary improvements.</p>
        <p style="color:#555;font-size:14px">Please reach out at <a href="mailto:${COMPANY_EMAIL}" style="color:#e53e3e">${COMPANY_EMAIL}</a> for more information.</p>
        <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">&#xa9; 2024 RentCottage.Ge</p>
      </div>
    </div>`;
}

function htmlPage(title: string, message: string, color = '#e53e3e') {
  const icon = color === '#38a169' ? '&#x2705;' : color === '#e53e3e' ? '&#x274c;' : 'ℹ️';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}.card{background:#fff;border-radius:12px;padding:40px 48px;text-align:center;max-width:480px;width:90%}.icon{font-size:48px;margin-bottom:16px}h1{color:${color};margin:0 0 12px}p{color:#555;margin:0;line-height:1.6}</style></head><body><div class="card"><div class="icon">${icon}</div><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const appId = url.searchParams.get('id');
  const token = url.searchParams.get('token');

  if (req.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const postAction = body.action as string | undefined;

    // ── Admin authorization for admin POST actions ──────────────────────────
    // The public application submission (no action) and the token-gated GET
    // approve/reject links are unaffected. The admin POST actions below flip any
    // application's status, so they require the server-side admin secret.
    if (postAction === 'admin-approve-application' || postAction === 'admin-reject-application') {
      const ADMIN_PASSWORD = Deno.env.get('ADMIN_PANEL_PASSWORD') ?? '';
      const provided = (body.adminPassword as string | undefined) ?? req.headers.get('x-admin-password') ?? '';
      const timingSafeEqual = (a: string, b: string): boolean => {
        if (a.length !== b.length || a.length === 0) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return diff === 0;
      };
      if (!(ADMIN_PASSWORD.length > 0 && timingSafeEqual(provided, ADMIN_PASSWORD))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (postAction === 'admin-approve-application') {
      const applicationId = body.applicationId as string;
      if (!applicationId) {
        return new Response(JSON.stringify({ error: 'Missing applicationId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: app, error: fetchErr } = await supabase
        .from('property_applications').select('*').eq('id', applicationId).maybeSingle();
      if (fetchErr || !app) {
        return new Response(JSON.stringify({ error: 'Application not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error: updateErr } = await supabase
        .from('property_applications').update({ status: 'approved' }).eq('id', applicationId);
      if (updateErr) {
        return new Response(JSON.stringify({ error: 'Failed to update status' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const emailSent = await sendEmail(
        supabase,
        app.host_email as string,
        `Your cottage "${app.title}" has been approved!`,
        buildApprovalEmailHtml(app as Record<string, unknown>),
        'application_approved',
        applicationId
      );
      return new Response(JSON.stringify({ success: true, emailSent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (postAction === 'admin-reject-application') {
      const applicationId = body.applicationId as string;
      if (!applicationId) {
        return new Response(JSON.stringify({ error: 'Missing applicationId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: app, error: fetchErr } = await supabase
        .from('property_applications').select('*').eq('id', applicationId).maybeSingle();
      if (fetchErr || !app) {
        return new Response(JSON.stringify({ error: 'Application not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error: updateErr } = await supabase
        .from('property_applications').update({ status: 'rejected' }).eq('id', applicationId);
      if (updateErr) {
        return new Response(JSON.stringify({ error: 'Failed to update status' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const emailSent = await sendEmail(
        supabase,
        app.host_email as string,
        `Update on your cottage application: "${app.title}"`,
        buildRejectionEmailHtml(app as Record<string, unknown>),
        'application_rejected',
        applicationId
      );
      return new Response(JSON.stringify({ success: true, emailSent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── New application submission ───────────────────────────────────────
    const captchaToken = body.captcha_token as string | undefined;
    if (!captchaToken) {
      return new Response(JSON.stringify({ error: 'CAPTCHA token is required.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const captchaValid = await verifyHCaptcha(captchaToken);
    if (!captchaValid) {
      return new Response(JSON.stringify({ error: 'CAPTCHA verification failed. Please try again.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      host_first_name, host_last_name, host_email, host_phone,
      property_type, location, bedrooms, bathrooms, max_guests,
      amenities, categories, photo_urls, title, description, price_per_night,
      pricing_type, guest_pricing_tiers, accepted_payment_methods,
    } = body;

    const allowedPaymentMethods = ['online_only', 'pay_at_property_only', 'both'];
    const acceptedPm = allowedPaymentMethods.includes(String(accepted_payment_methods))
      ? String(accepted_payment_methods)
      : 'both';

    if (!host_email || !title || !location || !price_per_night) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: app, error: dbError } = await supabase
      .from('property_applications')
      .insert({
        host_first_name, host_last_name, host_email, host_phone,
        property_type, location,
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        max_guests: Number(max_guests),
        amenities: amenities || [],
        categories: categories || [],
        photo_urls: photo_urls || [],
        title, description,
        price_per_night: Number(price_per_night),
        pricing_type: pricing_type || 'fixed',
        guest_pricing_tiers: guest_pricing_tiers || null,
        accepted_payment_methods: acceptedPm,
        status: 'pending',
      })
      .select()
      .maybeSingle();

    if (dbError || !app) {
      console.error('DB insert error:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to save application' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fnBaseUrl = `${url.protocol}//${url.host}${url.pathname}`;
    const approveUrl = `${fnBaseUrl}?action=approve&id=${app.id}&token=${app.admin_token}`;
    const rejectUrl = `${fnBaseUrl}?action=reject&id=${app.id}&token=${app.admin_token}`;
    const hostName = `${host_first_name} ${host_last_name}`;

    const photoUrlsArr = (photo_urls as string[]) || [];
    const photoPreviewHtml = photoUrlsArr.length > 0
      ? `<div style="margin:16px 0"><p style="font-weight:600;margin-bottom:8px;font-size:14px">Photos (${photoUrlsArr.length}):</p><div style="display:flex;flex-wrap:wrap;gap:8px">${photoUrlsArr.map((u: string, i: number) => `<a href="${u}" target="_blank"><img src="${u}" alt="Photo ${i+1}" style="width:120px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb" /></a>`).join('')}</div></div>`
      : '<p style="color:#999;font-size:14px">No photos uploaded</p>';

    const amenitiesArr = (amenities as string[]) || [];
    const categoriesArr = (categories as string[]) || [];
    const pricingLabel = pricing_type === 'per_guest' ? 'By Guest Count' : 'Fixed Price';
    const tiersArr = (guest_pricing_tiers as Array<{min_guests:number;max_guests:number;price_per_night:number}>) || [];
    const tiersHtml = pricing_type === 'per_guest' && tiersArr.length > 0
      ? `<tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Guest Pricing Tiers</td><td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:13px">${tiersArr.map(t => `${t.min_guests === t.max_guests ? t.min_guests : `${t.min_guests}-${t.max_guests}`} guest${t.max_guests > 1 ? 's' : ''}: &#x20BE;${t.price_per_night}`).join('<br/>')}</td></tr>`
      : '';

    const adminHtml = `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#333">
        <div style="background:#e53e3e;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px">RentCottage.Ge — New Property Application</h1>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px">
          <h2 style="margin-top:0;color:#1a1a1a">New cottage application submitted!</h2>
          <h3 style="color:#444;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:24px">&#x1f3e0; Property Details</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb;width:38%">Property Title</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${title}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Type</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${property_type}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Categories</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${categoriesArr.length > 0 ? categoriesArr.join(', ') : '—'}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Location</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${location}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Bedrooms</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${bedrooms}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Bathrooms</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${bathrooms}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Max Guests</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${max_guests}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Pricing Model</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${pricingLabel}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Base Price/Night</td><td style="padding:10px 14px;border:1px solid #e5e7eb">&#x20BE;${price_per_night}</td></tr>
            ${tiersHtml}
            <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Amenities</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${amenitiesArr.length > 0 ? amenitiesArr.join(', ') : '—'}</td></tr>
          </table>
          <h3 style="color:#444;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:24px">&#x1f4dd; Description</h3>
          <p style="font-size:14px;color:#555;background:#f9fafb;padding:12px;border-radius:6px;line-height:1.6">${description}</p>
          <h3 style="color:#444;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:24px">&#x1f4f8; Photos</h3>
          ${photoPreviewHtml}
          <h3 style="color:#444;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:24px">&#x1f464; Host Information</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb;width:38%">Host Name</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${hostName}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Email</td><td style="padding:10px 14px;border:1px solid #e5e7eb"><a href="mailto:${host_email}">${host_email}</a></td></tr>
            <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Phone</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${host_phone}</td></tr>
          </table>
          <div style="text-align:center;margin:40px 0 24px">
            <a href="${approveUrl}" style="display:inline-block;background:#38a169;color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:700;font-size:16px;margin-right:16px">&#x2705; Approve Application</a>
            <a href="${rejectUrl}" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:700;font-size:16px">&#x274c; Reject Application</a>
          </div>
          <p style="color:#999;font-size:12px;text-align:center">Clicking either button updates the status and automatically notifies the host.</p>
          <p style="color:#999;font-size:12px;text-align:center;margin-top:8px">Application ID: ${app.id}</p>
          <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px;text-align:center">&#xa9; 2024 RentCottage.Ge</p>
        </div>
      </div>`;

    await sendEmail(supabase, COMPANY_EMAIL, `New Property Application: "${title}" — ${hostName}`, adminHtml, 'application_submitted_admin', String(app.id));
    await sendEmail(
      supabase,
      host_email as string,
      `We received your host application — "${title}"`,
      buildSubmissionConfirmationEmailHtml(app as Record<string, unknown>),
      'application_submitted_host',
      String(app.id)
    );

    return new Response(
      JSON.stringify({ success: true, applicationId: app.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'GET' && action && appId && token) {
    const { data: app, error: fetchError } = await supabase
      .from('property_applications')
      .select('*')
      .eq('id', appId)
      .eq('admin_token', token)
      .maybeSingle();

    if (fetchError || !app) {
      return new Response(
        htmlPage('Invalid Link', 'This link is invalid or has already been used.', '#e53e3e'),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    if (app.status !== 'pending') {
      const already = app.status === 'approved' ? 'approved' : 'rejected';
      return new Response(
        htmlPage('Already Processed', `This application has already been ${already}.`, '#718096'),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const isApproved = newStatus === 'approved';

    const { error: updateError } = await supabase
      .from('property_applications')
      .update({ status: newStatus })
      .eq('id', appId);

    if (updateError) {
      return new Response(
        htmlPage('Error', 'Failed to update application status. Please try again.', '#e53e3e'),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const hostName = `${app.host_first_name} ${app.host_last_name}`;
    const hostSubject = isApproved
      ? `Your cottage "${app.title}" has been approved!`
      : `Update on your cottage application: "${app.title}"`;
    const hostHtml = isApproved
      ? buildApprovalEmailHtml(app as Record<string, unknown>)
      : buildRejectionEmailHtml(app as Record<string, unknown>);

    await sendEmail(supabase, app.host_email as string, hostSubject, hostHtml, isApproved ? 'application_approved' : 'application_rejected', String(app.id));

    return new Response(
      htmlPage(
        isApproved ? 'Application Approved!' : 'Application Rejected',
        isApproved
          ? `The cottage "${app.title}" by ${hostName} has been approved and is now live on the platform. The host has been notified by email.`
          : `The application for "${app.title}" has been rejected. The host has been notified by email.`,
        isApproved ? '#38a169' : '#e53e3e'
      ),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
