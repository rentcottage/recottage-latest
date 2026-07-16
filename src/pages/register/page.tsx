import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';
import { signUpWithEmail, signInWithGoogle } from '../../hooks/useAuth';
import { normalizeGeoPhone } from '../../lib/otp';
import SEO from '../../components/feature/SEO';
import { useApprovedCount } from '../../hooks/useApprovedCount';

// Public hCaptcha sitekey for rentcottage.ge — validated server-side by Supabase.
const HCAPTCHA_SITE_KEY = '525e8946-9664-4210-8c24-6e9e1a4057ca';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { count } = useApprovedCount();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    acceptTerms: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<HCaptchaLib>(null);
  const [socialLoading, setSocialLoading] = useState<'google' | null>(null);

  const set = (field: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('Please enter your first and last name.'); return; }
    if (!form.email.trim()) { setError('Please enter your email address.'); return; }
    const normalized = normalizeGeoPhone(form.phone);
    if (!normalized) { setError('Please enter a valid Georgian phone number (e.g. +995 555 12 34 56).'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (!form.acceptTerms) { setError('Please accept the Terms and Privacy Policy to continue.'); return; }
    if (!captchaToken) { setError('Please complete the CAPTCHA verification.'); return; }

    setLoading(true);
    try {
      const { error: err, confirmationRequired } = await signUpWithEmail(
        form.firstName,
        form.lastName,
        form.email,
        form.password,
        normalized,
        captchaToken,
      );
      if (err) {
        setError(err);
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
              "linear-gradient(rgba(15,15,15,.55),rgba(15,15,15,.55)), url('/redesign/region-gudauri.jpg')",
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
            <span className="bg-white/[0.14] border border-white/30 px-3.5 py-1.5 rounded-full">✓ {count !== null ? `${count} ` : ''}verified cottages</span>
            <span className="bg-white/[0.14] border border-white/30 px-3.5 py-1.5 rounded-full">✓ Free cancellation</span>
            <span className="bg-white/[0.14] border border-white/30 px-3.5 py-1.5 rounded-full">✓ Support in Georgian</span>
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
                    Log in
                  </button>
                  <button className="flex-1 py-2.5 rounded-full text-[14.5px] font-bold bg-red-500 text-white cursor-pointer" aria-current="page">
                    Register
                  </button>
                </div>

                <h1 className="text-[22px] font-extrabold text-ink mb-1.5">Create your account</h1>
                <p className="text-sm text-soft mb-5">Join to book cottages and list your own</p>

                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12.5px] font-bold mb-1.5">First name <span className="text-red-500">*</span></label>
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
                      <label className="block text-[12.5px] font-bold mb-1.5">Last name <span className="text-red-500">*</span></label>
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

                  <label className="block text-[12.5px] font-bold mt-3.5 mb-1.5">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="you@example.com"
                    className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                    required
                  />

                  <label className="block text-[12.5px] font-bold mt-3.5 mb-1.5">Phone <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+995 5XX XX XX XX"
                    className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                    required
                  />

                  <label className="block text-[12.5px] font-bold mt-3.5 mb-1.5">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder="At least 6 characters"
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

                  <div className="mt-4">
                    <HCaptchaLib
                      ref={captchaRef}
                      sitekey={HCAPTCHA_SITE_KEY}
                      onVerify={(t) => setCaptchaToken(t)}
                      onExpire={() => setCaptchaToken('')}
                    />
                  </div>

                  {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold rounded-xl py-3.5 text-[15.5px] mt-5 cursor-pointer transition-colors"
                  >
                    {loading ? 'Creating account…' : 'Create account'}
                  </button>
                </form>

                <div className="flex items-center gap-3 my-5 text-soft text-[13px] before:content-[''] before:flex-1 before:h-px before:bg-line after:content-[''] after:flex-1 after:h-px after:bg-line">
                  or continue
                </div>

                <div className="grid gap-2.5">
                  <button
                    onClick={handleGoogle}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-2.5 border-[1.5px] border-line rounded-xl py-3 text-[14.5px] font-bold text-ink hover:border-ink disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    <i className="ri-google-fill text-lg"></i>
                    {socialLoading === 'google' ? 'Connecting…' : 'Continue with Google'}
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
