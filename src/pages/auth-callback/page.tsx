import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { upsertProfile, checkEmailBlocked, ensurePhoneVerification } from '../../hooks/useAuth';
import { useT } from '../../i18n';

/**
 * If the user entered a phone number during email sign-up (before confirmation),
 * it was stashed in localStorage. Now that we have a real session, save it to
 * the profiles table and clear the stash.
 * Uses upsert so it works even if the profile row doesn't exist yet.
 */
async function savePendingPhone(userId: string, metadataPhone?: string): Promise<void> {
  const stashed = localStorage.getItem('rc_pending_phone');
  // Falls back to the copy carried in user_metadata, so confirming the email on
  // a different device (or on www rather than the apex domain) still keeps the
  // number the visitor typed at registration.
  const pending = stashed || metadataPhone?.trim() || '';
  if (!pending) return;
  // Verified only counts when it came from the local stash written straight
  // after an SMS check — user_metadata is user-writable.
  const verified = !!stashed && localStorage.getItem('rc_pending_phone_verified') === '1';
  // Without the stash the number is saved unverified here; ensurePhoneVerification()
  // below then redeems the server-side binding made at signup, which is what
  // covers confirming the email on a different device or origin.
  const payload = verified ? { phone: pending, phone_verified: true } : { phone: pending };
  try {
    // First try update (profile row should exist after upsertProfile)
    const { error: updateErr } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (updateErr) {
      // Fallback: upsert in case the row doesn't exist yet
      await supabase
        .from('profiles')
        .upsert({ id: userId, role: 'customer', ...payload }, { onConflict: 'id' });
    }

    localStorage.removeItem('rc_pending_phone');
    localStorage.removeItem('rc_pending_phone_verified');
  } catch {
    // non-fatal — ProfileCompletionGate will catch it if phone is still missing
  }
}

/**
 * Returns true if this is an OAuth user (Google/Facebook) who has no phone saved.
 * In that case we redirect to /profile so the ProfileCompletionGate modal fires.
 */
async function needsPhoneCompletion(userId: string, provider: string): Promise<boolean> {
  const isOAuth = provider === 'google' || provider === 'facebook';
  if (!isOAuth) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();

  const hasPhone = profile?.phone && profile.phone.trim().length > 0;
  return !hasPhone;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        // Give Supabase a moment to exchange the token from the URL
        await new Promise((r) => setTimeout(r, 600));

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          // Check if this email is blocked before allowing sign-in
          const email = session.user.email ?? '';
          if (email) {
            const { blocked: isBlocked } = await checkEmailBlocked(email);
            if (isBlocked) {
              // Sign them out immediately and show blocked message
              await supabase.auth.signOut();
              if (!cancelled) setBlocked(true);
              return;
            }
          }

          await upsertProfile(session.user);
          await savePendingPhone(session.user.id, session.user.user_metadata?.phone as string | undefined);
          await ensurePhoneVerification(session.user.id);

          if (!cancelled) {
            const provider = session.user.app_metadata?.provider ?? '';
            const needsPhone = await needsPhoneCompletion(session.user.id, provider);
            // Redirect to /profile — ProfileCompletionGate will show the modal if phone is missing
            navigate(needsPhone ? '/profile?complete=phone' : '/profile');
          }
          return;
        }

        // Listen for auth events — covers:
        //   SIGNED_IN  → OAuth + email confirmation (implicit/PKCE)
        //   USER_UPDATED → email confirmed in some Supabase versions
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
          if (
            (event === 'SIGNED_IN' || event === 'USER_UPDATED') &&
            s?.user &&
            !cancelled
          ) {
            // Check if this email is blocked
            const email = s.user.email ?? '';
            if (email) {
              const { blocked: isBlocked } = await checkEmailBlocked(email);
              if (isBlocked) {
                await supabase.auth.signOut();
                subscription.unsubscribe();
                if (!cancelled) setBlocked(true);
                return;
              }
            }

            await upsertProfile(s.user);
            await savePendingPhone(s.user.id, s.user.user_metadata?.phone as string | undefined);
            await ensurePhoneVerification(s.user.id);
            subscription.unsubscribe();

            const provider = s.user.app_metadata?.provider ?? '';
            const needsPhone = await needsPhoneCompletion(s.user.id, provider);
            navigate(needsPhone ? '/profile?complete=phone' : '/profile');
          }
        });

        // Timeout safety net
        const timer = setTimeout(() => {
          if (!cancelled) {
            subscription.unsubscribe();
            navigate('/');
          }
        }, 15000);

        return () => {
          clearTimeout(timer);
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('Auth callback error:', err);
        if (!cancelled) {
          setError(t('account.authCallback.authFailedError'));
          setTimeout(() => navigate('/'), 3000);
        }
      }
    };

    handleCallback();
    return () => { cancelled = true; };
  }, [navigate]);

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <i className="ri-forbid-2-line text-red-500 text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('account.authCallback.registrationNotAllowedTitle')}</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            {t('account.authCallback.registrationBlockedBody')}
          </p>
          <a
            href="/"
            className="inline-block px-6 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t('account.authCallback.backToHome')}
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-error-warning-line text-red-500 text-xl"></i>
          </div>
          <p className="text-gray-800 font-medium">{error}</p>
          <p className="text-gray-400 text-sm mt-1">{t('account.authCallback.redirecting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-5"></div>
        <p className="text-gray-700 font-medium">{t('account.authCallback.completingSignIn')}</p>
        <p className="text-gray-400 text-sm mt-1">{t('account.authCallback.justAMoment')}</p>
      </div>
    </div>
  );
}
