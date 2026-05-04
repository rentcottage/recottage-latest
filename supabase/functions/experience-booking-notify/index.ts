// Sends a "new experience booking" notification email to the company inbox.
// Called fire-and-forget from the public booking form right after the row is
// inserted into experience_bookings. Failure to send the email does not
// invalidate the booking — it just means we missed the heads-up.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const COMPANY_EMAIL = 'info.rentcottage@gmail.com';
const FROM_EMAIL = 'noreply@rentcottage.ge';
const SITE_URL = 'https://rentcottage.ge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface NotifyPayload {
  experienceTitle?: string;
  experienceId?: string | null;
  experienceType?: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone: string;
  preferredDate: string;
  preferredTime?: string | null;
  guests: number;
  message?: string | null;
  bookingId?: string;
}

const escape = (s: string | null | undefined) =>
  s == null
    ? ''
    : String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

function buildHtml(p: NotifyPayload): string {
  const rows: [string, string][] = [
    ['Experience', escape(p.experienceTitle || p.experienceType || '—')],
    ['Customer', escape(p.customerName)],
    ['Phone', escape(p.customerPhone)],
    ['Email', escape(p.customerEmail) || '—'],
    ['Preferred date', escape(p.preferredDate)],
    ['Preferred time', escape(p.preferredTime) || 'Any time'],
    ['Guests', String(p.guests)],
  ];
  if (p.message) rows.push(['Message', escape(p.message)]);
  if (p.bookingId) rows.push(['Booking ID', escape(p.bookingId)]);

  const tableRows = rows
    .map(
      ([label, value], i) =>
        `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb;color:#374151;width:38%">${label}</td><td style="padding:10px 14px;border:1px solid #e5e7eb;color:#111">${value}</td></tr>`,
    )
    .join('');

  return `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#111">
    <div style="background:#e53e3e;padding:24px 32px;border-radius:12px 12px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">RentCottage.Ge</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 12px 12px">
      <h2 style="margin-top:0;color:#111">New experience booking request</h2>
      <p style="color:#374151;margin:0 0 16px 0">Someone just booked an experience on RentCottage.Ge. Contact them within 24 hours to confirm.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">${tableRows}</table>
      <p style="color:#6b7280;font-size:13px;margin:0">Manage in the <a href="${SITE_URL}/admin" style="color:#e53e3e">admin panel</a>.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px;margin:0">© 2025 RentCottage.Ge</p>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!payload.customerName || !payload.customerPhone || !payload.preferredDate) {
    return new Response(
      JSON.stringify({ error: 'Missing required booking fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const subject = `New experience booking — ${payload.experienceTitle || 'Experience'}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: COMPANY_EMAIL,
      subject,
      html: buildHtml(payload),
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    console.error('[experience-booking-notify] Resend failed:', res.status, detail);
    return new Response(
      JSON.stringify({ error: 'Failed to send email', detail }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
