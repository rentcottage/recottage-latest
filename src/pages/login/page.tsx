import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';
import { signInWithEmail, signInWithGoogle, sendPasswordReset } from '../../hooks/useAuth';
import SEO from '../../components/feature/SEO';
import { useApprovedCount } from '../../hooks/useApprovedCount';

// Public hCaptcha sitekey for rentcottage.ge — validated server-side by Supabase.
const HCAPTCHA_SITE_KEY = '525e8946-9664-4210-8c24-6e9e1a4057ca';

type View = 'login' | 'forgot' | 'forgot-sent';

export default function LoginPage() {
  const navigate = useNavigate();
  const { count } = useApprovedCount();
  const [view, setView] = useState<View>('login');

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<HCaptchaLib>(null);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotToken, setForgotToken] = useState('');
  const forgotCaptchaRef = useRef<HCaptchaLib>(null);

  const [socialLoading, setSocialLoading] = useState<'google' | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      setError('Please complete the CAPTCHA verification.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: err } = await signInWithEmail(form.email, form.password, captchaToken);
      if (err) {
        setError(err);
        captchaRef.current?.resetCaptcha();
        setCaptchaToken('');
        return;
      }
      navigate('/profile');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address.');
      return;
    }
    if (!forgotToken) {
      setForgotError('Please complete the CAPTCHA verification.');
      return;
    }
    setForgotLoading(true);
    try {
      const { error: err } = await sendPasswordReset(forgotEmail, forgotToken);
      if (err) {
        setForgotError(err);
        forgotCaptchaRef.current?.resetCaptcha();
        setForgotToken('');
        return;
      }
      setView('forgot-sent');
    } finally {
      setForgotLoading(false);
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
        title="Log in — RentCottage.Ge"
        description="Log in to your RentCottage.Ge account to manage bookings and list your cottage."
        canonical="/login"
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

            {/* Pill tabs */}
            <div className="flex bg-[#fafafa] border-[1.5px] border-line rounded-full p-1.5 mb-6">
              <button className="flex-1 py-2.5 rounded-full text-[14.5px] font-bold bg-red-500 text-white cursor-pointer" aria-current="page">
                Log in
              </button>
              <button
                onClick={() => navigate('/register')}
                className="flex-1 py-2.5 rounded-full text-[14.5px] font-bold text-muted-foreground hover:text-ink transition-colors cursor-pointer"
              >
                Register
              </button>
            </div>

            {view === 'login' && (
              <>
                <h1 className="text-[22px] font-extrabold text-ink mb-1.5">Welcome back 👋</h1>
                <p className="text-sm text-soft mb-5">Log in to manage your bookings and listings</p>

                <form onSubmit={handleLogin}>
                  <label className="block text-[12.5px] font-bold mt-3.5 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                    required
                  />
                  <label className="block text-[12.5px] font-bold mt-3.5 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setError(''); }}
                    className="block ml-auto mt-2 text-[12.5px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
                  >
                    Forgot password?
                  </button>

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
                    {loading ? 'Logging in…' : 'Log in'}
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

                <p className="text-[12.5px] text-soft text-center mt-3.5">
                  By continuing you agree to our{' '}
                  <button onClick={() => navigate('/terms')} className="text-red-500 font-bold cursor-pointer">Terms</button> and{' '}
                  <button onClick={() => navigate('/privacy')} className="text-red-500 font-bold cursor-pointer">Privacy Policy</button>
                </p>
              </>
            )}

            {view === 'forgot' && (
              <>
                <h1 className="text-[22px] font-extrabold text-ink mb-1.5">Reset your password</h1>
                <p className="text-sm text-soft mb-5">We&apos;ll email you a secure reset link</p>
                <form onSubmit={handleForgot}>
                  <label className="block text-[12.5px] font-bold mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full text-[15px] px-3.5 py-3 border-[1.5px] border-line rounded-xl outline-none focus:border-red-500"
                    required
                  />
                  <div className="mt-4">
                    <HCaptchaLib
                      ref={forgotCaptchaRef}
                      sitekey={HCAPTCHA_SITE_KEY}
                      onVerify={(t) => setForgotToken(t)}
                      onExpire={() => setForgotToken('')}
                    />
                  </div>
                  {forgotError && <p className="mt-3 text-[13px] text-red-600">{forgotError}</p>}
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold rounded-xl py-3.5 text-[15.5px] mt-5 cursor-pointer transition-colors"
                  >
                    {forgotLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
                <button
                  onClick={() => { setView('login'); setForgotError(''); }}
                  className="block mx-auto mt-4 text-[13px] font-bold text-muted-foreground hover:text-ink cursor-pointer"
                >
                  ← Back to log in
                </button>
              </>
            )}

            {view === 'forgot-sent' && (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <i className="ri-mail-check-line text-green-500 text-2xl"></i>
                </div>
                <h1 className="text-[22px] font-extrabold text-ink mb-1.5">Check your email</h1>
                <p className="text-sm text-soft mb-6">
                  If an account exists for <strong>{forgotEmail}</strong>, a reset link is on its way.
                </p>
                <button
                  onClick={() => { setView('login'); setForgotEmail(''); }}
                  className="text-[13px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
                >
                  ← Back to log in
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
