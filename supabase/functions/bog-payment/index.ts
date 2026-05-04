import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── BOG API constants ────────────────────────────────────────────────────
const BOG_AUTH_URL = 'https://account.bog.ge/auth/realms/bog/protocol/openid-connect/token';
const BOG_ORDERS_URL = 'https://api.bog.ge/payments/v1/ecommerce/orders';
const SITE_URL = 'https://rentcottage.ge';
const COMPANY_EMAIL = 'info.rentcottage@gmail.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = 'bookings@rentcottage.ge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// ═══════════════════════════════════════════════════════════════════════════════
// HOST EMAIL PRIVACY POLICY — PERMANENT RULE — DO NOT MODIFY WITHOUT EXPLICIT REQUEST
//
// Hosts MUST NOT receive customer personal details in any email notification.
// All host-facing emails are in Georgian.
// Admin emails (to COMPANY_EMAIL) remain in English with full details.
// ═══════════════════════════════════════════════════════════════════════════════

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function jsonErr(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function readBogCredentials(): { clientId: string; secretKey: string; missingVars: string[] } {
  const sanitize = (v: string) => v.replace(/[\r\n\t]/g, '').trim();
  const clientId  = sanitize(Deno.env.get('Test Public Key')  ?? '');
  const secretKey = sanitize(Deno.env.get('Test Secret Key') ?? '');
  console.log(`[credentials] client_id   present=${clientId.length > 0}  len=${clientId.length}`);
  console.log(`[credentials] client_secret present=${secretKey.length > 0} len=${secretKey.length}`);
  if (clientId.length > 4) {
    console.log(`[credentials] client_id preview: ${clientId.slice(0, 4)}...${clientId.slice(-2)}`);
  }
  const missingVars: string[] = [];
  if (!clientId)  missingVars.push('"Test Public Key" is missing or empty in Supabase secrets');
  if (!secretKey) missingVars.push('"Test Secret Key" is missing or empty in Supabase secrets');
  return { clientId, secretKey, missingVars };
}

async function getBogToken(): Promise<{ token: string | null; errorDetail: string }> {
  const { clientId, secretKey, missingVars } = readBogCredentials();
  if (missingVars.length > 0) {
    const msg = `BOG credentials missing: ${missingVars.join(' | ')}. Go to Supabase → Settings → Edge Functions → Secrets and save both "Test Public Key" and "Test Secret Key" with those exact names.`;
    console.error('[getBogToken]', msg);
    return { token: null, errorDetail: msg };
  }
  console.log(`[getBogToken] Requesting token → ${BOG_AUTH_URL}`);
  const formBody = new URLSearchParams();
  formBody.set('grant_type',   'client_credentials');
  formBody.set('client_id',    clientId);
  formBody.set('client_secret', secretKey);
  try {
    const res = await fetch(BOG_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });
    const responseText = await res.text();
    console.log(`[getBogToken] HTTP ${res.status}`);
    if (!res.ok) {
      const detail = `BOG auth failed HTTP ${res.status}: ${responseText} | endpoint=${BOG_AUTH_URL} | client_id_len=${clientId.length} client_secret_len=${secretKey.length}`;
      console.error('[getBogToken]', detail);
      return { token: null, errorDetail: detail };
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      return { token: null, errorDetail: `BOG auth HTTP OK but response not valid JSON: ${responseText}` };
    }
    if (data.access_token) {
      console.log('[getBogToken] ✅ Token obtained successfully');
      return { token: String(data.access_token), errorDetail: '' };
    }
    return { token: null, errorDetail: `BOG auth HTTP OK but no access_token field in response: ${responseText}` };
  } catch (e) {
    return { token: null, errorDetail: `BOG auth network exception: ${String(e)}` };
  }
}

interface BogOrderResult {
  id: string;
  _links?: { redirect?: { href?: string } };
}
interface BogOrderCreateResult { order: BogOrderResult | null; errorDetail: string; }

