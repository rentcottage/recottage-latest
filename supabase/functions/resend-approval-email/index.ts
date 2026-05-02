
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = 're_CZyr35EQ_Hu4oARihEKkNBC3s162dDtQv';
const COMPANY_EMAIL = 'info.rentcottage@gmail.com';
const FROM_EMAIL = 'noreply@rentcottage.ge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let applicationId: string | null = null;

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      applicationId = body.applicationId ?? null;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    // GET fallback: read from URL query param
    const url = new URL(req.url);
    applicationId = url.searchParams.get('applicationId');
  }

  if (!applicationId) {
    return new Response(JSON.stringify({ error: 'applicationId is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: app, error } = await supabase
    .from('property_applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle();

  if (error || !app) {
    return new Response(JSON.stringify({ error: 'Application not found', detail: error }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const subject = `Your cottage "${app.title}" has been approved!`;
  const html = buildApprovalEmailHtml(app as Record<string, unknown>);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: app.host_email, subject, html }),
  });

  const result = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Failed to send email', detail: result }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    sent_to: app.host_email,
    property: app.title,
    resend_id: result.id,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
