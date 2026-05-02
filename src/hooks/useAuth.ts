import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
      if (event === 'TOKEN_REFRESHED') {
        setSession(s);
      } else if (event === 'TOKEN_REFRESH_FAILED') {
        // Refresh token is invalid/expired — sign out to clear the stale session
        localStorage.removeItem('rc_session');
        localStorage.removeItem('userProfile');
        setSession(null);
        supabase.auth.signOut().catch(() => {});
      } else if (event === 'SIGNED_OUT') {
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
      redirectTo: 'https://rentcottage.ge/auth/callback',
    },
  });
}

export async function signInWithFacebook(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: 'https://rentcottage.ge/auth/callback',
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

  const updatePayload: Record<string, string> = {
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

  // Only set phone if the profile currently has none — never overwrite an existing phone
  const pendingPhone = localStorage.getItem('rc_pending_phone');
  if (!existing?.phone && pendingPhone) {
    updatePayload.phone = pendingPhone;
    localStorage.removeItem('rc_pending_phone');
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id);
  if (updateErr) console.error('Profile update error:', updateErr);
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

export async function signUpWithEmail(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  phone?: string
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

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName,
      },
      // Redirect target after clicking the confirmation link in email
      emailRedirectTo: 'https://rentcottage.ge/auth/callback',
    },
  });

  if (error) return { session: null, user: null, error: error.message, confirmationRequired: false };

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
        role: 'customer',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (profileError) console.error('Profile creation error:', profileError);
    return { session: data.session, user: data.user, error: null, confirmationRequired: false };
  }

  // "Confirm email" ENABLED → user exists but no session yet; confirmation email was sent
  if (data.user && !data.session) {
    // Stash the phone so the auth-callback can save it after confirmation
    if (phone?.trim()) {
      localStorage.setItem('rc_pending_phone', phone.trim());
    }
    return { session: null, user: data.user, error: null, confirmationRequired: true };
  }

  return { session: null, user: null, error: 'Something went wrong. Please try again.', confirmationRequired: false };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
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

export async function sendPasswordReset(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: 'https://rentcottage.ge/auth/reset-password',
  });
  if (error) return { error: error.message };
  return { error: null };
}