async function createBogOrder(
  token: string,
  shopOrderId: string,
  totalAmount: number,
  callbackUrl: string,
  successUrl: string,
  failUrl: string,
): Promise<BogOrderCreateResult> {
  const payload = {
    callback_url: callbackUrl,
    shop_order_id: shopOrderId,
    redirect_urls: { success: successUrl, fail: failUrl },
    purchase_units: [{ amount: { currency_code: 'GEL', value: totalAmount.toFixed(2) } }],
    locale: 'en-US',
  };
  try {
    const res = await fetch(BOG_ORDERS_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const responseText = await res.text();
    if (!res.ok) return { order: null, errorDetail: `BOG order creation failed: HTTP ${res.status} — ${responseText}` };
    return { order: JSON.parse(responseText) as BogOrderResult, errorDetail: '' };
  } catch (e) {
    return { order: null, errorDetail: `BOG order creation exception: ${String(e)}` };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getBogOrderDetails(token: string, bogOrderId: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${BOG_ORDERS_URL}/${bogOrderId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
  } catch (e) {
    console.error('[sendEmail] Exception:', e);
  }
}

function emailWrapper(content: string) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:580px;margin:0 auto;color:#111"><div style="background:#e53e3e;padding:28px 36px;border-radius:12px 12px 0 0"><h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px">RentCottage.Ge</h1></div><div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:36px;border-radius:0 0 12px 12px">${content}<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0"><p style="color:#9ca3af;font-size:12px;margin:0">© 2025 RentCottage.Ge · rentcottage.ge</p></div></div>`;
}

function bookingTable(rows: [string, string][]) {
  return `<table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">${rows.map(([label, value], i) => `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}"><td style="padding:12px 16px;font-weight:600;border:1px solid #e5e7eb;color:#374151;width:38%">${label}</td><td style="padding:12px 16px;border:1px solid #e5e7eb;color:#111">${value}</td></tr>`).join('')}</table>`;
}

function mapBogPaymentStatus(bogStatus: string): { paymentStatus: string; defaultBookingStatus: string } {
  switch (bogStatus?.toLowerCase()) {
    case 'completed':
      return { paymentStatus: 'paid', defaultBookingStatus: 'pending_host_approval' };
    case 'rejected':
    case 'failed':
    case 'error':
      return { paymentStatus: 'payment_failed', defaultBookingStatus: 'payment_failed' };
    case 'cancelled':
    case 'canceled':
    case 'abandoned':
    case 'expired':
      return { paymentStatus: 'canceled', defaultBookingStatus: 'payment_failed' };
    case 'refunded':
      return { paymentStatus: 'refunded', defaultBookingStatus: 'cancelled' };
    default:
      return { paymentStatus: 'pending_payment', defaultBookingStatus: 'pending_payment' };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logEvent(supabase: any, bookingId: string, eventType: string, fromStatus: string | null, toStatus: string, changedBy: string, note?: string) {
  try {
    await supabase.from('booking_status_logs').insert({
      booking_id: bookingId,
      event_type: eventType,
      from_status: fromStatus ?? null,
      to_status: toStatus,
      changed_by: changedBy,
      note: note ?? null,
    });
  } catch (_e) { /* non-fatal */ }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAutoConfirmCustomerPayAtPropertyHtml(booking: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#16a34a;margin-top:0">Booking Confirmed! 🎉</h2>
    <p style="color:#374151;line-height:1.6">Hi <strong>${booking.user_name ?? 'there'}</strong>,</p>
    <p style="color:#374151;line-height:1.6">Great news — your booking for <strong>${booking.property_title}</strong> has been <strong>automatically confirmed</strong>! No further approval is needed. We look forward to your stay.</p>
    ${bookingTable([
      ['Booking ID', String(booking.id)],
      ['Cottage', String(booking.property_title)],
      ['Location', String(booking.property_location ?? '—')],
      ['Check-in', String(booking.check_in)],
      ['Check-out', String(booking.check_out)],
      ['Guests', String(booking.guests)],
      ['Total Price', '₾' + String(booking.total_price)],
      ['Payment Method', 'Pay at Property (on arrival)'],
      ['Booking Status', 'Confirmed ✅'],
    ])}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#166534;">
      <strong>Payment:</strong> You will pay when you arrive at the property. No upfront payment required.
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE_URL}/profile" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">View My Bookings</a>
    </div>`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAutoConfirmHostPayAtPropertyHtml(booking: Record<string, any>, hostFirstName: string): string {
  return emailWrapper(`
    <h2 style="color:#16a34a;margin-top:0">ახალი ჯავშანი ავტომატურად დადასტურდა ✅</h2>
    <p style="color:#374151;line-height:1.6">გამარჯობა <strong>${hostFirstName}</strong>,</p>
    <p style="color:#374151;line-height:1.6">თქვენი ობიექტის <strong>${booking.property_title}</strong> ახალი ჯავშანი <strong>ავტომატურად დადასტურდა</strong>.</p>
    ${bookingTable([
      ['ჯავშნის ID', String(booking.id)],
      ['კოტეჯი', String(booking.property_title)],
      ['ჩასვლის თარიღი', String(booking.check_in)],
      ['გასვლის თარიღი', String(booking.check_out)],
      ['სტუმრების რაოდენობა', String(booking.guests)],
      ['ჯამური ფასი', '₾' + String(booking.total_price)],
      ['გადახდის მეთოდი', 'ადგილზე გადახდა (ჩასვლისას)'],
      ['ჯავშნის სტატუსი', 'დადასტურებულია ✅'],
    ])}
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE_URL}/host-dashboard" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">ჰოსტის პანელში ნახვა</a>
    </div>`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAutoConfirmCustomerBogHtml(booking: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#16a34a;margin-top:0">Payment Successful — Booking Confirmed! 🎉</h2>
    <p style="color:#374151;line-height:1.6">Hi <strong>${booking.user_name ?? 'there'}</strong>,</p>
    <p style="color:#374151;line-height:1.6">Your payment was <strong>successful</strong> and your booking has been <strong>automatically confirmed</strong>!</p>
    ${bookingTable([
      ['Booking ID', String(booking.id)],
      ['Cottage', String(booking.property_title)],
      ['Location', String(booking.property_location ?? '—')],
      ['Check-in', String(booking.check_in)],
      ['Check-out', String(booking.check_out)],
      ['Guests', String(booking.guests)],
      ['Total Price', '₾' + String(booking.total_price)],
      ['Payment Method', 'Pay Now (Bank of Georgia)'],
      ['Payment Status', 'Paid ✅'],
      ['Booking Status', 'Confirmed ✅'],
    ])}
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE_URL}/profile" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">View My Bookings</a>
    </div>`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAutoConfirmHostBogHtml(booking: Record<string, any>, hostFirstName: string): string {
  return emailWrapper(`
    <h2 style="color:#16a34a;margin-top:0">ახალი გადახდილი ჯავშანი ავტომატურად დადასტურდა ✅</h2>
    <p style="color:#374151;line-height:1.6">გამარჯობა <strong>${hostFirstName}</strong>,</p>
    <p style="color:#374151;line-height:1.6">თქვენი ობიექტის <strong>${booking.property_title}</strong> ახალი <strong>გადახდილი ჯავშანი</strong> <strong>ავტომატურად დადასტურდა</strong>.</p>
    ${bookingTable([
      ['ჯავშნის ID', String(booking.id)],
      ['კოტეჯი', String(booking.property_title)],
      ['ჩასვლის თარიღი', String(booking.check_in)],
      ['გასვლის თარიღი', String(booking.check_out)],
      ['სტუმრების რაოდენობა', String(booking.guests)],
      ['ჯამური ფასი', '₾' + String(booking.total_price)],
      ['გადახდის მეთოდი', 'ონლაინ გადახდა (საქართველოს ბანკი)'],
      ['გადახდის სტატუსი', 'გადახდილია ✅'],
      ['ჯავშნის სტატუსი', 'დადასტურებულია ✅'],
    ])}
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE_URL}/host-dashboard" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">ჰოსტის პანელში ნახვა</a>
    </div>`);
}

// ── Main handler ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const url    = new URL(req.url);
  const action = url.searchParams.get('action');

  // ── ACTION: debug-credentials ────────────────────────────────────────────
  if (req.method === 'GET' && action === 'debug-credentials') {
    const { clientId, secretKey } = readBogCredentials();
    let allEnvNames: string[] = [];
    try { allEnvNames = Object.keys(Deno.env.toObject()).sort(); } catch { /* ignore */ }
    const bogRelated = allEnvNames.filter(n =>
      n.toUpperCase().includes('BOG') ||
      n.toUpperCase().includes('TEST') ||
      n.toUpperCase().includes('PUBLIC') ||
      n.toUpperCase().includes('SECRET'),
    );
    const { token, errorDetail: authError } = await getBogToken();
    return jsonOk({
      credentials: {
        'Test Public Key present': clientId.length > 0,
        'Test Public Key length':  clientId.length,
        'Test Secret Key present': secretKey.length > 0,
        'Test Secret Key length':  secretKey.length,
        bothPresent: clientId.length > 0 && secretKey.length > 0,
      },
      authTest: { success: !!token, tokenReceived: !!token, error: token ? null : authError },
      authEndpoint: BOG_AUTH_URL,
      relevantEnvVarNames: bogRelated,
      totalEnvVarCount: allEnvNames.length,
    });
  }

  // ── ACTION: mark-failed ───────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'mark-failed') {
    const bookingId = url.searchParams.get('booking_id');
    if (!bookingId) return jsonErr('Missing booking_id');
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, payment_status, payment_transaction_id, payment_method')
      .eq('id', bookingId)
      .maybeSingle();
    if (!booking) return jsonErr('Booking not found', 404);

    // pay_at_property bookings never go through BOG — skip BOG check
    if (booking.payment_method === 'pay_at_property') {
      return jsonOk({ bookingId, updated: false, paymentStatus: booking.payment_status, bookingStatus: booking.status, skipped: 'pay_at_property' });
    }

    if (booking.payment_status === 'pending_payment') {
      let finalPaymentStatus = 'payment_failed';
      let finalBookingStatus = 'payment_failed';
      if (booking.payment_transaction_id) {
        const { token } = await getBogToken();
        if (token) {
          const orderDetails = await getBogOrderDetails(token, String(booking.payment_transaction_id));
          if (orderDetails) {
            const bogStatus = String(orderDetails.status ?? orderDetails.order_status ?? '');
            const mapped = mapBogPaymentStatus(bogStatus);
            if (mapped.paymentStatus === 'paid') {
              return jsonOk({ bookingId, updated: false, actualStatus: 'paid', message: 'Payment is actually successful — redirect to success page' });
            }
            if (mapped.paymentStatus !== 'pending_payment') {
              finalPaymentStatus = mapped.paymentStatus;
              finalBookingStatus = mapped.defaultBookingStatus;
            }
          }
        }
      }
      await supabase.from('bookings').update({ payment_status: finalPaymentStatus, status: finalBookingStatus }).eq('id', bookingId);
      await logEvent(supabase, bookingId, 'mark_failed_redirect', String(booking.status), finalBookingStatus, 'system', `User redirected to fail URL. payment_status set to: ${finalPaymentStatus}`);
      return jsonOk({ bookingId, updated: true, paymentStatus: finalPaymentStatus, bookingStatus: finalBookingStatus });
    }
    return jsonOk({ bookingId, updated: false, paymentStatus: booking.payment_status, bookingStatus: booking.status });
  }

  // ── ACTION: create-order ──────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'create-order') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return jsonErr('Invalid JSON body'); }

    // ── Step 1: Verify hCaptcha token ─────────────────────────────────────
    const captchaToken = body.captcha_token as string | undefined;
    if (!captchaToken) {
      return jsonErr('CAPTCHA token is required.', 400);
    }
    const captchaValid = await verifyHCaptcha(captchaToken);
    if (!captchaValid) {
      return jsonErr('CAPTCHA verification failed. Please refresh the page and try again.', 403);
    }

    const {
      user_email, user_name, customer_id, property_id, property_title,
      property_location, check_in, check_out, guests, price_per_night,
      total_price, payment_method,
    } = body as Record<string, unknown>;

    if (!user_email)     return jsonErr('Missing required field: user_email');
    if (!property_title) return jsonErr('Missing required field: property_title');
    if (!check_in)       return jsonErr('Missing required field: check_in');
    if (!check_out)      return jsonErr('Missing required field: check_out');
    if (!total_price)    return jsonErr('Missing required field: total_price');

    const totalAmount = Number(total_price);
    if (isNaN(totalAmount) || totalAmount <= 0) return jsonErr(`Invalid total_price value: ${total_price}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate  = new Date(String(check_in)  + 'T00:00:00');
    const checkOutDate = new Date(String(check_out) + 'T00:00:00');
    if (checkInDate < today)          return jsonErr('Check-in date cannot be in the past. Please select today or a future date.');
    if (checkOutDate <= checkInDate)  return jsonErr('Check-out date must be after check-in date.');

    const chosenMethod = String(payment_method ?? 'pay_now');

    // ── PAY AT PROPERTY ───────────────────────────────────────────────────
    if (chosenMethod === 'pay_at_property') {
      let approvalMode   = 'manual_24h';
      let hostFirstName  = 'ჰოსტო';
      let hostEmail: string | null = null;

      if (property_id) {
        const { data: propData } = await supabase
          .from('property_applications')
          .select('booking_approval_mode, host_email, host_first_name')
          .eq('id', String(property_id))
          .maybeSingle();
        if (propData) {
          approvalMode  = propData.booking_approval_mode ?? 'manual_24h';
          hostFirstName = propData.host_first_name ?? 'ჰოსტო';
          hostEmail     = propData.host_email ?? null;
        }
      }

      const isAutoConfirm      = approvalMode === 'auto_confirm';
      const initialBookingStatus = isAutoConfirm ? 'confirmed' : 'pending_host_approval';
      const approvalDeadline   = !isAutoConfirm ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

      const { data: booking, error: dbError } = await supabase
        .from('bookings')
        .insert({
          user_email, user_name: user_name ?? null, customer_id: customer_id ?? null,
          property_id: property_id ?? null, property_title,
          property_location: property_location ?? null, check_in, check_out,
          guests: Number(guests) || 1,
          price_per_night: Number(price_per_night) || null,
          total_price: totalAmount,
          status: initialBookingStatus,
          payment_status: 'pending_on_arrival',
          payment_method: 'pay_at_property',
          approval_deadline: approvalDeadline,
        })
        .select().maybeSingle();

      if (dbError || !booking) {
        return jsonErr(`Failed to create booking record. ${dbError?.message ?? 'Unknown DB error'}`, 500);
      }

      await logEvent(supabase, booking.id, 'created', null, initialBookingStatus, 'system',
        isAutoConfirm ? 'Pay at property — auto confirmed' : 'Pay at property — awaiting host approval');

      if (isAutoConfirm) {
        await sendEmail(String(user_email), `Booking Confirmed – ${property_title}`, buildAutoConfirmCustomerPayAtPropertyHtml(booking));
        const adminHtml = emailWrapper(`<h2 style="color:#16a34a;margin-top:0">New Booking Auto-Confirmed (Pay at Property) ✅</h2>${bookingTable([['Booking ID', String(booking.id)], ['Customer Name', String(user_name ?? '—')], ['Customer Email', String(user_email)], ['Cottage', String(property_title)], ['Check-in', String(check_in)], ['Check-out', String(check_out)], ['Guests', String(guests)], ['Total Price', '₾' + String(totalAmount)], ['Payment Method', 'Pay at Property'], ['Mode', 'Auto Confirm'], ['Status', 'Confirmed ✅']])}`);
        await sendEmail(COMPANY_EMAIL, `New Auto-Confirmed Booking (Pay at Property): ${property_title}`, adminHtml);
        if (hostEmail && hostEmail !== COMPANY_EMAIL) {
          await sendEmail(hostEmail, `ახალი ჯავშანი ავტომატურად დადასტურდა – ${property_title}`, buildAutoConfirmHostPayAtPropertyHtml(booking, hostFirstName));
        }
      } else {
        const adminHtml = emailWrapper(`<h2 style="color:#d97706;margin-top:0">New Booking Request (Pay at Property) 🏡</h2>${bookingTable([['Booking ID', String(booking.id)], ['Customer Name', String(user_name ?? '—')], ['Customer Email', String(user_email)], ['Cottage', String(property_title)], ['Location', String(property_location ?? '—')], ['Check-in', String(check_in)], ['Check-out', String(check_out)], ['Guests', String(guests)], ['Total Price', '₾' + String(totalAmount)], ['Payment Method', 'Pay at Property (on arrival)'], ['Booking Status', 'Pending Host Approval ⏳'], ['Approval Deadline', approvalDeadline ?? '—']])}`);
        await sendEmail(COMPANY_EMAIL, `New Booking Request (Pay at Property): ${property_title}`, adminHtml);
        const customerHtml = emailWrapper(`<h2 style="color:#d97706;margin-top:0">Booking Request Received! ✅</h2><p style="color:#374151;line-height:1.6">Hi <strong>${user_name ?? 'there'}</strong>,</p><p style="color:#374151;line-height:1.6">Your booking request has been <strong>successfully received</strong> and is now awaiting host approval. The host has <strong>24 hours</strong> to review your request.</p>${bookingTable([['Booking ID', String(booking.id)], ['Cottage', String(property_title)], ['Location', String(property_location ?? '—')], ['Check-in', String(check_in)], ['Check-out', String(check_out)], ['Guests', String(guests)], ['Total Price', '₾' + String(totalAmount)], ['Payment Method', 'Pay at Property (on arrival)'], ['Booking Status', 'Awaiting Host Approval ⏳']])}<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#92400e;"><strong>What happens next?</strong> The host will review your request within 24 hours. Once approved, you will receive a confirmation email. Payment will be collected when you arrive at the property.</div><div style="text-align:center;margin:24px 0"><a href="${SITE_URL}/profile" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">View My Bookings</a></div>`);
        await sendEmail(String(user_email), `Booking Request Received – ${property_title}`, customerHtml);
        if (hostEmail && hostEmail !== COMPANY_EMAIL) {
          const hostHtml = emailWrapper(`<h2 style="color:#d97706;margin-top:0">ახალი ჯავშნის მოთხოვნა — საჭიროა მოქმედება 🏡</h2><p style="color:#374151;line-height:1.6">გამარჯობა <strong>${hostFirstName}</strong>,</p><p style="color:#374151;line-height:1.6">თქვენ გაქვთ <strong>ახალი ჯავშნის მოთხოვნა</strong> ობიექტისთვის <strong>${property_title}</strong>. თქვენ გაქვთ <strong>24 საათი</strong> მის დასადასტურებლად ან უარსაყოფად.</p>${bookingTable([['ჯავშნის ID', String(booking.id)], ['კოტეჯი', String(property_title)], ['ჩასვლის თარიღი', String(check_in)], ['გასვლის თარიღი', String(check_out)], ['სტუმრების რაოდენობა', String(guests)], ['ჯამური ფასი', '₾' + String(totalAmount)], ['გადახდის მეთოდი', 'ადგილზე გადახდა (ჩასვლისას)'], ['დადასტურების ბოლო ვადა', approvalDeadline ?? '—']])}<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#92400e;"><strong>საჭიროა მოქმედება:</strong> თქვენ გაქვთ 24 საათი ამ ჯავშნის დასადასტურებლად ან უარსაყოფად.</div><div style="text-align:center;margin:24px 0"><a href="${SITE_URL}/host-dashboard" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">გადადით მასპინძლის პანელში და დაადასტურეთ ან უარყავით ჯავშანი</a></div>`);
          await sendEmail(hostEmail, `ახალი ჯავშნის მოთხოვნა — საჭიროა მოქმედება (24 სთ): ${property_title}`, hostHtml);
        }
      }

      return jsonOk({ success: true, bookingId: booking.id, payAtProperty: true });
    }

    // ── PAY NOW — Bank of Georgia ─────────────────────────────────────────
    const { data: booking, error: dbError } = await supabase
      .from('bookings')
      .insert({
        user_email, user_name: user_name ?? null, customer_id: customer_id ?? null,
        property_id: property_id ?? null, property_title,
        property_location: property_location ?? null, check_in, check_out,
        guests: Number(guests) || 1,
        price_per_night: Number(price_per_night) || null,
        total_price: totalAmount,
        status: 'pending_payment',
        payment_status: 'pending_payment',
        payment_method: 'pay_now',
      })
      .select().maybeSingle();

    if (dbError || !booking) {
      return jsonErr(`Failed to create booking record. ${dbError?.message ?? 'Unknown DB error'}`, 500);
    }
    await logEvent(supabase, booking.id, 'payment_initiated', null, 'pending_payment', 'system');

    const { token, errorDetail: tokenErr } = await getBogToken();
    if (!token) {
      await supabase.from('bookings').update({ status: 'payment_failed', payment_status: 'payment_failed' }).eq('id', booking.id);
      return jsonErr(`Payment gateway authentication failed: ${tokenErr}`, 500);
    }

    const fnUrl       = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bog-payment`;
    const callbackUrl = `${fnUrl}?action=callback`;
    const successUrl  = `${SITE_URL}/payment/success?booking_id=${booking.id}`;
    const failUrl     = `${SITE_URL}/payment/failed?booking_id=${booking.id}`;

    const { order: bogOrder, errorDetail: orderErr } = await createBogOrder(
      token, booking.id, totalAmount, callbackUrl, successUrl, failUrl,
    );

    if (!bogOrder?.id) {
      await supabase.from('bookings').update({ status: 'payment_failed', payment_status: 'payment_failed' }).eq('id', booking.id);
      await logEvent(supabase, booking.id, 'payment_failed', 'pending_payment', 'payment_failed', 'system', orderErr);
      return jsonErr(`Failed to create BOG payment order: ${orderErr}`, 500);
    }

    await supabase.from('bookings').update({ payment_transaction_id: bogOrder.id }).eq('id', booking.id);
    const checkoutUrl = bogOrder._links?.redirect?.href ?? null;

    if (!checkoutUrl) {
      await supabase.from('bookings').update({ status: 'payment_failed', payment_status: 'payment_failed' }).eq('id', booking.id);
      await logEvent(supabase, booking.id, 'payment_failed', 'pending_payment', 'payment_failed', 'system', 'No checkout URL from BOG');
      return jsonErr(`BOG did not return a checkout URL. Raw: ${JSON.stringify(bogOrder)}`, 500);
    }

    return jsonOk({ checkoutUrl, bookingId: booking.id, bogOrderId: bogOrder.id });
  }

  // ── ACTION: callback ──────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'callback') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return new Response('ok', { status: 200, headers: corsHeaders }); }

    const bogOrderId      = String(body.order_id ?? body.id ?? '');
    const externalOrderId = String(body.external_order_id ?? body.shop_order_id ?? '');
    if (!bogOrderId) return new Response('ok', { status: 200, headers: corsHeaders });

    let bookingRow: Record<string, unknown> | null = null;
    if (externalOrderId) {
      const { data } = await supabase.from('bookings').select('*').eq('id', externalOrderId).maybeSingle();
      bookingRow = data;
    }
    if (!bookingRow) {
      const { data } = await supabase.from('bookings').select('*').eq('payment_transaction_id', bogOrderId).maybeSingle();
      bookingRow = data;
    }
    if (!bookingRow) return new Response('ok', { status: 200, headers: corsHeaders });

    if (['confirmed', 'cancelled', 'rejected'].includes(String(bookingRow.status))) {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // ── CRITICAL: Always verify with BOG API — never trust callback body alone ──
    const { token } = await getBogToken();
    if (!token) {
      console.error('[callback] Could not get BOG token for verification — rejecting callback');
      // Return 200 to prevent BOG retrying with same unverified data, but do NOT update booking
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const orderDetails = await getBogOrderDetails(token, bogOrderId);
    if (!orderDetails) {
      console.error(`[callback] Could not fetch BOG order details for ${bogOrderId} — rejecting`);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Use BOG API response as the only source of truth — ignore callback body status
    const bogStatus = String(orderDetails.status ?? orderDetails.order_status ?? '');
    console.log(`[callback] BOG verified status for order ${bogOrderId}: ${bogStatus}`);

    const { paymentStatus, defaultBookingStatus } = mapBogPaymentStatus(bogStatus);
    const prevStatus = String(bookingRow.status);

    if (paymentStatus !== 'paid') {
      await supabase.from('bookings').update({
        payment_status: paymentStatus,
        status: defaultBookingStatus,
        payment_transaction_id: bogOrderId,
      }).eq('id', bookingRow.id);
      await logEvent(supabase, String(bookingRow.id), `bog_callback_${paymentStatus}`, prevStatus, defaultBookingStatus, 'bog_callback', `BOG API verified status: ${bogStatus}, order: ${bogOrderId}`);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    let approvalMode    = 'manual_24h';
    let hostFirstName   = 'ჰოსტო';
    let hostEmailForProp: string | null = null;
    if (bookingRow.property_id) {
      const { data: propData } = await supabase
        .from('property_applications')
        .select('booking_approval_mode, host_email, host_first_name')
        .eq('id', String(bookingRow.property_id))
        .maybeSingle();
      if (propData) {
        approvalMode     = propData.booking_approval_mode ?? 'manual_24h';
        hostFirstName    = propData.host_first_name ?? 'ჰოსტო';
        hostEmailForProp = propData.host_email ?? null;
      }
    }

    const isAutoConfirm     = approvalMode === 'auto_confirm';
    const finalBookingStatus = isAutoConfirm ? 'confirmed' : 'pending_host_approval';
    const approvalDeadline  = !isAutoConfirm ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

    await supabase.from('bookings').update({
      payment_status: 'paid',
      status: finalBookingStatus,
      payment_transaction_id: bogOrderId,
      approval_deadline: approvalDeadline,
    }).eq('id', bookingRow.id);

    await logEvent(supabase, String(bookingRow.id),
      isAutoConfirm ? 'bog_paid_auto_confirmed' : 'bog_paid_pending_approval',
      prevStatus, finalBookingStatus, 'bog_callback',
      `BOG API verified PAID for order: ${bogOrderId}, status: ${bogStatus}, approvalMode: ${approvalMode}`);

    if (isAutoConfirm) {
      await sendEmail(String(bookingRow.user_email), `Payment Successful — Booking Confirmed! – ${bookingRow.property_title}`, buildAutoConfirmCustomerBogHtml(bookingRow));
      const adminHtml = emailWrapper(`<h2 style="color:#16a34a;margin-top:0">Paid Booking Auto-Confirmed ✅</h2>${bookingTable([['Booking ID', String(bookingRow.id)], ['Customer Name', String(bookingRow.user_name ?? '—')], ['Customer Email', String(bookingRow.user_email)], ['Cottage', String(bookingRow.property_title)], ['Check-in', String(bookingRow.check_in)], ['Check-out', String(bookingRow.check_out)], ['Guests', String(bookingRow.guests)], ['Total Price', '₾' + String(bookingRow.total_price)], ['Payment Method', 'Pay Now (Bank of Georgia)'], ['Payment Status', 'Paid ✅'], ['Booking Status', 'Confirmed ✅'], ['Mode', 'Auto Confirm']])}`);
      await sendEmail(COMPANY_EMAIL, `Paid Booking Auto-Confirmed: ${bookingRow.property_title}`, adminHtml);
      if (hostEmailForProp && hostEmailForProp !== COMPANY_EMAIL) {
        await sendEmail(hostEmailForProp, `ახალი გადახდილი ჯავშანი ავტომატურად დადასტურდა – ${bookingRow.property_title}`, buildAutoConfirmHostBogHtml(bookingRow, hostFirstName));
      }
    } else {
      const adminHtml = emailWrapper(`<h2 style="color:#d97706;margin-top:0">Payment Received — Awaiting Host Approval ⏳</h2>${bookingTable([['Booking ID', String(bookingRow.id)], ['Customer Name', String(bookingRow.user_name ?? '—')], ['Customer Email', String(bookingRow.user_email)], ['Cottage', String(bookingRow.property_title)], ['Location', String(bookingRow.property_location ?? '—')], ['Check-in', String(bookingRow.check_in)], ['Check-out', String(bookingRow.check_out)], ['Guests', String(bookingRow.guests)], ['Total Price', '₾' + String(bookingRow.total_price)], ['Payment Method', 'Pay Now (Bank of Georgia)'], ['Payment Status', 'Paid ✅'], ['Booking Status', 'Awaiting Host Approval ⏳'], ['Approval Deadline', approvalDeadline ?? '—'], ['BOG Order ID', bogOrderId]])}`);
      await sendEmail(COMPANY_EMAIL, `Payment Received (Awaiting Host Approval): ${bookingRow.property_title}`, adminHtml);
      const customerHtml = emailWrapper(`<h2 style="color:#d97706;margin-top:0">Payment Successful — Booking Request Received! ✅</h2><p style="color:#374151;line-height:1.6">Hi <strong>${bookingRow.user_name ?? 'there'}</strong>,</p><p style="color:#374151;line-height:1.6">Your payment was <strong>successful</strong> and your booking request has been <strong>received</strong>. The host has <strong>24 hours</strong> to review your request.</p>${bookingTable([['Booking ID', String(bookingRow.id)], ['Cottage', String(bookingRow.property_title)], ['Location', String(bookingRow.property_location ?? '—')], ['Check-in', String(bookingRow.check_in)], ['Check-out', String(bookingRow.check_out)], ['Guests', String(bookingRow.guests)], ['Total Price', '₾' + String(bookingRow.total_price)], ['Payment Method', 'Pay Now (Bank of Georgia)'], ['Payment Status', 'Paid ✅'], ['Booking Status', 'Awaiting Host Approval ⏳']])}<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#92400e;"><strong>What happens next?</strong> The host will review your request within 24 hours.</div><div style="text-align:center;margin:24px 0"><a href="${SITE_URL}/profile" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">View My Bookings</a></div>`);
      await sendEmail(String(bookingRow.user_email), `Booking Request Received – ${bookingRow.property_title}`, customerHtml);
      if (hostEmailForProp && hostEmailForProp !== COMPANY_EMAIL) {
        const hostHtml = emailWrapper(`<h2 style="color:#d97706;margin-top:0">ახალი გადახდილი ჯავშნის მოთხოვნა — საჭიროა მოქმედება 🏡</h2><p style="color:#374151;line-height:1.6">გამარჯობა <strong>${hostFirstName}</strong>,</p><p style="color:#374151;line-height:1.6">ახალი <strong>გადახდილი ჯავშნის მოთხოვნა</strong> ობიექტისთვის <strong>${bookingRow.property_title}</strong>. სტუმარმა უკვე გადაიხადა.</p>${bookingTable([['ჯავშნის ID', String(bookingRow.id)], ['კოტეჯი', String(bookingRow.property_title)], ['ჩასვლის თარიღი', String(bookingRow.check_in)], ['გასვლის თარიღი', String(bookingRow.check_out)], ['სტუმრების რაოდენობა', String(bookingRow.guests)], ['ჯამური ფასი', '₾' + String(bookingRow.total_price)], ['გადახდის სტატუსი', 'გადახდილია ✅'], ['დადასტურების ბოლო ვადა', approvalDeadline ?? '—']])}<div style="text-align:center;margin:24px 0"><a href="${SITE_URL}/host-dashboard" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">გადადით მასპინძლის პანელში</a></div>`);
        await sendEmail(hostEmailForProp, `გადახდილი ჯავშანი — საჭიროა მოქმედება (24 სთ): ${bookingRow.property_title}`, hostHtml);
      }
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  // ── ACTION: verify ────────────────────────────────────────────────────────
  // SECURITY: This is the authoritative endpoint for payment-success page.
  // For pay_now bookings: ALWAYS calls BOG API — never trusts DB status alone.
  // For pay_at_property bookings: DB status is the source of truth (no BOG involved).
  if (req.method === 'GET' && action === 'verify') {
    const bookingId = url.searchParams.get('booking_id');
    if (!bookingId) return jsonErr('Missing booking_id');

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id, status, payment_status, payment_transaction_id, payment_method, property_title, check_in, check_out, guests, total_price, property_location')
      .eq('id', bookingId)
      .maybeSingle();

    if (error || !booking) return jsonErr('Booking not found', 404);

    // pay_at_property — no BOG transaction, trust DB
    if (booking.payment_method === 'pay_at_property') {
      return jsonOk({
        bookingId,
        paymentStatus: booking.payment_status,
        bookingStatus: booking.status,
        verified: false,
        source: 'db_pay_at_property',
      });
    }

    // pay_now — MUST verify with BOG API regardless of current DB status
    if (!booking.payment_transaction_id) {
      // No transaction ID yet — payment was never initiated properly
      return jsonOk({
        bookingId,
        paymentStatus: 'payment_failed',
        bookingStatus: 'payment_failed',
        verified: false,
        source: 'no_transaction_id',
      });
    }

    const { token, errorDetail: tokenErr } = await getBogToken();
    if (!token) {
      console.error('[verify] Could not get BOG token:', tokenErr);
      // Cannot verify — return current DB status but flag as unverified
      return jsonOk({
        bookingId,
        paymentStatus: booking.payment_status,
        bookingStatus: booking.status,
        verified: false,
        source: 'bog_token_unavailable',
        warning: 'Could not connect to BOG to verify payment',
      });
    }

    const orderDetails = await getBogOrderDetails(token, String(booking.payment_transaction_id));
    if (!orderDetails) {
      console.error(`[verify] Could not fetch BOG order ${booking.payment_transaction_id}`);
      // Cannot verify — return current DB status but flag as unverified
      return jsonOk({
        bookingId,
        paymentStatus: booking.payment_status,
        bookingStatus: booking.status,
        verified: false,
        source: 'bog_order_unavailable',
        warning: 'Could not retrieve order from BOG',
      });
    }

    const bogStatus = String(orderDetails.status ?? orderDetails.order_status ?? '');
    console.log(`[verify] BOG live status for order ${booking.payment_transaction_id}: ${bogStatus}`);
    const { paymentStatus, defaultBookingStatus } = mapBogPaymentStatus(bogStatus);

    // If BOG says paid but DB doesn't reflect it yet — update DB proactively
    if (paymentStatus === 'paid' && booking.payment_status !== 'paid') {
      let approvalMode = 'manual_24h';
      if (booking.property_id) {
        const { data: propData } = await supabase
          .from('property_applications')
          .select('booking_approval_mode')
          .eq('id', String(booking.property_id))
          .maybeSingle();
        if (propData) approvalMode = propData.booking_approval_mode ?? 'manual_24h';
      }
      const isAutoConfirm = approvalMode === 'auto_confirm';
      const finalBookingStatus = isAutoConfirm ? 'confirmed' : 'pending_host_approval';
      const approvalDeadline = !isAutoConfirm ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

      await supabase.from('bookings').update({
        payment_status: 'paid',
        status: finalBookingStatus,
        approval_deadline: approvalDeadline,
      }).eq('id', bookingId);

      await logEvent(supabase, bookingId, 'verify_paid_sync', booking.status, finalBookingStatus, 'system',
        `verify endpoint synced: BOG status=${bogStatus}, callback was delayed`);

      return jsonOk({
        bookingId,
        paymentStatus: 'paid',
        bookingStatus: finalBookingStatus,
        verified: true,
        source: 'bog_api_live',
        bogStatus,
      });
    }

    // If status changed — sync to DB
    if (paymentStatus !== booking.payment_status && paymentStatus !== 'pending_payment') {
      await supabase.from('bookings').update({
        payment_status: paymentStatus,
        status: defaultBookingStatus,
      }).eq('id', bookingId);
      await logEvent(supabase, bookingId, `verify_${paymentStatus}`, booking.status, defaultBookingStatus, 'system',
        `BOG API live status: ${bogStatus}`);
    }

    return jsonOk({
      bookingId,
      paymentStatus,
      bookingStatus: paymentStatus === booking.payment_status ? booking.status : defaultBookingStatus,
      verified: paymentStatus === 'paid',
      source: 'bog_api_live',
      bogStatus,
    });
  }

  return jsonErr('Invalid action or method', 405);
});
