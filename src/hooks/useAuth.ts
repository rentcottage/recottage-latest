import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { attachPhoneVerification, claimPhoneVerification } from '../lib/otp';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoggedIn: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        const msg = error.message ?? '';
        if (
          msg.includes('Refresh Token Not Found') ||
          msg.includes('Invalid Refresh Token') ||
          msg.includes('refresh_token')
        ) {
          supabase.auth.signOut();
          setSession(null);
        } else {
          setSession(s);
        }
      } else {
        setSession(s);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // 'TOKEN_REFRESH_FAILED' is emitted by supabase-js at runtime but isn't yet
      // in the typed AuthChangeEvent union — widen the comparison via `as string`.
      const evt = event as string;
      if (evt === 'TOKEN_REFRESHED') {
        setSession(s);
      } else if (evt === 'TOKEN_REFRESH_FAILED') {
        // Refresh token is invalid/expired — sign out to clear the stale session
        localStorage.removeItem('rc_session');
        localStorage.removeItem('userProfile');
        setSession(null);
        supabase.auth.signOut().catch(() => {});
      } else if (evt === 'SIGNED_OUT') {
        // Just clear local state — do NOT call signOut() here, that causes a loop
        localStorage.removeItem('rc_session');
        localStorage.removeItem('userProfile');
        setSession(null);
      } else {
        setSession(s);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user: session?.user ?? null,
    session,
    isLoggedIn: !!session?.user,
    loading,
  };
}

