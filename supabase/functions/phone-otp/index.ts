// ─────────────────────────────────────────────────────────────────────────────
// phone-otp — send & verify SMS one-time codes for registration.
//
// SMS gateway: Citynet / City Telecom (sender ID "CottageGe").
//   GET http://212.72.155.180:2375/api/sendmsg.php?username=&password=&num=&msg=&utf=
//   Returns "XXXX-api_..." where the leading 4 chars are the status (0000 = ok).
//
// Secrets (set with `supabase secrets set ...`, never hard-code):
//   CITYNET_SMS_USERNAME   — gateway username
//   CITYNET_SMS_PASSWORD   — gateway password
//   OTP_PEPPER             — random string mixed into the code hash (recommended)
//   OTP_MESSAGE_TEMPLATE   — optional, must contain "{code}"
//   HCAPTCHA_SECRET        — optional; if set, a captchaToken is required on "send"
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — injected automatically by Supabase
//
// This function is deployed with verify_jwt = false (see config.toml) so the
// signup page can call it before the visitor has a session. It is therefore
// public — abuse is bounded by per-phone and per-IP rate limits below.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'npm:@supabase/supabase-js@2';

const SMS_ENDPOINT = 'http://212.72.155.180:2375/api/sendmsg.php';

// Tunables
const CODE_TTL_SEC = 300;        // a code is valid for 5 minutes
const MAX_ATTEMPTS = 5;          // wrong guesses allowed per code before it's burned
const RESEND_COOLDOWN_SEC = 60;  // min gap between sends to one number
const MAX_PER_PHONE_HOUR = 5;    // sends per number per hour
const MAX_PER_IP_HOUR = 12;      // sends per IP per hour

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Normalize any Georgian number to the gateway format: 995 + 9 digits. */
function normalizePhone(input: string): string | null {
  let d = (input ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('995')) {
    // already country-coded
  } else if (d.length === 10 && d.startsWith('0')) {
    d = '995' + d.slice(1);
  } else if (d.length === 9) {
    d = '995' + d; // bare 9-digit local number
  }
  return /^995\d{9}$/.test(d) ? d : null;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function makeCode(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] % 1_000_000).toString().padStart(6, '0');
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

