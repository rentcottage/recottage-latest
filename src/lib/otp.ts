// Client helpers for the phone-otp Edge Function (Citynet SMS).
// The function is public (verify_jwt = false), so we call it with a plain fetch,
// the same way checkEmailBlocked() calls admin-user-management.

const OTP_FN_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/phone-otp`;

/** Normalize a Georgian number to the gateway format: 995 + 9 digits. Returns null if invalid. */
export function normalizeGeoPhone(input: string): string | null {
  let d = (input ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('995')) {
    // already country-coded
  } else if (d.length === 10 && d.startsWith('0')) {
    d = '995' + d.slice(1);
  } else if (d.length === 9) {
    d = '995' + d;
  }
  return /^995\d{9}$/.test(d) ? d : null;
}

/** Pretty form: +995 555 12 34 56 */
export function formatGeoPhone(normalized: string): string {
  const m = /^995(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(normalized);
  return m ? `+995 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${normalized}`;
}

interface SendResult { ok: boolean; error?: string; cooldownSec?: number; expiresInSec?: number }
interface VerifyResult { ok: boolean; error?: string; remaining?: number }

export async function sendPhoneOtp(phone: string): Promise<SendResult> {
  try {
    const res = await fetch(OTP_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Could not send the code. Please try again.', cooldownSec: data.cooldownSec };
    }
    return { ok: true, expiresInSec: data.expiresInSec };
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' };
  }
}

export async function verifyPhoneOtp(phone: string, code: string, userId?: string): Promise<VerifyResult> {
  try {
    const res = await fetch(OTP_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', phone, code, userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Invalid code.', remaining: data.remaining };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}
