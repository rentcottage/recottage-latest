import { useState, useEffect } from 'react';
import { sendPhoneOtp, verifyPhoneOtp, normalizeGeoPhone, formatGeoPhone } from '../../lib/otp';

interface Props {
  open: boolean;
  /** The signed-in user's id — verification stamps profiles.phone_verified for this id (server-side). */
  userId: string;
  /** Phone already on file, if any. The user can edit it before sending. */
  initialPhone?: string;
  title?: string;
  reason?: string;
  onVerified: (normalizedPhone: string) => void;
  /** If omitted, the modal cannot be dismissed (used as a hard gate). */
  onClose?: () => void;
}

/**
 * Reusable SMS phone-verification modal. Sends a code via the phone-otp Edge
 * Function, collects it, and on success the function sets phone_verified=true
 * for `userId`. Calls onVerified(normalizedPhone) when done.
 */
export default function PhoneVerifyModal({
  open,
  userId,
  initialPhone = '',
  title = 'Verify your phone',
  reason,
  onVerified,
  onClose,
}: Props) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Reset whenever the modal (re)opens.
  useEffect(() => {
    if (open) {
      setStep('phone');
      setPhone(initialPhone);
      setSentTo('');
      setCode('');
      setError('');
      setLoading(false);
      setResendIn(0);
    }
  }, [open, initialPhone]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  if (!open) return null;

  const doSend = async (target: string): Promise<void> => {
    const normalized = normalizeGeoPhone(target);
    if (!normalized) {
      setError('Please enter a valid Georgian phone number (e.g. +995 555 12 34 56).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { ok, error: err } = await sendPhoneOtp(normalized);
      if (!ok) {
        setError(err ?? 'Could not send the code. Please try again.');
        return;
      }
      setSentTo(normalized);
      setCode('');
      setResendIn(60);
      setStep('code');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    void doSend(phone);
  };

  const handleResend = () => {
    if (resendIn > 0) return;
    void doSend(sentTo);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.replace(/\D/g, '').length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const v = await verifyPhoneOtp(sentTo, code, userId);
      if (!v.ok) {
        setError(v.remaining != null ? `${v.error} ${v.remaining} attempt${v.remaining === 1 ? '' : 's'} left.` : (v.error ?? 'Invalid code.'));
        return;
      }
      onVerified(sentTo);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {step === 'code' && (
              <button
                onClick={() => { setStep('phone'); setError(''); }}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-arrow-left-line text-lg"></i>
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          )}
        </div>

        {reason && <p className="text-sm text-gray-500 mb-5 leading-relaxed">{reason}</p>}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <i className="ri-error-warning-line text-red-500 mt-0.5 flex-shrink-0"></i>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <i className="ri-phone-line text-gray-400 text-sm"></i>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+995 555 12 34 56"
                  autoFocus
                  className="w-full pl-9 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">We&apos;ll text you a 6-digit code.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              Enter the 6-digit code sent to{' '}
              <span className="font-medium text-gray-700">{formatGeoPhone(sentTo)}</span>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              autoFocus
              className="w-full text-center tracking-[0.5em] text-lg font-semibold p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendIn > 0}
                className="text-sm text-red-500 hover:text-red-600 cursor-pointer disabled:text-gray-400 disabled:cursor-default"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Verify & continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