async function verifyHcaptcha(token: string, secret: string): Promise<boolean> {
  try {
    const res = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `response=${encodeURIComponent(token)}&secret=${encodeURIComponent(secret)}`,
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/** Send one SMS through the Citynet gateway. Returns the 4-char status code. */
async function sendSms(phone: string, body: string): Promise<{ status: string; raw: string }> {
  const user = Deno.env.get('CITYNET_SMS_USERNAME') ?? '';
  const pass = Deno.env.get('CITYNET_SMS_PASSWORD') ?? '';
  const url =
    `${SMS_ENDPOINT}?username=${encodeURIComponent(user)}` +
    `&password=${encodeURIComponent(pass)}` +
    `&num=${encodeURIComponent(phone)}` +
    `&msg=${encodeURIComponent(body)}` +
    `&utf=1`;
  const res = await fetch(url);
  const raw = (await res.text()).trim();
  return { status: raw.slice(0, 4), raw };
}

const SMS_ERRORS: Record<string, string> = {
  '0001': 'SMS gateway rejected the request (IP not allowed).',
  '0003': 'SMS gateway rejected the request (invalid request).',
  '0005': 'SMS gateway rejected the request (empty message).',
  '0007': 'Invalid phone number.',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const pepper = Deno.env.get('OTP_PEPPER') ?? '';

  let body: { action?: string; phone?: string; code?: string; captchaToken?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const phone = normalizePhone(body.phone ?? '');
  if (!phone) return json({ ok: false, error: 'Please enter a valid Georgian phone number.' }, 400);

  // ── SEND ───────────────────────────────────────────────────────────────────
  if (body.action === 'send') {
    const ip = clientIp(req);
    const now = Date.now();
    const minuteAgo = new Date(now - RESEND_COOLDOWN_SEC * 1000).toISOString();
    const hourAgo = new Date(now - 3_600_000).toISOString();

    // Optional captcha gate (only enforced when HCAPTCHA_SECRET is configured)
    const hcSecret = Deno.env.get('HCAPTCHA_SECRET');
    if (hcSecret) {
      if (!body.captchaToken || !(await verifyHcaptcha(body.captchaToken, hcSecret))) {
        return json({ ok: false, error: 'Captcha verification failed.' }, 400);
      }
    }

    // Cooldown: one recent send to this number
    const { data: recent } = await supabase
      .from('phone_otps')
      .select('created_at')
      .eq('phone', phone)
      .gte('created_at', minuteAgo)
      .order('created_at', { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      const waited = Math.ceil((now - new Date(recent[0].created_at).getTime()) / 1000);
      const wait = Math.max(1, RESEND_COOLDOWN_SEC - waited);
      return json({ ok: false, error: `Please wait ${wait}s before requesting another code.`, cooldownSec: wait }, 429);
    }

    // Hourly caps (per phone, per IP)
    const [{ count: phoneCount }, { count: ipCount }] = await Promise.all([
      supabase.from('phone_otps').select('id', { count: 'exact', head: true }).eq('phone', phone).gte('created_at', hourAgo),
      supabase.from('phone_otps').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', hourAgo),
    ]);
    if ((phoneCount ?? 0) >= MAX_PER_PHONE_HOUR) {
      return json({ ok: false, error: 'Too many codes requested for this number. Try again later.' }, 429);
    }
    if ((ipCount ?? 0) >= MAX_PER_IP_HOUR) {
      return json({ ok: false, error: 'Too many requests. Try again later.' }, 429);
    }

    const code = makeCode();
    // utf=1 is always sent, so a Georgian default is fine. Override via OTP_MESSAGE_TEMPLATE.
    const template = Deno.env.get('OTP_MESSAGE_TEMPLATE') ?? 'RentCottage — დადასტურების კოდი: {code}';
    const message = template.replace('{code}', code);

    // Send first; only persist the challenge if the gateway accepted it.
    let sms: { status: string; raw: string };
    try {
      sms = await sendSms(phone, message);
    } catch (e) {
      return json({ ok: false, error: 'Could not reach the SMS gateway. Please try again.', detail: String(e) }, 502);
    }
    if (sms.status !== '0000') {
      return json({ ok: false, error: SMS_ERRORS[sms.status] ?? `SMS gateway error (${sms.status || 'no response'}).` }, 502);
    }

    const code_hash = await sha256Hex(`${code}:${phone}:${pepper}`);
    const { error: insErr } = await supabase.from('phone_otps').insert({
      phone,
      code_hash,
      ip,
      expires_at: new Date(now + CODE_TTL_SEC * 1000).toISOString(),
    });
    if (insErr) return json({ ok: false, error: 'Could not store verification code.' }, 500);

    return json({ ok: true, sent: true, expiresInSec: CODE_TTL_SEC });
  }

  // ── VERIFY ───────────────────────────────────────────────────────────────────
  if (body.action === 'verify') {
    const code = (body.code ?? '').replace(/\D/g, '');
    if (code.length !== 6) return json({ ok: false, error: 'Enter the 6-digit code.' }, 400);

    const { data: rows } = await supabase
      .from('phone_otps')
      .select('id, code_hash, attempts, expires_at')
      .eq('phone', phone)
      .eq('consumed', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) return json({ ok: false, error: 'Code expired or not found. Request a new one.' }, 400);

    if (row.attempts >= MAX_ATTEMPTS) {
      await supabase.from('phone_otps').update({ consumed: true }).eq('id', row.id);
      return json({ ok: false, error: 'Too many attempts. Request a new code.' }, 429);
    }

    const expected = await sha256Hex(`${code}:${phone}:${pepper}`);
    if (expected !== row.code_hash) {
      const attempts = row.attempts + 1;
      await supabase.from('phone_otps').update({ attempts }).eq('id', row.id);
      const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
      return json({ ok: false, error: 'Incorrect code. Please try again.', remaining }, 400);
    }

    // Correct — burn the code so it can't be reused.
    await supabase.from('phone_otps').update({ consumed: true, attempts: row.attempts + 1 }).eq('id', row.id);

    // If a signed-in user is verifying, stamp their profile server-side (authoritative —
    // this is the only path that should set phone_verified for an existing account).
    const userId = (body.userId ?? '').trim();
    if (userId) {
      // One account per number: passing the SMS proves the user holds the line,
      // but not that it is free. Without this an existing account could move
      // onto a number another account already uses — the same duplicate the
      // signup flow rejects, entered through the profile editor instead.
      const { data: taken, error: takenErr } = await supabase.rpc('phone_in_use', {
        p: phone,
        exclude_user: userId,
      });
      if (takenErr) {
        console.error('[phone-otp] phone_in_use error:', takenErr);
        return json({ error: 'Could not verify the phone number. Please try again.' }, 500);
      }
      if (taken) {
        return json({ error: 'This phone number is already registered to another account.' }, 409);
      }

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ phone, phone_verified: true })
        .eq('id', userId);
      if (updErr) {
        // 23505 = the unique index caught a number claimed since the check above.
        if (updErr.code === '23505') {
          return json({ error: 'This phone number is already registered to another account.' }, 409);
        }
        console.error('[phone-otp] profile update error:', updErr);
        return json({ error: 'Could not save the phone number. Please try again.' }, 500);
      }
    }

    return json({ ok: true, verified: true, phone });
  }

  return json({ error: 'Unknown action.' }, 400);
});
