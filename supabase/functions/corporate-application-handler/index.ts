// Corporate / travel-agency applications.
// POST (no action)              → new agency registration
// POST action=admin-approve     → admin approves an application
// POST action=admin-reject      → admin rejects with a note

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const COMPANY_EMAIL = 'info.rentcottage@gmail.com';
const FROM_EMAIL = 'noreply@rentcottage.ge';
const HCAPTCHA_SECRET = Deno.env.get('HCAPTCHA_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function verifyHCaptcha(token: string): Promise<boolean> {
  if (!HCAPTCHA_SECRET) return true; // dev fallback
  try {
    const res = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(HCAPTCHA_SECRET)}&response=${encodeURIComponent(token)}`,
    });
    const json = await res.json();
    return !!json.success;
  } catch {
    return false;
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[corporate-handler] RESEND_API_KEY missing — skipping email');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: `RentCottage <${FROM_EMAIL}>`, to, subject, html }),
    });
    if (!res.ok) {
      console.error('[corporate-handler] Resend error', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[corporate-handler] Resend network error', e);
    return false;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function shell(title: string, body: string, color = '#0f766e'): string {
  return `
    <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#333">
      <div style="background:${color};padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">RentCottage.Ge</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:28px 32px;border-radius:0 0 8px 8px">
        <h2 style="color:#1a1a1a;margin-top:0">${title}</h2>
        ${body}
        <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">© 2026 RentCottage.Ge</p>
      </div>
    </div>`;
}

function adminNotificationHtml(app: Record<string, unknown>): string {
  return shell('New corporate application',
    `<p>A new travel-agency application has been submitted and is awaiting review.</p>
     <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">
       <tr style="background:#f9fafb"><td style="padding:8px 12px;font-weight:600;border:1px solid #e5e7eb;width:40%">Agency</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${app.agency_name}</td></tr>
       <tr><td style="padding:8px 12px;font-weight:600;border:1px solid #e5e7eb">Tax ID</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${app.tax_id}</td></tr>
       <tr style="background:#f9fafb"><td style="padding:8px 12px;font-weight:600;border:1px solid #e5e7eb">Representative</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${app.rep_first_name} ${app.rep_last_name}</td></tr>
       <tr><td style="padding:8px 12px;font-weight:600;border:1px solid #e5e7eb">Email</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${app.email}</td></tr>
       <tr style="background:#f9fafb"><td style="padding:8px 12px;font-weight:600;border:1px solid #e5e7eb">Phone</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${app.phone ?? '—'}</td></tr>
     </table>
     <p style="margin-top:16px">Review and act in the admin panel under <strong>Corporate Applications</strong>.</p>`);
}

function applicantConfirmationHtml(app: Record<string, unknown>): string {
  return shell('Application received',
    `<p>Hi ${app.rep_first_name},</p>
     <p>Thanks for applying to RentCottage.Ge as a travel-agency partner — your application for <strong>${app.agency_name}</strong> is now under review.</p>
     <p>Once approved, you can sign in at <a href="https://rentcottage.ge/corporate" style="color:#0f766e">rentcottage.ge/corporate</a> to start booking cottages on behalf of your clients and earn <strong>5% commission</strong> on every booking.</p>
     <p>We typically review within 24 hours.</p>`);
}

function approvalEmailHtml(app: Record<string, unknown>): string {
  return shell('Your agency account is approved 🎉',
    `<p>Hi ${app.rep_first_name},</p>
     <p><strong>${app.agency_name}</strong> has been approved as a RentCottage.Ge travel-agency partner.</p>
     <p>Sign in at <a href="https://rentcottage.ge/corporate" style="color:#0f766e">rentcottage.ge/corporate</a> to access your dashboard, book cottages for clients, and track your 5% commission on every confirmed booking.</p>`,
    '#0f766e');
}

function rejectionEmailHtml(app: Record<string, unknown>, note: string): string {
  return shell('Application update',
    `<p>Hi ${app.rep_first_name},</p>
     <p>Thank you for your interest in partnering with RentCottage.Ge. After review we are unable to approve <strong>${app.agency_name}</strong> as a corporate partner at this time.</p>
     ${note ? `<div style="background:#fef2f2;border-left:3px solid #ef4444;padding:12px 16px;margin:16px 0;font-size:14px;color:#7f1d1d">${note}</div>` : ''}
     <p>For questions, reach out at <a href="mailto:${COMPANY_EMAIL}" style="color:#0f766e">${COMPANY_EMAIL}</a>.</p>`,
    '#b91c1c');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const action = body.action as string | undefined;

  // ── Admin list (service-role bypass; RLS hides rows from the anon client) ──
  if (action === 'admin-list') {
    const { data, error } = await supabase
      .from('corporate_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ applications: data ?? [] });
  }

  // ── Admin approve ──────────────────────────────────────────────────
  if (action === 'admin-approve') {
    const applicationId = body.applicationId as string;
    if (!applicationId) return jsonResponse({ error: 'Missing applicationId' }, 400);

    const { data: app, error: fetchErr } = await supabase
      .from('corporate_applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();
    if (fetchErr || !app) return jsonResponse({ error: 'Application not found' }, 404);
    if (app.status === 'approved') return jsonResponse({ success: true, alreadyApproved: true });

    // Find or create the auth user for this agency.
    let userId: string | null = app.user_id ?? null;
    if (!userId) {
      const targetEmail = String(app.email).toLowerCase();
      // listUsers paginates (default 50) and has no working email filter — walk the pages.
      const findExistingUserId = async (): Promise<string | null> => {
        for (let page = 1; page <= 50; page++) {
          const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
          if (error || !data?.users?.length) return null;
          const match = data.users.find((u) => (u.email ?? '').toLowerCase() === targetEmail);
          if (match) return match.id;
          if (data.users.length < 200) return null; // last page
        }
        return null;
      };

      userId = await findExistingUserId();

      if (!userId) {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: String(app.email),
          email_confirm: true,
          user_metadata: {
            full_name: `${app.rep_first_name} ${app.rep_last_name}`,
            agency_name: app.agency_name,
            role: 'corporate',
          },
        });
        if (createErr || !created.user) {
          console.error('[corporate-handler] createUser failed', createErr);
          // Race: maybe the user was created between our search and our create call. Try once more.
          const retryId = await findExistingUserId();
          if (retryId) {
            userId = retryId;
          } else {
            const msg = createErr?.message ?? 'Unknown auth error';
            return jsonResponse({ error: `Failed to create auth user: ${msg}` }, 500);
          }
        } else {
          userId = created.user.id;
        }
      }
    }

    const { error: updErr } = await supabase
      .from('corporate_applications')
      .update({ status: 'approved', user_id: userId, approved_at: new Date().toISOString() })
      .eq('id', applicationId);
    if (updErr) {
      console.error('[corporate-handler] update failed', updErr);
      return jsonResponse({ error: 'Failed to update status' }, 500);
    }

    await sendEmail(String(app.email), `Your RentCottage.Ge agency account is approved`, approvalEmailHtml(app as Record<string, unknown>));
    return jsonResponse({ success: true, userId });
  }

  // ── Admin reject ───────────────────────────────────────────────────
  if (action === 'admin-reject') {
    const applicationId = body.applicationId as string;
    const note = (body.rejectionNote as string | undefined)?.trim() ?? '';
    if (!applicationId) return jsonResponse({ error: 'Missing applicationId' }, 400);

    const { data: app, error: fetchErr } = await supabase
      .from('corporate_applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();
    if (fetchErr || !app) return jsonResponse({ error: 'Application not found' }, 404);

    const { error: updErr } = await supabase
      .from('corporate_applications')
      .update({ status: 'rejected', rejection_note: note || null })
      .eq('id', applicationId);
    if (updErr) return jsonResponse({ error: 'Failed to update status' }, 500);

    await sendEmail(String(app.email), `Update on your RentCottage.Ge agency application`, rejectionEmailHtml(app as Record<string, unknown>, note));
    return jsonResponse({ success: true });
  }

  // ── New registration ───────────────────────────────────────────────
  const captchaToken = body.captcha_token as string | undefined;
  if (captchaToken && !(await verifyHCaptcha(captchaToken))) {
    return jsonResponse({ error: 'CAPTCHA verification failed. Please try again.' }, 403);
  }

  const agency_name = String(body.agency_name ?? '').trim();
  const tax_id = String(body.tax_id ?? '').trim();
  const rep_first_name = String(body.rep_first_name ?? '').trim();
  const rep_last_name = String(body.rep_last_name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? '').trim();

  if (!agency_name || !tax_id || !rep_first_name || !rep_last_name || !email || !phone) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  // Prevent duplicate pending/approved applications for the same email.
  const { data: existing } = await supabase
    .from('corporate_applications')
    .select('id, status')
    .ilike('email', email)
    .in('status', ['pending', 'approved'])
    .maybeSingle();
  if (existing) {
    return jsonResponse({
      error: existing.status === 'approved'
        ? 'An agency account with this email already exists.'
        : 'An application with this email is already pending review.',
    }, 409);
  }

  const { data: app, error: insErr } = await supabase
    .from('corporate_applications')
    .insert({
      agency_name,
      tax_id,
      rep_first_name,
      rep_last_name,
      email,
      phone,
      status: 'pending',
    })
    .select()
    .maybeSingle();

  if (insErr || !app) {
    console.error('[corporate-handler] insert failed', insErr);
    return jsonResponse({ error: 'Failed to save application' }, 500);
  }

  // Fire both emails; don't fail the request if email is down.
  await Promise.all([
    sendEmail(COMPANY_EMAIL, `New corporate application: ${agency_name}`, adminNotificationHtml(app as Record<string, unknown>)),
    sendEmail(email, `RentCottage.Ge — Your agency application was received`, applicantConfirmationHtml(app as Record<string, unknown>)),
  ]);

  return jsonResponse({ success: true, applicationId: app.id });
});
