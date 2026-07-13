import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';
import {
  signInWithGoogle,
  signInWithFacebook,
  signUpWithEmail,
  signInWithEmail,
  sendPasswordReset,
} from '../../hooks/useAuth';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { sendPhoneOtp, verifyPhoneOtp, normalizeGeoPhone, formatGeoPhone } from '../../lib/otp';
import { useTranslation } from '@lib/i18n';

// Real hCaptcha sitekey for rentcottage.ge — public value, safe to commit.
// Validated server-side by Supabase using the matching secret stored in
// Auth → Attack Protection → Captcha (env-only, never in code).
const HCAPTCHA_SITE_KEY = '525e8946-9664-4210-8c24-6e9e1a4057ca';

interface AuthModalsProps {
  showLogin: boolean;
  showSignup: boolean;
  onCloseLogin: () => void;
  onCloseSignup: () => void;
  onSwitchToSignup: () => void;
  onSwitchToLogin: () => void;
  onSuccess?: () => void;
}

type LoginView = 'login' | 'forgot' | 'forgot-sent';
type SignupStep = 'details' | 'verify';

export default function AuthModals({
  showLogin,
  showSignup,
  onCloseLogin,
  onCloseSignup,
  onSwitchToSignup,
  onSwitchToLogin,
  onSuccess,
}: AuthModalsProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Login / forgot state
  const [loginView, setLoginView] = useState<LoginView>('login');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginCaptchaToken, setLoginCaptchaToken] = useState('');
  const loginCaptchaRef = useRef<HCaptchaLib>(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotCaptchaToken, setForgotCaptchaToken] = useState('');
  const forgotCaptchaRef = useRef<HCaptchaLib>(null);

  // Signup state
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [signupCaptchaToken, setSignupCaptchaToken] = useState('');
  const signupCaptchaRef = useRef<HCaptchaLib>(null);
  const [signupForm, setSignupForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });

  // Phone-verification (step 2) state
  const [signupStep, setSignupStep] = useState<SignupStep>('details');
  const [otpSentTo, setOtpSentTo] = useState('');   // normalized 995… number
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Resend cooldown ticker
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const resetLoginState = () => {
    setLoginView('login');
    setLoginError('');
    setForgotEmail('');
    setForgotError('');
    setForgotCaptchaToken('');
    forgotCaptchaRef.current?.resetCaptcha();
    setLoginForm({ email: '', password: '' });
    setLoginCaptchaToken('');
    loginCaptchaRef.current?.resetCaptcha();
  };

  const resetSignupState = () => {
    setSignupError('');
    setSignupLoading(false);
    setConfirmationSent(false);
    setConfirmedEmail('');
    setSignupStep('details');
    setOtpSentTo('');
    setOtpCode('');
    setOtpError('');
    setOtpVerified(false);
    setResendIn(0);
    setSignupCaptchaToken('');
    signupCaptchaRef.current?.resetCaptcha();
    setSignupForm({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', acceptTerms: false });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCaptchaToken) {
      setLoginError(t('auth.errors.captchaRequired'));
      return;
    }
    setLoginError('');
    setLoginLoading(true);
    try {
      const { error } = await signInWithEmail(loginForm.email, loginForm.password, loginCaptchaToken);
      if (error) {
        setLoginError(error);
        loginCaptchaRef.current?.resetCaptcha();
        setLoginCaptchaToken('');
        return;
      }
      setLoginForm({ email: '', password: '' });
      onCloseLogin();
      resetLoginState();
      onSuccess?.();
      navigate('/profile');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.trim()) {
      setForgotError(t('auth.errors.emailRequired'));
      return;
    }
    if (!forgotCaptchaToken) {
      setForgotError(t('auth.errors.captchaRequired'));
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await sendPasswordReset(forgotEmail, forgotCaptchaToken);
      if (error) {
        setForgotError(error);
        forgotCaptchaRef.current?.resetCaptcha();
        setForgotCaptchaToken('');
        return;
      }
      setLoginView('forgot-sent');
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Step 1: validate details, then text a verification code ──────────────────
  const handleSignupDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');

    if (!signupForm.firstName.trim() || !signupForm.lastName.trim()) {
      setSignupError(t('auth.errors.nameRequired'));
      return;
    }
    if (!signupForm.email.trim()) {
      setSignupError(t('auth.errors.emailRequired'));
      return;
    }
    const normalized = normalizeGeoPhone(signupForm.phone);
    if (!normalized) {
      setSignupError(t('phoneVerify.invalidPhone'));
      return;
    }
    if (signupForm.password.length < 8) {
      setSignupError(t('auth.errors.passwordTooShort'));
      return;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      setSignupError(t('auth.errors.passwordsMismatch'));
      return;
    }
    if (!signupForm.acceptTerms) {
      setSignupError(t('auth.errors.acceptTermsRequired'));
      return;
    }

    setSignupLoading(true);
    try {
      const { ok, error } = await sendPhoneOtp(normalized);
      if (!ok) {
        setSignupError(error ?? t('auth.errors.otpSendFailed'));
        return;
      }
      setOtpSentTo(normalized);
      setOtpCode('');
      setOtpError('');
      setOtpVerified(false);
      setResendIn(60);
      setSignupStep('verify');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0 || !otpSentTo) return;
    setOtpError('');
    const { ok, error, cooldownSec } = await sendPhoneOtp(otpSentTo);
    if (!ok) {
      setOtpError(error ?? t('auth.errors.otpResendFailed'));
      if (cooldownSec) setResendIn(cooldownSec);
      return;
    }
    setResendIn(60);
  };

  // ── Step 2: verify the code, then create the account ─────────────────────────
  const handleSignupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setSignupError('');

    if (!signupCaptchaToken) {
      setOtpError(t('auth.errors.captchaRequired'));
      return;
    }

    setSignupLoading(true);
    try {
      // Verify the SMS code once; if account creation later fails (e.g. captcha
      // expiry), we keep `otpVerified` so the user can retry without re-entering it.
      if (!otpVerified) {
        if (otpCode.replace(/\D/g, '').length !== 6) {
          setOtpError(t('phoneVerify.enterCode'));
          return;
        }
        const v = await verifyPhoneOtp(otpSentTo, otpCode);
        if (!v.ok) {
          setOtpError(
            v.remaining != null
              ? `${v.error} ${t('phoneVerify.attemptsLeft', { count: v.remaining })}`
              : (v.error ?? t('phoneVerify.invalidCode')),
          );
          return;
        }
        setOtpVerified(true);
      }

      const { session, error, confirmationRequired } = await signUpWithEmail(
        signupForm.firstName,
        signupForm.lastName,
        signupForm.email,
        signupForm.password,
        otpSentTo,
        signupCaptchaToken,
        true, // phone verified via SMS
      );

      if (error) {
        // hCaptcha tokens are single-use / short-lived — let the user re-solve.
        signupCaptchaRef.current?.resetCaptcha();
        setSignupCaptchaToken('');
        setOtpError(
          error === 'User already registered'
            ? t('auth.errors.emailExists')
            : error,
        );
        return;
      }

      if (confirmationRequired) {
        setConfirmedEmail(signupForm.email);
        setConfirmationSent(true);
        return;
      }

      if (session) {
        onCloseSignup();
        resetSignupState();
        onSuccess?.();
        navigate('/profile');
      } else {
        setOtpError(t('auth.errors.generic'));
      }
    } finally {
      setSignupLoading(false);
    }
  };

  const handleGoogle = async () => {
    setSocialLoading('google');
    try {
      await signInWithGoogle();
    } finally {
      setSocialLoading(null);
    }
  };

  const handleFacebook = async () => {
    setSocialLoading('facebook');
    try {
      await signInWithFacebook();
    } finally {
      setSocialLoading(null);
    }
  };

  const SocialButtons = () => (
    <div className="space-y-3">
      <button
        onClick={handleGoogle}
        disabled={!!socialLoading}
        className="w-full flex items-center justify-center px-4 py-3 border-[1.5px] border-line rounded-xl hover:border-ink font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
      >
        {socialLoading === 'google' ? (
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-3"></div>
        ) : (
          <div className="w-5 h-5 flex items-center justify-center mr-3">
            <i className="ri-google-fill text-red-500"></i>
          </div>
        )}
        {t('auth.continueWithGoogle')}
      </button>
      {FEATURE_FLAGS.ENABLE_FACEBOOK_LOGIN && (
        <button
          onClick={handleFacebook}
          disabled={!!socialLoading}
          className="w-full flex items-center justify-center px-4 py-3 border-[1.5px] border-line rounded-xl hover:border-ink font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
        >
          {socialLoading === 'facebook' ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-3"></div>
          ) : (
            <div className="w-5 h-5 flex items-center justify-center mr-3">
              <i className="ri-facebook-fill text-blue-600"></i>
            </div>
          )}
          {t('auth.continueWithFacebook')}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* ── LOGIN MODAL ── */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-card max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">

              {/* ── Forgot password — sent confirmation ── */}
              {loginView === 'forgot-sent' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">{t('auth.checkYourEmail')}</h2>
                    <button
                      onClick={() => { onCloseLogin(); resetLoginState(); }}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <i className="ri-close-line text-xl"></i>
                    </button>
                  </div>
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-mail-send-line text-green-500 text-2xl"></i>
                    </div>
                    <p className="text-gray-600 text-sm mb-1">
                      {t('auth.forgot.sentLinkTo')}
                    </p>
                    <p className="font-semibold text-gray-900 mb-5">{forgotEmail}</p>
                    <p className="text-gray-400 text-xs mb-6">
                      {t('auth.forgot.sentInstructions')}
                    </p>
                    <button
                      onClick={() => setLoginView('login')}
                      className="text-sm text-red-500 hover:text-red-600 cursor-pointer"
                    >
                      {t('auth.backToLogin')}
                    </button>
                  </div>
                </>
              )}

              {/* ── Forgot password — email entry ── */}
              {loginView === 'forgot' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setLoginView('login'); setForgotError(''); setForgotCaptchaToken(''); forgotCaptchaRef.current?.resetCaptcha(); }}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <i className="ri-arrow-left-line text-lg"></i>
                      </button>
                      <h2 className="text-2xl font-bold text-gray-900">{t('auth.forgot.title')}</h2>
                    </div>
                    <button
                      onClick={() => { onCloseLogin(); resetLoginState(); }}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <i className="ri-close-line text-xl"></i>
                    </button>
                  </div>

                  <p className="text-sm text-gray-500 mb-5">
                    {t('auth.forgot.description')}
                  </p>

                  {forgotError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                      <i className="ri-error-warning-line text-red-500"></i>
                      <p className="text-sm text-red-700">{forgotError}</p>
                    </div>
                  )}

                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.emailAddress')}</label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                        placeholder={t('auth.emailPlaceholder')}
                        autoFocus
                      />
                    </div>

                    {/* CAPTCHA */}
                    <div className="flex justify-center">
                      <HCaptchaLib
                        ref={forgotCaptchaRef}
                        sitekey={HCAPTCHA_SITE_KEY}
                        onVerify={(token) => setForgotCaptchaToken(token)}
                        onExpire={() => setForgotCaptchaToken('')}
                        onError={() => setForgotCaptchaToken('')}
                        theme="light"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading || !forgotCaptchaToken}
                      className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                    >
                      {forgotLoading ? t('common.sending') : t('auth.forgot.submit')}
                    </button>
                  </form>

                  <p className="mt-4 text-center text-sm text-gray-500">
                    {t('auth.rememberPassword')}{' '}
                    <button
                      onClick={() => { setLoginView('login'); setForgotError(''); setForgotCaptchaToken(''); forgotCaptchaRef.current?.resetCaptcha(); }}
                      className="text-red-500 hover:text-red-600 cursor-pointer"
                    >
                      {t('header.login')}
                    </button>
                  </p>
                </>
              )}

              {/* ── Normal login ── */}
              {loginView === 'login' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">{t('header.login')}</h2>
                    <button
                      onClick={() => { onCloseLogin(); resetLoginState(); }}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <i className="ri-close-line text-xl"></i>
                    </button>
                  </div>

                  {/* Pill tabs */}
                  <div className="flex bg-[#fafafa] border-[1.5px] border-line rounded-full p-1.5 mb-6">
                    <button type="button" className="flex-1 rounded-full py-2.5 text-sm font-bold bg-red-500 text-white">{t('header.login')}</button>
                    <button type="button" onClick={onSwitchToSignup} className="flex-1 rounded-full py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 cursor-pointer transition-colors">{t('header.signup')}</button>
                  </div>

                  <SocialButtons />

                  <div className="my-5 flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <span className="text-xs text-gray-400">{t('auth.orContinueWithEmail')}</span>
                    <div className="flex-1 h-px bg-gray-200"></div>
                  </div>

                  {loginError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                      <i className="ri-error-warning-line text-red-500"></i>
                      <p className="text-sm text-red-700">{loginError}</p>
                    </div>
                  )}

                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.emailAddress')}</label>
                      <input
                        type="email"
                        required
                        value={loginForm.email}
                        onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                        className="w-full px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                        placeholder={t('auth.emailPlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.passwordLabel')}</label>
                      <input
                        type="password"
                        required
                        value={loginForm.password}
                        onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                        className="w-full px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                        placeholder={t('auth.passwordPlaceholder')}
                      />
                    </div>

                    {/* CAPTCHA */}
                    <div className="flex justify-center">
                      <HCaptchaLib
                        ref={loginCaptchaRef}
                        sitekey={HCAPTCHA_SITE_KEY}
                        onVerify={(token) => setLoginCaptchaToken(token)}
                        onExpire={() => setLoginCaptchaToken('')}
                        onError={() => setLoginCaptchaToken('')}
                        theme="light"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading || !loginCaptchaToken}
                      className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                    >
                      {loginLoading ? t('auth.loggingIn') : t('header.login')}
                    </button>
                  </form>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {t('auth.noAccount')}{' '}
                      <button onClick={onSwitchToSignup} className="text-red-500 hover:text-red-600 cursor-pointer">
                        {t('header.signup')}
                      </button>
                    </p>
                    <button
                      onClick={() => { setLoginView('forgot'); setLoginError(''); }}
                      className="text-sm text-red-500 hover:text-red-600 cursor-pointer whitespace-nowrap"
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── SIGNUP MODAL ── */}
      {showSignup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-card max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">

              {/* ── Email confirmation sent ── */}
              {confirmationSent ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">{t('auth.checkYourEmail')}</h2>
                    <button
                      onClick={() => { onCloseSignup(); resetSignupState(); }}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <i className="ri-close-line text-xl"></i>
                    </button>
                  </div>
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-mail-send-line text-green-500 text-2xl"></i>
                    </div>
                    <p className="text-gray-600 text-sm mb-1">
                      {t('auth.signup.sentConfirmationTo')}
                    </p>
                    <p className="font-semibold text-gray-900 mb-5">{confirmedEmail}</p>
                    <p className="text-gray-500 text-sm mb-6">
                      {t('auth.signup.confirmationInstructions')}
                    </p>
                    <button
                      onClick={() => {
                        resetSignupState();
                        onCloseSignup();
                        onSwitchToLogin();
                      }}
                      className="text-sm text-red-500 hover:text-red-600 cursor-pointer"
                    >
                      {t('auth.backToLogin')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      {signupStep === 'verify' && (
                        <button
                          onClick={() => {
                            setSignupStep('details');
                            setOtpCode('');
                            setOtpError('');
                            setOtpVerified(false);
                            setSignupCaptchaToken('');
                            signupCaptchaRef.current?.resetCaptcha();
                          }}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          <i className="ri-arrow-left-line text-lg"></i>
                        </button>
                      )}
                      <h2 className="text-2xl font-bold text-gray-900">
                        {signupStep === 'verify' ? t('phoneVerify.title') : t('auth.signup.createAccount')}
                      </h2>
                    </div>
                    <button
                      onClick={() => { onCloseSignup(); resetSignupState(); }}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <i className="ri-close-line text-xl"></i>
                    </button>
                  </div>

                  {/* ── STEP 1: details ── */}
                  {signupStep === 'details' && (
                    <>
                      {/* Pill tabs */}
                      <div className="flex bg-[#fafafa] border-[1.5px] border-line rounded-full p-1.5 mb-6">
                        <button type="button" onClick={onSwitchToLogin} className="flex-1 rounded-full py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 cursor-pointer transition-colors">{t('header.login')}</button>
                        <button type="button" className="flex-1 rounded-full py-2.5 text-sm font-bold bg-red-500 text-white">{t('header.signup')}</button>
                      </div>

                      <SocialButtons />

                      <div className="my-5 flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200"></div>
                        <span className="text-xs text-gray-400">{t('auth.orSignupWithEmail')}</span>
                        <div className="flex-1 h-px bg-gray-200"></div>
                      </div>

                      {signupError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                          <i className="ri-error-warning-line text-red-500 mt-0.5 flex-shrink-0"></i>
                          <p className="text-sm text-red-700">{signupError}</p>
                        </div>
                      )}

                      <form onSubmit={handleSignupDetails} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.firstName')}</label>
                            <input
                              type="text"
                              required
                              value={signupForm.firstName}
                              onChange={(e) => setSignupForm((p) => ({ ...p, firstName: e.target.value }))}
                              className="w-full px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                              placeholder={t('common.firstName')}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.lastName')}</label>
                            <input
                              type="text"
                              required
                              value={signupForm.lastName}
                              onChange={(e) => setSignupForm((p) => ({ ...p, lastName: e.target.value }))}
                              className="w-full px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                              placeholder={t('common.lastName')}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.emailAddress')}</label>
                          <input
                            type="email"
                            required
                            value={signupForm.email}
                            onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))}
                            className="w-full px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                            placeholder={t('auth.emailPlaceholder')}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('common.phoneNumber')} <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                              <i className="ri-phone-line text-gray-400 text-sm"></i>
                            </div>
                            <input
                              type="tel"
                              required
                              value={signupForm.phone}
                              onChange={(e) => setSignupForm((p) => ({ ...p, phone: e.target.value }))}
                              className="w-full pl-9 pr-3 py-3 border-[1.5px] border-line rounded-xl outline-none text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                              placeholder={t('phoneVerify.phonePlaceholder')}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{t('auth.signup.phoneHint')}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.passwordLabel')}</label>
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={signupForm.password}
                            onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))}
                            className="w-full px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                            placeholder={t('auth.signup.passwordPlaceholder')}
                          />
                          <p className="text-xs text-gray-400 mt-1">{t('auth.signup.passwordHint')}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.signup.confirmPasswordLabel')}</label>
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={signupForm.confirmPassword}
                            onChange={(e) => setSignupForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                            className="w-full px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                            placeholder={t('auth.signup.confirmPasswordPlaceholder')}
                          />
                        </div>
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            id="acceptTerms"
                            checked={signupForm.acceptTerms}
                            onChange={(e) => setSignupForm((p) => ({ ...p, acceptTerms: e.target.checked }))}
                            className="mt-1 w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                            required
                          />
                          <label htmlFor="acceptTerms" className="ml-2 text-sm text-gray-600">
                            {t('auth.signup.agreePrefix')}{' '}
                            <span className="text-red-500 cursor-pointer">{t('auth.signup.termsOfService')}</span>
                            {' '}{t('auth.signup.and')}{' '}
                            <span className="text-red-500 cursor-pointer">{t('auth.signup.privacyPolicy')}</span>
                          </label>
                        </div>

                        <button
                          type="submit"
                          disabled={signupLoading}
                          className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                        >
                          {signupLoading ? t('auth.signup.sendingCode') : t('common.continue')}
                        </button>
                      </form>

                      <p className="mt-4 text-center text-sm text-gray-600">
                        {t('auth.haveAccount')}{' '}
                        <button onClick={onSwitchToLogin} className="text-red-500 hover:text-red-600 cursor-pointer">
                          {t('header.login')}
                        </button>
                      </p>
                    </>
                  )}

                  {/* ── STEP 2: phone verification ── */}
                  {signupStep === 'verify' && (
                    <form onSubmit={handleSignupVerify} className="space-y-4">
                      <p className="text-sm text-gray-500 text-center leading-relaxed">
                        {t('auth.signup.codeSentTo')}{' '}
                        <span className="font-medium text-gray-700">{formatGeoPhone(otpSentTo)}</span>.
                      </p>

                      {otpError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                          <i className="ri-error-warning-line text-red-500 mt-0.5 flex-shrink-0"></i>
                          <p className="text-sm text-red-700">{otpError}</p>
                        </div>
                      )}

                      {!otpVerified ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                            {t('phoneVerify.codeLabel')}
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="••••••"
                            autoFocus
                            className="w-full text-center tracking-[0.5em] text-lg font-semibold p-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                          />
                          <div className="mt-2 text-center">
                            <button
                              type="button"
                              onClick={handleResendOtp}
                              disabled={resendIn > 0}
                              className="text-sm text-red-500 hover:text-red-600 cursor-pointer disabled:text-gray-400 disabled:cursor-default"
                            >
                              {resendIn > 0 ? t('phoneVerify.resendIn', { seconds: resendIn }) : t('phoneVerify.resend')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                          <i className="ri-checkbox-circle-line text-green-500"></i>
                          <p className="text-sm text-green-700">{t('auth.signup.phoneVerifiedCaptcha')}</p>
                        </div>
                      )}

                      {/* CAPTCHA — final gate before the account is created */}
                      <div className="flex justify-center">
                        <HCaptchaLib
                          ref={signupCaptchaRef}
                          sitekey={HCAPTCHA_SITE_KEY}
                          onVerify={(token) => setSignupCaptchaToken(token)}
                          onExpire={() => setSignupCaptchaToken('')}
                          onError={() => setSignupCaptchaToken('')}
                          theme="light"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={signupLoading || !signupCaptchaToken || (!otpVerified && otpCode.length !== 6)}
                        className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                      >
                        {signupLoading ? t('auth.signup.creatingAccount') : t('auth.signup.createAccount')}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
