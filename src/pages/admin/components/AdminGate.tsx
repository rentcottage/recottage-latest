import { useState, useRef, useEffect } from 'react';

const ADMIN_FN_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-user-management`;
const PW_KEY = 'rc_admin_pw';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes

interface Props {
  children: React.ReactNode;
}

// The admin password is verified server-side and held (session-scoped) so the
// panel can authorize its API calls. It is never hard-coded in the bundle.
function isAuthed() {
  return !!sessionStorage.getItem(PW_KEY);
}

export default function AdminGate({ children }: Props) {
  const [authed, setAuthed] = useState(isAuthed);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authed) inputRef.current?.focus();
  }, [authed]);

  // Countdown timer when locked out
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = setInterval(() => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        setRemaining(0);
        clearInterval(tick);
      } else {
        setRemaining(left);
      }
    }, 500);
    return () => clearInterval(tick);
  }, [lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil || verifying) return;

    setVerifying(true);
    try {
      const res = await fetch(ADMIN_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-admin', adminPassword: value }),
      });

      if (res.ok) {
        // Hold the password (session-scoped) so the panel can authorize its calls.
        sessionStorage.setItem(PW_KEY, value);
        setAuthed(true);
        setError('');
        setAttempts(0);
        return;
      }

      // 401 = wrong password; anything else is a server/network problem.
      if (res.status === 401) {
        const next = attempts + 1;
        setAttempts(next);
        setValue('');
        if (next >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MS;
          setLockedUntil(until);
          setRemaining(Math.ceil(LOCKOUT_MS / 1000));
          setError('Too many failed attempts. Access locked for 2 minutes.');
        } else {
          setError(`Incorrect password. ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? '' : 's'} remaining.`);
        }
      } else {
        setError('Could not verify right now. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (authed) {
    return (
      <>
        {children}
        {/* Subtle sign-out button */}
        <button
          onClick={() => {
            sessionStorage.removeItem(PW_KEY);
            setAuthed(false);
            setValue('');
            setError('');
          }}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-lg cursor-pointer whitespace-nowrap transition-colors"
        >
          <div className="w-3 h-3 flex items-center justify-center">
            <i className="ri-logout-box-r-line"></i>
          </div>
          Lock Admin
        </button>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-red-500 rounded-2xl flex items-center justify-center mb-4">
            <div className="w-7 h-7 flex items-center justify-center">
              <i className="ri-lock-2-line text-white text-2xl"></i>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Admin Access</h1>
          <p className="text-sm text-gray-400 mt-1">RentCottage.Ge</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPw ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error && !lockedUntil) setError('');
                  }}
                  disabled={!!lockedUntil}
                  placeholder="Enter admin password"
                  className={`w-full px-4 py-3 pr-11 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
                    error
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-gray-200 focus:ring-red-200 focus:border-red-300'
                  } ${lockedUntil ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  tabIndex={-1}
                >
                  <i className={showPw ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'}></i>
                </button>
              </div>
            </div>

            {/* Error / lockout message */}
            {(error || lockedUntil) && (
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs ${
                lockedUntil ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-600 border border-red-100'
              }`}>
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className={lockedUntil ? 'ri-time-line' : 'ri-error-warning-line'}></i>
                </div>
                <span>
                  {lockedUntil
                    ? `Too many failed attempts. Try again in ${remaining}s.`
                    : error}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={!value.trim() || !!lockedUntil || verifying}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className={verifying ? 'ri-loader-4-line animate-spin' : 'ri-shield-check-line'}></i>
              </div>
              {verifying ? 'Verifying…' : 'Unlock Admin Panel'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Access is session-scoped and expires when the tab is closed.
        </p>
      </div>
    </div>
  );
}
