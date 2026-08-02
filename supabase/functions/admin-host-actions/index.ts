import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const COMPANY_EMAIL = 'info.rentcottage@gmail.com';
const FROM_EMAIL = 'noreply@rentcottage.ge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[sendEmail] Failed:', res.status, errText);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[sendEmail] Exception:', e);
    return false;
  }
}

function buildApprovalEmailHtml(app: Record<string, unknown>): string {
  const hostName = `${app.host_first_name} ${app.host_last_name}`;
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
      <div style="background:#e53e3e;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">RentCottage.Ge</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px">
        <h2 style="color:#38a169;margin-top:0">Congratulations! Your cottage is approved!</h2>
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

function buildRejectionEmailHtml(app: Record<string, unknown>, rejectionNote?: string): string {
  const hostName = `${app.host_first_name} ${app.host_last_name}`;
  const noteSection = rejectionNote
    ? `
        <div style="background:#fff5f5;border-left:4px solid #e53e3e;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0">
          <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:#c53030;text-transform:uppercase;letter-spacing:0.05em">Reason for rejection</p>
          <p style="margin:0;font-size:14px;color:#742a2a;line-height:1.6">${rejectionNote}</p>
        </div>`
    : '';

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
      <div style="background:#e53e3e;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">RentCottage.Ge</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px">
        <h2 style="color:#e53e3e;margin-top:0">Application Update</h2>
        <p>Hi ${hostName},</p>
        <p>Thank you for your interest in listing your cottage on RentCottage.Ge. After careful review, we were unable to approve your application for <strong>"${app.title}"</strong> at this time.</p>
        ${noteSection}
        <p>If you have any questions or would like to discuss this further, please don't hesitate to reach out to us.</p>
        <p style="color:#555;font-size:14px">Please reach out at <a href="mailto:${COMPANY_EMAIL}" style="color:#e53e3e">${COMPANY_EMAIL}</a> for more information.</p>
        <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">&#xa9; 2024 RentCottage.Ge</p>
      </div>
    </div>`;
}

function buildAgreementReminderEmailHtml(app: Record<string, unknown>): string {
  const hostName = `${app.host_first_name} ${app.host_last_name}`;
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
      <div style="background:#e53e3e;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">RentCottage.Ge</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px">
        <h2 style="color:#d69e2e;margin-top:0">ხელშეკრულების ხელის მოწერის შეხსენება</h2>
        <p>გამარჯობა ${hostName},</p>
        <p>შეგახსენებთ, რომ თქვენი კოტეჯი <strong>"${app.title}"</strong> დამტკიცებულია, მაგრამ ხელშეკრულება ჯერ არ არის ხელმოწერილი.</p>
        <p>გთხოვთ, გადმოგვიგზავნოთ ხელმოწერილი ხელშეკრულება რაც შეიძლება მალე.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
          <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb;width:40%">კოტეჯი</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${app.title}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">მდებარეობა</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${app.location}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">სტატუსი</td><td style="padding:10px 14px;border:1px solid #e5e7eb;color:#38a169;font-weight:600">დამტკიცებულია</td></tr>
        </table>
        <p style="color:#555;font-size:14px">კითხვების შემთხვევაში დაგვიკავშირდით: <a href="mailto:${COMPANY_EMAIL}" style="color:#e53e3e">${COMPANY_EMAIL}</a></p>
        <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">&#xa9; 2024 RentCottage.Ge</p>
      </div>
    </div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { action, applicationId, rejectionNote } = body as {
    action?: string;
    applicationId?: string;
    rejectionNote?: string;
  };

  if (!action) {
    return new Response(
      JSON.stringify({ error: 'Missing action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── Admin authorization ───────────────────────────────────────────────────
  // Every action in this function is privileged (PII dumps, approve/reject/
  // delete, sending host emails). Require the server-side admin secret — the
  // same gate as admin-user-management; it is never shipped in the client bundle.
  const ADMIN_PASSWORD = Deno.env.get('ADMIN_PANEL_PASSWORD') ?? '';
  const provided = (body.adminPassword as string | undefined) ?? req.headers.get('x-admin-password') ?? '';
  const timingSafeEqual = (a: string, b: string): boolean => {
    if (a.length !== b.length || a.length === 0) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  };
  if (!(ADMIN_PASSWORD.length > 0 && timingSafeEqual(provided, ADMIN_PASSWORD))) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── Fetch bookings (admin) ────────────────────────────────────────────────
  // The bookings table is RLS-locked to its owner/host/corporate; admins have no
  // Supabase session (password-gated), so they read through this service-role path.
  if (action === 'fetch-bookings') {
    const scope = (body.scope as string | undefined) ?? 'all';
    let q = supabase.from('bookings').select('*');
    if (scope === 'completed') {
      const today = new Date().toISOString().split('T')[0];
      q = q.eq('status', 'confirmed').lte('check_out', today).order('check_out', { ascending: false });
    } else if (scope === 'date-changes') {
      q = q.not('date_change_status', 'is', null).order('date_change_requested_at', { ascending: false });
    } else {
      q = q.order('created_at', { ascending: false });
    }
    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ bookings: data ?? [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Experience bookings (admin) — RLS-locked table; gated reads/writes ─────
  if (action === 'fetch-experience-bookings') {
    const { data, error } = await supabase.from('experience_bookings').select('*').order('created_at', { ascending: false });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ bookings: data ?? [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (action === 'experience-bookings-pending-count') {
    const { count } = await supabase.from('experience_bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    return new Response(JSON.stringify({ count: count ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (action === 'update-experience-booking-status') {
    const id = body.experienceBookingId as string | undefined;
    const status = body.experienceStatus as string | undefined;
    if (!id || !status) return new Response(JSON.stringify({ error: 'Missing id/status' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { error } = await supabase.from('experience_bookings').update({ status }).eq('id', id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ── Experiences content (admin) — table public-read, writes gated ──────────
  if (action === 'save-experience') {
    const payload = body.experience as Record<string, unknown> | undefined;
    const id = body.experienceId as string | undefined;
    if (!payload) return new Response(JSON.stringify({ error: 'Missing experience payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { error } = id
      ? await supabase.from('experiences').update(payload).eq('id', id)
      : await supabase.from('experiences').insert(payload);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (action === 'delete-experience') {
    const id = body.experienceId as string | undefined;
    if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { error } = await supabase.from('experiences').delete().eq('id', id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ── Promos (admin) — table public-read, writes gated (same lockdown) ───────
  if (action === 'fetch-promos') {
    const { data, error } = await supabase.from('promos').select('*').order('created_at', { ascending: false });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ promos: data ?? [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (action === 'save-promo') {
    const payload = body.promo as Record<string, unknown> | undefined;
    const id = body.promoId as string | undefined;
    if (!payload) return new Response(JSON.stringify({ error: 'Missing promo payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const pct = Number(payload.discount_percent);
    if (!isFinite(pct) || pct <= 0 || pct > 90) {
      return new Response(JSON.stringify({ error: 'discount_percent must be between 1 and 90' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!String(payload.title ?? '').trim() || !String(payload.location ?? '').trim()) {
      return new Response(JSON.stringify({ error: 'title and location are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { error } = id
      ? await supabase.from('promos').update(payload).eq('id', id)
      : await supabase.from('promos').insert(payload);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (action === 'delete-promo') {
    const id = body.promoId as string | undefined;
    if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { error } = await supabase.from('promos').delete().eq('id', id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ── Fetch all applications ────────────────────────────────────────────────
  if (action === 'fetch-all') {
    const { data, error: fetchErr } = await supabase
      .from('property_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchErr) {
      console.error('[fetch-all] Error:', fetchErr);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch applications' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, applications: data ?? [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── Update Agreement Status ───────────────────────────────────────────────
  if (action === 'update-agreement-status') {
    const { agreementStatus } = body as { agreementStatus?: string };

    if (!applicationId || !agreementStatus) {
      return new Response(
        JSON.stringify({ error: 'Missing applicationId or agreementStatus' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validStatuses = ['not_sent', 'pending', 'received'];
    if (!validStatuses.includes(agreementStatus)) {
      return new Response(
        JSON.stringify({ error: 'Invalid agreementStatus. Must be not_sent, pending, or received.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updatePayload: Record<string, unknown> = { agreement_status: agreementStatus };
    if (agreementStatus === 'received') {
      updatePayload.agreement_received_at = new Date().toISOString();
    } else {
      updatePayload.agreement_received_at = null;
    }

    const { error: updateErr } = await supabase
      .from('property_applications')
      .update(updatePayload)
      .eq('id', applicationId);

    if (updateErr) {
      console.error('[update-agreement-status] Update error:', updateErr);
      return new Response(
        JSON.stringify({ error: 'Failed to update agreement status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        agreementStatus,
        agreementReceivedAt: agreementStatus === 'received' ? new Date().toISOString() : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── Send Agreement Reminder ───────────────────────────────────────────────
  if (action === 'send-agreement-reminder') {
    if (!applicationId) {
      return new Response(
        JSON.stringify({ error: 'Missing applicationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: app, error: fetchErr } = await supabase
      .from('property_applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();

    if (fetchErr || !app) {
      console.error('[send-agreement-reminder] Fetch error:', fetchErr);
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (app.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Agreement reminders can only be sent for approved applications' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailSubject = 'ხელშეკრულების ხელის მოწერის შეხსენება';
    const emailHtml = buildAgreementReminderEmailHtml(app as Record<string, unknown>);
    const emailSent = await sendEmail(app.host_email as string, emailSubject, emailHtml);

    if (!emailSent) {
      return new Response(
        JSON.stringify({ error: 'Failed to send reminder email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateErr } = await supabase
      .from('property_applications')
      .update({ agreement_reminder_sent_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (updateErr) {
      console.error('[send-agreement-reminder] Update error:', updateErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Agreement reminder sent successfully',
        reminderSentAt: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── Photo management (admin) ──────────────────────────────────────────────
  // Admins fix up listing photos from the Host Applications screen. Two steps:
  //   1. `create-photo-upload-url` mints a single-use signed upload URL so the
  //      browser can PUT bytes straight to Storage. The service-role key never
  //      leaves this function.
  //   2. `update-photos` writes the resulting ordered URL list back to the row.
  // Neither action touches `status` or `approved_at` — approving stays its own
  // deliberate step, because it emails the host.

  const PHOTO_BUCKET = 'property-photos';
  const PUBLIC_PREFIX =
    `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const MAX_PHOTOS = 30;

  if (action === 'create-photo-upload-url') {
    const filename = (body.filename as string | undefined) ?? '';
    if (!applicationId || !UUID_RE.test(applicationId)) {
      return new Response(
        JSON.stringify({ error: 'Missing or malformed applicationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Same sanitising rule as the public become-host form, so bucket paths stay
    // uniform. A name that sanitises away entirely still gets a usable path.
    const safeName = filename.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
    const path = `${Date.now()}-${safeName || 'photo.webp'}`;

    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error('[create-photo-upload-url] Error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create upload URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    return new Response(
      JSON.stringify({
        success: true,
        path,
        token: data.token,
        signedUrl: data.signedUrl,
        publicUrl: pub.publicUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (action === 'update-photos') {
    if (!applicationId || !UUID_RE.test(applicationId)) {
      return new Response(
        JSON.stringify({ error: 'Missing or malformed applicationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawUrls = body.photoUrls;
    if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'photoUrls must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (rawUrls.length > MAX_PHOTOS) {
      return new Response(
        JSON.stringify({ error: `At most ${MAX_PHOTOS} photos are allowed` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Every URL must live in our own public bucket. Without this the admin
    // password would be enough to point a listing at arbitrary third-party
    // content (or a tracking pixel).
    const photoUrls: string[] = [];
    for (const u of rawUrls) {
      if (typeof u !== 'string' || !u.startsWith(PUBLIC_PREFIX)) {
        return new Response(
          JSON.stringify({ error: 'Every photo URL must be in the property-photos bucket' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!photoUrls.includes(u)) photoUrls.push(u); // order-preserving dedupe
    }

    const coverRaw = body.coverPhotoUrl as string | undefined;
    const cover = coverRaw ?? photoUrls[0];
    if (!photoUrls.includes(cover)) {
      return new Response(
        JSON.stringify({ error: 'coverPhotoUrl must be one of photoUrls' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const posRaw = body.coverPhotoPosition as string | undefined;
    if (posRaw !== undefined && !['top', 'center', 'bottom'].includes(posRaw)) {
      return new Response(
        JSON.stringify({ error: 'coverPhotoPosition must be top, center or bottom' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existing, error: findErr } = await supabase
      .from('property_applications')
      .select('id, photo_urls, cover_photo_url, cover_photo_position')
      .eq('id', applicationId)
      .maybeSingle();

    if (findErr || !existing) {
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updatePayload: Record<string, unknown> = {
      photo_urls: photoUrls,
      cover_photo_url: cover,
    };
    if (posRaw !== undefined) updatePayload.cover_photo_position = posRaw;

    const { error: updErr } = await supabase
      .from('property_applications')
      .update(updatePayload)
      .eq('id', applicationId);

    if (updErr) {
      console.error('[update-photos] Update error:', updErr);
      return new Response(
        JSON.stringify({ error: 'Failed to update photos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        before: {
          photo_urls: existing.photo_urls,
          cover_photo_url: existing.cover_photo_url,
          cover_photo_position: existing.cover_photo_position,
        },
        after: {
          photo_urls: photoUrls,
          cover_photo_url: cover,
          cover_photo_position: posRaw ?? existing.cover_photo_position,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── Hide a property ───────────────────────────────────────────────────────
  if (action === 'hide') {
    if (!applicationId) {
      return new Response(
        JSON.stringify({ error: 'Missing applicationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateErr } = await supabase
      .from('property_applications')
      .update({ status: 'hidden' })
      .eq('id', applicationId);

    if (updateErr) {
      console.error('[hide] Update error:', updateErr);
      return new Response(
        JSON.stringify({ error: 'Failed to hide property' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, status: 'hidden' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── Unhide / re-publish a property ───────────────────────────────────────
  if (action === 'unhide') {
    if (!applicationId) {
      return new Response(
        JSON.stringify({ error: 'Missing applicationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateErr } = await supabase
      .from('property_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId);

    if (updateErr) {
      console.error('[unhide] Update error:', updateErr);
      return new Response(
        JSON.stringify({ error: 'Failed to publish property' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, status: 'approved' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── Permanently delete a property ────────────────────────────────────────
  if (action === 'delete') {
    if (!applicationId) {
      return new Response(
        JSON.stringify({ error: 'Missing applicationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('blocked_dates').delete().eq('property_id', applicationId);
    await supabase.from('reviews').delete().eq('property_id', applicationId);

    const { error: deleteErr } = await supabase
      .from('property_applications')
      .delete()
      .eq('id', applicationId);

    if (deleteErr) {
      console.error('[delete] Delete error:', deleteErr);
      return new Response(
        JSON.stringify({ error: 'Failed to delete property' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, deleted: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── Approve or Reject ─────────────────────────────────────────────────────
  if (action !== 'approve' && action !== 'reject') {
    return new Response(
      JSON.stringify({ error: 'Invalid action.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!applicationId) {
    return new Response(
      JSON.stringify({ error: 'Missing applicationId' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: app, error: fetchErr } = await supabase
    .from('property_applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle();

  if (fetchErr || !app) {
    console.error('[admin-host-actions] Fetch error:', fetchErr);
    return new Response(
      JSON.stringify({ error: 'Application not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (action === 'reject') {
    updatePayload.rejection_note = rejectionNote && rejectionNote.trim().length > 0
      ? rejectionNote.trim()
      : null;
  }
  // Stamp the first approval time only (preserve it across any later re-approve).
  if (action === 'approve' && !app.approved_at) {
    updatePayload.approved_at = new Date().toISOString();
  }

  const { error: updateErr } = await supabase
    .from('property_applications')
    .update(updatePayload)
    .eq('id', applicationId);

  if (updateErr) {
    console.error('[admin-host-actions] Update error:', updateErr);
    return new Response(
      JSON.stringify({ error: 'Failed to update application status' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const isApproved = action === 'approve';
  const emailSubject = isApproved
    ? `Your cottage "${app.title}" has been approved!`
    : `Update on your cottage application: "${app.title}"`;
  const emailHtml = isApproved
    ? buildApprovalEmailHtml(app as Record<string, unknown>)
    : buildRejectionEmailHtml(app as Record<string, unknown>, rejectionNote);

  const emailSent = await sendEmail(app.host_email as string, emailSubject, emailHtml);

  return new Response(
    JSON.stringify({ success: true, status: newStatus, emailSent }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
