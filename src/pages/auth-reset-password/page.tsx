import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '@lib/i18n';

const HCAPTCHA_SITE_KEY = '7c3ed03a-c4f2-4bd4-8bda-e8a291bc5ede';

type PageState = 'loading' | 'ready' | 'success' | 'error';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
    // Supabase automatically parses the hash tokens and emits PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('ready');
      }
    });

    // Also check if there's already a session (token already exchanged)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Check URL hash for type=recovery token before deciding state
        const hash = window.location.hash;
        if (hash.includes('type=recovery') || hash.includes('access_token')) {
          setPageState('ready');
        }
      }
    });

    // Safety timeout — if no event fires after 8 seconds, show error
    const timer = setTimeout(() => {
      setPageState((prev) => {
        if (prev === 'loading') return 'error';
        return prev;
      });
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (password.length < 8) {
      setFormError(t('authPages.validation.passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      setFormError(t('authPages.validation.passwordsNoMatch'));
      return;
    }
    if (!captchaToken) {
      setFormError(t('authPages.validation.captchaRequired'));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFormError(error.message);
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
            <p className="text-gray-700 font-medium">{t('authPages.reset.verifyingLink')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('authPages.justAMoment')}</p>
          </div>
        )}

        {/* Error — invalid or expired link */}
        {pageState === 'error' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-red-500 text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('authPages.reset.expiredTitle')}</h2>
            <p className="text-gray-500 text-sm mb-6">
              {t('authPages.reset.expiredDesc')}
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('notFound.backHome')}
            </button>
          </div>
        )}

        {/* Success */}
        {pageState === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-shield-check-line text-green-500 text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('authPages.reset.successTitle')}</h2>
            <p className="text-gray-500 text-sm mb-6">
              {t('authPages.reset.successDesc')}
            </p>
            <Link
              to="/"
              className="block w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors text-center whitespace-nowrap"
            >
              {t('authPages.reset.goHomeLogin')}
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
              <h2 className="text-2xl font-bold text-gray-900">{t('authPages.reset.title')}</h2>
              <p className="text-gray-500 text-sm mt-1">{t('authPages.reset.subtitle')}</p>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <i className="ri-error-warning-line text-red-500 flex-shrink-0"></i>
                <p className="text-sm text-red-700">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('authPages.reset.newPassword')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    placeholder={t('authPages.reset.newPasswordPlaceholder')}
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
                <p className="text-xs text-gray-400 mt-1">{t('authPages.reset.minChars')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('authPages.reset.confirmNewPassword')}</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    placeholder={t('authPages.reset.confirmNewPassword')}
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
                {saving ? t('common.saving') : t('authPages.reset.saveButton')}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