export async function signInWithGoogle(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

export async function signInWithFacebook(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

export function signOutUser(): void {
  // Clear local storage immediately so UI responds instantly
  localStorage.removeItem('rc_session');
  localStorage.removeItem('userProfile');
  // Fire the server-side signout in background — no need to await
  supabase.auth.signOut().catch(() => {});
}

export async function upsertProfile(user: User): Promise<void> {
  const meta = user.user_metadata;
  const fullName = meta?.full_name ?? meta?.name ?? '';
  const firstName = meta?.first_name ?? meta?.given_name ?? fullName.split(' ')[0] ?? '';
  const lastName = meta?.last_name ?? meta?.family_name ?? fullName.split(' ').slice(1).join(' ') ?? '';

  // Step 1: Insert the profile row if it doesn't exist yet.
  // ignoreDuplicates: true means if the row already exists, nothing is overwritten.
  const { error: insertErr } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email: user.email ?? '',
        role: 'customer',
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  if (insertErr) console.error('Profile upsert error:', insertErr);

  // Step 2: Selectively update fields — never overwrite a non-empty value with an empty one.
  // This protects manually-entered names from being wiped by a Google account that
  // returns an incomplete name (e.g. only first name, or no name at all).
  const { data: existing } = await supabase
    .from('profiles')
    .select('phone, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  const updatePayload: Record<string, string | boolean> = {
    email: user.email ?? '',
  };

  // Only update first_name if Google provided one OR the DB currently has none
  const existingFirst = existing?.first_name?.trim() ?? '';
  const existingLast = existing?.last_name?.trim() ?? '';
  if (firstName || !existingFirst) updatePayload.first_name = firstName;
  if (lastName || !existingLast) updatePayload.last_name = lastName;

  // Rebuild full_name from the resolved values
  const resolvedFirst = updatePayload.first_name ?? existingFirst;
  const resolvedLast = updatePayload.last_name ?? existingLast;
  updatePayload.full_name = `${resolvedFirst} ${resolvedLast}`.trim();

  // Only set phone if the profile currently has none — never overwrite an existing phone.
  // Prefer the local stash (it may carry a verified flag); fall back to the copy
  // in user_metadata, which is what makes this work across browsers and devices.
  const stashedPhone = localStorage.getItem('rc_pending_phone');
  const metaPhone = typeof meta?.phone === 'string' ? meta.phone.trim() : '';
  const pendingPhone = stashedPhone || metaPhone;
  if (!existing?.phone && pendingPhone) {
    updatePayload.phone = pendingPhone;
    // Verified status is only ever honoured from the local stash, which is set
    // right after a real SMS check. Metadata is user-writable, so a phone
    // arriving that way is saved unverified.
    if (stashedPhone && localStorage.getItem('rc_pending_phone_verified') === '1') {
      updatePayload.phone_verified = true;
    }
    localStorage.removeItem('rc_pending_phone');
    localStorage.removeItem('rc_pending_phone_verified');
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id);
  if (updateErr) console.error('Profile update error:', updateErr);
}

/**
 * Redeem a phone verification that was made at signup, before the account had a
 * session. Cheap no-op for accounts that are already verified, so it is safe to
 * call on any screen that reads phone_verified.
 *
 * This is the durable counterpart to the localStorage stash: the binding was
 * written server-side at signup, so it still works when the confirmation link
 * was opened on another device, on a different origin, or not at all because
 * the user simply logged in.
 *
 * Returns true when the profile went from unverified to verified.
 */
export async function ensurePhoneVerification(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_verified')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.phone_verified) return false;
  return (await claimPhoneVerification()) !== null;
}

const USER_MGMT_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-user-management`;

export async function checkEmailBlocked(email: string): Promise<{ blocked: boolean; reason: string | null }> {
  try {
    const res = await fetch(USER_MGMT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-email', email: email.trim().toLowerCase() }),
    });
    if (!res.ok) return { blocked: false, reason: null };
    const data = await res.json();
    return { blocked: !!data.blocked, reason: data.reason ?? null };
  } catch {
    return { blocked: false, reason: null };
  }
}

export const EMAIL_TAKEN_MESSAGE =
  'An account with this email address already exists. Please log in instead, or use "Forgot password".';
export const PHONE_TAKEN_MESSAGE =
  'This phone number is already registered to another account. Please use a different number.';

/**
 * Is this email / phone free to register with?
 *
 * Answered server-side (service role) because the browser genuinely cannot tell:
 * Supabase Auth hides "already registered" from signUp() when email confirmation
 * is on, and profiles.phone isn't readable under RLS. A network failure returns
 * "available" — the unique indexes in db/registration-uniqueness.sql are the
 * actual guarantee, so a soft failure here degrades the message, not the rule.
 */
export async function checkRegistrationAvailability(
  email: string,
  phone?: string,
): Promise<{ emailTaken: boolean; phoneTaken: boolean }> {
  try {
    const res = await fetch(USER_MGMT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'check-availability',
        email: email.trim().toLowerCase(),
        phone: phone?.trim() ?? '',
      }),
    });
    if (!res.ok) return { emailTaken: false, phoneTaken: false };
    const data = await res.json();
    return { emailTaken: !!data.emailTaken, phoneTaken: !!data.phoneTaken };
  } catch {
    return { emailTaken: false, phoneTaken: false };
  }
}

export async function signUpWithEmail(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  phone?: string,
  captchaToken?: string,
  phoneVerified = false,
  /** From verifyPhoneOtp() — binds the SMS check to the new account, server-side. */
  phoneClaimToken?: string,
): Promise<{
  session: import('@supabase/supabase-js').Session | null;
  user: User | null;
  error: string | null;
  /** true when Supabase requires email confirmation before the session is issued */
  confirmationRequired: boolean;
}> {
  // Check if email is blocked before attempting registration
  const { blocked } = await checkEmailBlocked(email);
  if (blocked) {
    return {
      session: null,
      user: null,
      error: 'This email address is not allowed to register. Registration with this email is blocked.',
      confirmationRequired: false,
    };
  }

  // Refuse a duplicate before creating anything. Without this the email case
  // silently no-ops (see the identities check below) and the phone case happily
  // creates a second account on someone else's number.
  const { emailTaken, phoneTaken } = await checkRegistrationAvailability(email, phone);
  if (emailTaken) {
    return { session: null, user: null, error: EMAIL_TAKEN_MESSAGE, confirmationRequired: false };
  }
  if (phoneTaken) {
    return { session: null, user: null, error: PHONE_TAKEN_MESSAGE, confirmationRequired: false };
  }

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName,
        // Travels with the account, server-side. The localStorage stash below
        // only survives if the confirmation link is opened in the very same
        // browser — not on a phone, not in another browser, and not on www when
        // signup happened on the apex domain (separate origins, separate
        // storage). Whenever that failed, the number was lost and the profile
        // asked for it all over again.
        // NOTE: user_metadata is writable by the user, so this carries the
        // number only — never phone_verified, which must stay server-verified.
        ...(phone?.trim() ? { phone: phone.trim() } : {}),
      },
      // Redirect target after clicking the confirmation link in email
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      ...(captchaToken ? { captchaToken } : {}),
    },
  });

  if (error) {
    // Supabase phrases this as "User already registered" when confirmations are
    // off; say the same thing here as the pre-check does.
    const dup = /already registered|already been registered/i.test(error.message);
    return {
      session: null,
      user: null,
      error: dup ? EMAIL_TAKEN_MESSAGE : error.message,
      confirmationRequired: false,
    };
  }

  // Enumeration protection: for an email that already exists, Supabase returns
  // a decoy user with NO identities and no error, rather than admitting the
  // address is taken. Treated as success, that shows "Confirm your email" for
  // an account the visitor doesn't own and no account is ever created — the
  // exact "registered with an already used email" symptom.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { session: null, user: null, error: EMAIL_TAKEN_MESSAGE, confirmationRequired: false };
  }

  // "Confirm email" DISABLED → Supabase returns a session immediately
  if (data.session && data.user) {
    // Use merge upsert (no ignoreDuplicates) so phone is always saved
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName,
        email: email.trim(),
        phone: phone?.trim() ?? '',
        phone_verified: phoneVerified,
        role: 'customer',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    // 23505 = the profiles_unique_contact trigger rejected this row, i.e. the
    // number was claimed between the check above and this insert. Rare, but the
    // account must not end up silently sharing a number: save the profile
    // without a phone so the account still works, and say why.
    if (profileError?.code === '23505') {
      const { error: retryError } = await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName,
          email: email.trim(),
          role: 'customer',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      // Still rejected with no phone in the payload → it was the email that
      // collided, not the number, so name that instead of misdirecting.
      if (retryError?.code === '23505') {
        return { session: data.session, user: data.user, error: EMAIL_TAKEN_MESSAGE, confirmationRequired: false };
      }
      if (retryError) console.error('Profile creation error:', retryError);
      return {
        session: data.session,
        user: data.user,
        error: PHONE_TAKEN_MESSAGE,
        confirmationRequired: false,
      };
    }
    if (profileError) console.error('Profile creation error:', profileError);
    return { session: data.session, user: data.user, error: null, confirmationRequired: false };
  }

  // "Confirm email" ENABLED → user exists but no session yet; confirmation email was sent
  if (data.user && !data.session) {
    // Bind the SMS verification to the new account server-side. This is what
    // makes it survive the confirmation gap: the localStorage stash below only
    // works if the confirmation link is opened in this very browser — not on a
    // phone, not on www when signup happened on the apex domain, and not when
    // the user just logs in instead of landing on /auth/callback. Whenever that
    // failed, the profile asked them to verify a number they had already proven.
    if (phone?.trim() && phoneVerified && phoneClaimToken) {
      await attachPhoneVerification(phone.trim(), phoneClaimToken, data.user.id);
    }
    // Fast path for the same-browser case, so the flag lands without a round trip.
    if (phone?.trim()) {
      localStorage.setItem('rc_pending_phone', phone.trim());
      if (phoneVerified) localStorage.setItem('rc_pending_phone_verified', '1');
    }
    return { session: null, user: data.user, error: null, confirmationRequired: true };
  }

  return { session: null, user: null, error: 'Something went wrong. Please try again.', confirmationRequired: false };
}

export async function signInWithEmail(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error) {
    return {
      error: error.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : error.message,
    };
  }
  return { error: null };
}

export async function sendPasswordReset(
  email: string,
  captchaToken?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/auth/reset-password`,
    ...(captchaToken ? { captchaToken } : {}),
  });
  if (error) return { error: error.message };
  return { error: null };
}
