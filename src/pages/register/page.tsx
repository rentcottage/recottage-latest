import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';
import { signUpWithEmail, signInWithGoogle, checkRegistrationAvailability, EMAIL_TAKEN_MESSAGE, PHONE_TAKEN_MESSAGE } from '../../hooks/useAuth';
import { normalizeGeoPhone, formatGeoPhone, sendPhoneOtp, verifyPhoneOtp } from '../../lib/otp';
import SEO from '../../components/feature/SEO';
import PasswordInput from '../../components/ui/PasswordInput';
import { useApprovedCount } from '../../hooks/useApprovedCount';
import { useT } from '../../i18n';

// Public hCaptcha sitekey for rentcottage.ge — validated server-side by Supabase.
const HCAPTCHA_SITE_KEY = '525e8946-9664-4210-8c24-6e9e1a4057ca';

export default function RegisterPage() {
  const { t, plural } = useT();
  const navigate = useNavigate();
  const { count } = useApprovedCount();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  // ── SMS verification ──────────────────────────────────────────────────────
  // Registration is two steps: fill the form, then prove the phone is yours.
  // Without this the number on the account is just a string someone typed, so
  // it can't be trusted for booking contact and can be claimed for anyone.
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  // Proof of the SMS check, handed to signUpWithEmail so the new account can
  // bind it server-side. Held in state so a retry after a failed create
  // (expired captcha, say) still has it without burning another SMS.
  const [otpClaimToken, setOtpClaimToken] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<HCaptchaLib>(null);
  const [socialLoading, setSocialLoading] = useState<'google' | null>(null);

  const set = (field: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Resend cooldown ticker — mirrors the 60s the SMS function enforces anyway.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('Please enter your first and last name.'); return; }
    if (!form.email.trim()) { setError('Please enter your email address.'); return; }
    const normalized = normalizeGeoPhone(form.phone);
    if (!normalized) { setError('Please enter a valid Georgian phone number (e.g. +995 555 12 34 56).'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError(t('auth.passwordMismatch')); return; }
    if (!form.acceptTerms) { setError('Please accept the Terms and Privacy Policy to continue.'); return; }
    // No captcha gate here — it lives on the verification step, which is the one
    // that actually creates the account.

    setLoading(true);
    try {
      // Availability is checked BEFORE the SMS goes out: an SMS costs money and
      // a duplicate signup can never succeed anyway, so there's no reason to
      // send one — and the visitor hears the real problem immediately.
      const { emailTaken, phoneTaken } = await checkRegistrationAvailability(form.email, normalized);
      if (emailTaken) { setError(EMAIL_TAKEN_MESSAGE); return; }
      if (phoneTaken) { setError(PHONE_TAKEN_MESSAGE); return; }

      const { ok, error: sendErr } = await sendPhoneOtp(normalized);
      if (!ok) {
        setError(sendErr ?? t('account.authModals.sendCodeFailedError'));
        return;
      }
      setOtpSentTo(normalized);
      setOtpCode('');
      setOtpError('');
      setOtpVerified(false);
      setResendIn(60);
      setStep('verify');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0 || !otpSentTo) return;
    setOtpError('');
    const { ok, error: err, cooldownSec } = await sendPhoneOtp(otpSentTo);
    if (!ok) {
      setOtpError(err ?? t('account.authModals.resendFailedError'));
      if (cooldownSec) setResendIn(cooldownSec);
      return;
    }
    setResendIn(60);
  };

  // ── Step 2: confirm the code, then create the account ─────────────────────
  const handleVerifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setError('');

    if (!captchaToken) { setOtpError(t('account.authModals.captchaRequiredError')); return; }

    setLoading(true);
    try {
      // Verify once and remember it: if account creation then fails (an expired
      // captcha, say), the visitor retries without burning another SMS.
      if (!otpVerified) {
        if (otpCode.replace(/\D/g, '').length !== 6) {
          setOtpError(t('account.authModals.enterSixDigitError'));
          return;
        }
        const v = await verifyPhoneOtp(otpSentTo, otpCode);
        if (!v.ok) {
          setOtpError(
            v.remaining != null
              ? `${v.error} ${plural('account.authModals.attemptsLeftCount', v.remaining)}`
              : (v.error ?? t('account.authModals.invalidCodeError')),
          );
          return;
        }
        setOtpClaimToken(v.claimToken ?? '');
        setOtpVerified(true);
      }

      const { error: err, confirmationRequired } = await signUpWithEmail(
        form.firstName,
        form.lastName,
        form.email,
        form.password,
        otpSentTo,
        captchaToken,
        true, // phone proven by SMS just now
        otpClaimToken,
      );
      if (err) {
        setOtpError(err);
        captchaRef.current?.resetCaptcha();
        setCaptchaToken('');
        return;
      }
      if (confirmationRequired) {
        setConfirmationSent(true);
        return;
      }
      navigate('/profile');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setSocialLoading('google');
    try {
      await signInWithGoogle();
    } catch {
      setSocialLoading(null);
      setError('Could not start Google sign-in. Please try again.');
    }
  };


  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Create an account — RentCottage.Ge"
        description="Create a RentCottage.Ge account to book cottages and list your own."
        canonical="/register"
        noIndex
      />
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-screen">
        {/* Left visual side */}
        <div
          className="hidden md:flex flex-col justify-between p-11 text-white"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,15,15,.35),rgba(15,15,15,.6)), url('/redesign/auth-cottage.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <button
            onClick={() => navigate('/')}
            translate="no"
            className="notranslate text-[22px] font-extrabold text-left cursor-pointer"
            style={{ fontFamily: '"Futura", "Arial", sans-serif' }}
          >
            Rent<span className="text-red-500">Cottage</span>.Ge
          </button>
          <div className="flex gap-3 flex-wrap text-[13px] font-semibold">
            <span className="bg-white/[0.14] border border-white/30 px-3.5 py-1.5 rounded-full">✓ {count !== null ? `${count} ` : ''}{t('auth.badgeVerified')}</span>
            <span className="bg-white/[0.14] border border-white/30 px-3.5 py-1.5 rounded-full">✓ {t('auth.badgeFreeCancellation')}</span>
            <span className="bg-white/[0.14] border border-white/30 px-3.5 py-1.5 rounded-full">✓ {t('auth.badgeSupport')}</span>
          </div>
        </div>

        {/* Right form side */}
        <div className="flex items-center justify-center px-6 py-11 bg-white">
          <div className="w-full max-w-[400px]">
            <button
              onClick={() => navigate('/')}
              translate="no"
              className="notranslate md:hidden block w-full text-center text-[21px] font-extrabold mb-6 cursor-pointer"
              style={{ fontFamily: '"Futura", "Arial", sans-serif' }}
            >
              Rent<span className="text-red-500">Cottage</span>.Ge
            </button>

            {confirmationSent ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <i className="ri-mail-check-line text-green-500 text-2xl"></i>
                </div>
                <h1 className="text-[22px] font-extrabold text-ink mb-1.5">Confirm your email</h1>
                <p className="text-sm text-soft mb-6">
                  We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="text-[13px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
                >
                  ← Back to log in
                </button>
              </div>
            ) : (
              <>
                {/* Pill tabs */}
                <div className="flex bg-[#fafafa] border-[1.5px] border-line rounded-full p-1.5 mb-6">
                  <button
                    onClick={() => navigate('/login')}
                    className="flex-1 py-2.5 rounded-full text-[14.5px] font-bold text-muted-foreground hover:text-ink transition-colors cursor-pointer"
                  >
                    {t('auth.login')}
                  </button>
                  <button className="flex-1 py-2.5 rounded-full text-[14.5px] font-bold bg-red-500 text-white cursor-pointer" aria-current="page">
                    {t('auth.register')}
                  </button>
                </div>

                <h1 className="text-[22px] font-extrabold text-ink mb-1.5">
                  {step === 'verify' ? t('account.authModals.verifyYourPhone') : t('auth.createAccount')}
                </h1>
                <p className="text-sm text-soft mb-5">
                  {step === 'verify'
                    ? `${t('account.authModals.weSentSixDigitCodePre')} ${formatGeoPhone(otpSentTo)}`
                    : t('auth.createAccountSub')}
                </p>

                {step === 'verify' ? (
                  <form onSubmit={handleVerifyAndCreate}>
                    {!otpVerified ? (
                      <>
                        <label className="block text-[12.5px] font-bold mb-1.5 text-center">
                          {t('account.authModals.verificationCode')}
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
                          className="w-full text-center tracking-[0.5em] text-lg font-semibold px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                        />
                        <div className="mt-2 text-center">
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={resendIn > 0}
                            className="text-[13px] font-bold text-red-500 hover:text-red-600 cursor-pointer disabled:text-gray-400 disabled:cursor-default"
                          >
                            {resendIn > 0
                              ? t('account.authModals.resendCodeIn', { seconds: resendIn })
                              : t('account.authModals.resendCode')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                        <i className="ri-checkbox-circle-line text-green-500"></i>
                        <p className="text-sm text-green-700">{t('account.authModals.phoneVerifiedNote')}</p>
                      </div>
                    )}

                    {/* CAPTCHA sits on the step that actually creates the account. */}
                    <div className="mt-4 flex justify-center">
                      <HCaptchaLib
                        ref={captchaRef}
                        sitekey={HCAPTCHA_SITE_KEY}
                        onVerify={(tok) => setCaptchaToken(tok)}
                        onExpire={() => setCaptchaToken('')}
                        onError={() => setCaptchaToken('')}
                      />
                    </div>

                    {otpError && <p className="mt-3 text-[13px] text-red-600">{otpError}</p>}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold rounded-xl py-3.5 text-[15.5px] mt-5 cursor-pointer transition-colors"
                    >
                      {loading ? t('auth.creatingAccount') : t('auth.registerBtn')}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setStep('form'); setOtpError(''); }}
                      className="w-full mt-3 text-[13px] font-bold text-soft hover:text-ink cursor-pointer"
                    >
                      ← {t('account.authModals.changeNumber')}
                    </button>
                  </form>
                ) : (
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12.5px] font-bold mb-1.5">{t('auth.firstName')} <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => set('firstName', e.target.value)}
                        placeholder="Nino"
                        className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[12.5px] font-bold mb-1.5">{t('auth.lastName')} <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => set('lastName', e.target.value)}
                        placeholder="Kapanadze"
                        className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                        required
                      />
                    </div>
                  </div>

                  <label className="block text-[12.5px] font-bold mt-3.5 mb-1.5">{t('auth.email')} <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="you@example.com"
                    className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                    required
                  />

                  <label className="block text-[12.5px] font-bold mt-3.5 mb-1.5">{t('auth.phone')} <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+995 5XX XX XX XX"
                    className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                    required
                  />

                  <label className="block text-[12.5px] font-bold mt-3.5 mb-1.5">{t('auth.password')} <span className="text-red-500">*</span></label>
                  <PasswordInput
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                    required
                  />

                  <label className="block text-[12.5px] font-bold mt-3.5 mb-1.5">{t('auth.confirmPassword')} <span className="text-red-500">*</span></label>
                  <PasswordInput
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                    required
                  />

                  <label className="flex items-start gap-2 mt-4 text-[13px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.acceptTerms}
                      onChange={(e) => set('acceptTerms', e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-red-500"
                    />
                    <span>
                      I agree to the{' '}
                      <button type="button" onClick={() => navigate('/terms')} className="text-red-500 font-bold cursor-pointer">Terms</button> and{' '}
                      <button type="button" onClick={() => navigate('/privacy')} className="text-red-500 font-bold cursor-pointer">Privacy Policy</button>
                    </span>
                  </label>

                  {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold rounded-xl py-3.5 text-[15.5px] mt-5 cursor-pointer transition-colors"
                  >
                    {loading ? t('account.authModals.sendingCodeEllipsis') : t('auth.registerBtn')}
                  </button>
                </form>
                )}

                <div className="flex items-center gap-3 my-5 text-soft text-[13px] before:content-[''] before:flex-1 before:h-px before:bg-line after:content-[''] after:flex-1 after:h-px after:bg-line">
                  {t('auth.orContinue')}
                </div>

                <div className="grid gap-2.5">
                  <button
                    onClick={handleGoogle}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-2.5 border-[1.5px] border-line rounded-xl py-3 text-[14.5px] font-bold text-ink hover:border-ink disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    <i className="ri-google-fill text-lg"></i>
                    {socialLoading === 'google' ? t('common.loading') : t('auth.continueGoogle')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
