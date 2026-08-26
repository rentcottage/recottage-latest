// Client helpers for the phone-otp Edge Function (Citynet SMS).
// The function is public (verify_jwt = false), so we call it with a plain fetch,
// the same way checkEmailBlocked() calls admin-user-management.

import { supabase } from './supabase';

const OTP_FN_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/phone-otp`;

/**
 * Send the signed-in user's access token along. The function is public, so it
 * derives the caller's identity from this header rather than from the body —
 * anything the body says about who you are is unverifiable.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
interface VerifyResult {
  ok: boolean;
  error?: string;
  remaining?: number;
  /**
   * Returned only when nobody is signed in (the signup flow). Proves this
   * visitor passed the SMS check, so the account created next can bind the
   * verification to itself via attachPhoneVerification().
   */
  claimToken?: string;
}

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
      headers: { 'Content-Type': 'application/json', ...(userId ? await authHeaders() : {}) },
      body: JSON.stringify({ action: 'verify', phone, code, userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Invalid code.', remaining: data.remaining };
    }
    return { ok: true, claimToken: data.claimToken };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Bind a just-passed SMS verification to the account that was just created.
 * Runs while the account still has no session (email confirmation pending),
 * which is why it presents the claim token instead of an access token.
 * Best-effort: failing here only means the user may be asked to verify again.
 */
export async function attachPhoneVerification(
  phone: string,
  claimToken: string,
  userId: string,
): Promise<boolean> {
  try {
    const res = await fetch(OTP_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'attach', phone, claimToken, userId }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok === true;
  } catch {
    return false;
  }
}

/**
 * Redeem a verification made before this account had a session — the case where
 * the user proved their number at signup, then confirmed the email on another
 * device or simply logged in. The server knows which number this account bound
 * at signup, so no phone is passed. Returns the number that was confirmed, or
 * null when there is nothing to claim (the normal case).
 */
export async function claimPhoneVerification(): Promise<string | null> {
  try {
    const headers = await authHeaders();
    if (!('Authorization' in headers)) return null;
    const res = await fetch(OTP_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ action: 'claim' }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok ? (data.phone as string) : null;
  } catch {
    return null;
  }
}
