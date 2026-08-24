import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';
import { supabase, initialUrlHash, initialStoredAccessToken } from '../../lib/supabase';
import { useT } from '../../i18n';

const HCAPTCHA_SITE_KEY = '7c3ed03a-c4f2-4bd4-8bda-e8a291bc5ede';

type PageState = 'loading' | 'ready' | 'success' | 'error';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useT();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<HCaptchaLib>(null);

  useEffect(() => {
    // `initialUrlHash` is captured at import time, BEFORE supabase-js consumes
    // and strips the fragment. Reading window.location.hash here would race the
    // SDK — it usually loses, which is why valid links intermittently reported
    // themselves as expired and only worked after a few attempts.
    const params = new URLSearchParams(initialUrlHash.replace(/^#/, ''));
    const recoveryToken = params.get('access_token');
    const linkError = params.get('error_description') ?? params.get('error');

    let settled = false;
    const settle = (state: PageState) => {
      if (settled) return;
      settled = true;
      setPageState(state);
    };

    // Supabase reports a dead link in the fragment itself — no need to wait.
    if (linkError) {
      settle('error');
      return;
    }
    // Supabase's PKCE-style links carry `?code=` instead of a token fragment.
    // Today's email template uses the fragment, but if that ever changes this
    // keeps the page waiting for the session rather than declaring the link
    // dead on arrival.
    const pkceCode = new URLSearchParams(window.location.search).get('code');

    // Opened without any credential at all (bookmarked, refreshed after the
    // hash was stripped, or linked to directly).
    if (!recoveryToken && !pkceCode) {
      settle('error');
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') settle('ready');
    });

    // The event above is missed whenever the SDK processes the URL before this
    // component subscribes, so confirm independently: the ACTIVE session must be
    // the one minted from this link. Comparing the tokens is what rules out the
    // stale-session case — an already-logged-in visitor whose recovery token was
    // rejected used to reach the form and then fail on save with "Current
    // password required when setting new password".
    const started = Date.now();
    const poll = window.setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // Ready once the live session demonstrably came from THIS link: either it
      // carries the token the link supplied, or it replaced whatever session the
      // visitor arrived with. Both readings are needed because supabase-js may
      // hand the link's token straight through or mint a fresh one; what matters
      // is only that the session isn't the stale pre-existing one.
      const fromThisLink =
        !!session &&
        (session.access_token === recoveryToken ||
          session.access_token !== initialStoredAccessToken);
      if (fromThisLink) {
        settle('ready');
        window.clearInterval(poll);
      } else if (Date.now() - started > 8000) {
        settle('error');
        window.clearInterval(poll);
      }
    }, 150);

    return () => {
      subscription.unsubscribe();
      window.clearInterval(poll);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (password.length < 8) {
      setFormError(t('account.authResetPassword.passwordLengthError'));
      return;
    }
    if (password !== confirmPassword) {
      setFormError(t('account.authResetPassword.passwordMismatchError'));
      return;
    }
    if (!captchaToken) {
      setFormError(t('account.authResetPassword.captchaRequiredError'));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        // Supabase demands the current password when the session isn't a
        // recovery one ("Secure password change"). Raw, that reads as though the
        // user forgot to fill a field that isn't on screen — the real remedy is
        // a fresh link.
        const stale = /current password|reauthentication/i.test(error.message);
        setFormError(stale ? t('account.authResetPassword.staleLinkError') : error.message);
        captchaRef.current?.resetCaptcha();
        setCaptchaToken('');
        return;
      }
      setPageState('success');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-8">

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-5"></div>
            <p className="text-gray-700 font-medium">{t('account.authResetPassword.verifyingLink')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('account.authResetPassword.justAMoment')}</p>
          </div>
        )}

        {/* Error — invalid or expired link */}
        {pageState === 'error' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-red-500 text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('account.authResetPassword.linkExpiredTitle')}</h2>
            <p className="text-gray-500 text-sm mb-6">
              {t('account.authResetPassword.linkExpiredBody')}
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('account.authResetPassword.backToHomeBtn')}
            </button>
          </div>
        )}

        {/* Success */}
        {pageState === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-shield-check-line text-green-500 text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('account.authResetPassword.successTitle')}</h2>
            <p className="text-gray-500 text-sm mb-6">
              {t('account.authResetPassword.successBody')}
            </p>
            <Link
              to="/"
              className="block w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors text-center whitespace-nowrap"
            >
              {t('account.authResetPassword.goHomeLogin')}
            </Link>
          </div>
        )}

        {/* Ready — new password form */}
        {pageState === 'ready' && (
          <>
            <div className="mb-6">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <i className="ri-lock-password-line text-red-500 text-xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('account.authResetPassword.setNewPasswordTitle')}</h2>
              <p className="text-gray-500 text-sm mt-1">{t('account.authResetPassword.setNewPasswordSub')}</p>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <i className="ri-error-warning-line text-red-500 flex-shrink-0"></i>
                <p className="text-sm text-red-700">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('account.authResetPassword.newPassword')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    placeholder={t('account.authResetPassword.newPasswordPlaceholder')}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">{t('account.authResetPassword.minChars')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('account.authResetPassword.confirmNewPassword')}</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    placeholder={t('account.authResetPassword.confirmNewPasswordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <i className={showConfirm ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                  </button>
                </div>
              </div>

              {/* CAPTCHA */}
              <div className="flex justify-center pt-1">
                <HCaptchaLib
                  ref={captchaRef}
                  sitekey={HCAPTCHA_SITE_KEY}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken('')}
                  onError={() => setCaptchaToken('')}
                  theme="light"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !captchaToken}
                className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 mt-2"
              >
                {saving ? t('account.authResetPassword.savingEllipsis') : t('account.authResetPassword.saveNewPassword')}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
