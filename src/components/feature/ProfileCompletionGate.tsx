import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import PhoneVerifyModal from './PhoneVerifyModal';
import { useTranslation } from '@lib/i18n';

interface Props {
  children: React.ReactNode;
}

type Step = 'name' | 'phone';

interface MissingFields {
  firstName: boolean;
  lastName: boolean;
  phone: boolean;
}

/**
 * ProfileCompletionGate
 *
 * Shows a blocking modal when a logged-in Google/OAuth user is missing:
 * - first name and/or last name (shown first)
 * - a *verified* phone number (shown after name is complete)
 *
 * The phone step runs SMS verification (PhoneVerifyModal) — collecting a phone
 * isn't enough; it must be verified. Manual email sign-ups already verify their
 * phone during registration.
 */
export default function ProfileCompletionGate({ children }: Props) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<Step>('name');
  const [missing, setMissing] = useState<MissingFields>({ firstName: false, lastName: false, phone: false });

  const [userId, setUserId] = useState('');

  // Name fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Existing phone on file (may be unverified) — pre-fills the verify modal
  const [phone, setPhone] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const checkProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    setUserId(session.user.id);

    // Only gate OAuth (Google/Facebook) users
    const provider = session.user.app_metadata?.provider ?? '';
    const isOAuth = provider === 'google' || provider === 'facebook';
    if (!isOAuth) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone, phone_verified')
      .eq('id', session.user.id)
      .maybeSingle();

    const missingFirst = !profile?.first_name || profile.first_name.trim().length === 0;
    const missingLast = !profile?.last_name || profile.last_name.trim().length === 0;
    // Phone step is needed if there's no phone OR it was never SMS-verified.
    const missingPhone = !profile?.phone || profile.phone.trim().length === 0 || !profile.phone_verified;

    if (profile?.phone) setPhone(profile.phone);

    if (missingFirst || missingLast || missingPhone) {
      setMissing({ firstName: missingFirst, lastName: missingLast, phone: missingPhone });

      // Determine which step to show first
      if (missingFirst || missingLast) {
        // Pre-fill from Google metadata if available
        const meta = session.user.user_metadata ?? {};
        const fullName: string = meta.full_name ?? meta.name ?? '';
        const parts = fullName.split(' ');
        if (missingFirst) setFirstName(parts[0] ?? '');
        if (missingLast) setLastName(parts.slice(1).join(' ') ?? '');
        setStep('name');
      } else {
        setStep('phone');
      }
      setShowModal(true);
    }
  }, []);

  useEffect(() => {
    checkProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setTimeout(checkProfile, 1200);
      }
      if (event === 'SIGNED_OUT') {
        setShowModal(false);
        setSuccess(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkProfile]);

  // ── Save name step ──────────────────────────────────────────────────────────
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const fn = firstName.trim();
    const ln = lastName.trim();

    if (missing.firstName && !fn) {
      setError(t('profileGate.firstNameRequired'));
      return;
    }
    if (missing.lastName && !ln) {
      setError(t('profileGate.lastNameRequired'));
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setError(t('profileGate.sessionExpired')); return; }

      const updatePayload: Record<string, string> = {};
      if (missing.firstName) updatePayload.first_name = fn;
      if (missing.lastName) updatePayload.last_name = ln;
      // Rebuild full_name from whatever we now have
      const { data: current } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', session.user.id)
        .maybeSingle();
      const resolvedFirst = fn || current?.first_name || '';
      const resolvedLast = ln || current?.last_name || '';
      updatePayload.full_name = `${resolvedFirst} ${resolvedLast}`.trim();

      const { error: dbErr } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', session.user.id);

      if (dbErr) { setError(t('profileGate.saveFailed')); return; }

      // If phone is also missing/unverified, move to the verification step; otherwise done.
      if (missing.phone) {
        setStep('phone');
        setError('');
      } else {
        setSuccess(true);
        setTimeout(() => { setShowModal(false); setSuccess(false); }, 1400);
      }
    } finally {
      setSaving(false);
    }
  };

  const totalSteps = (missing.firstName || missing.lastName) && missing.phone ? 2 : 1;
  const currentStepNum = step === 'name' ? 1 : totalSteps;

  return (
    <>
      {children}

      {/* Name step — own modal card */}
      {showModal && step === 'name' && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
            {success ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-check-line text-green-500 text-3xl"></i>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{t('profileGate.completeTitle')}</h2>
                <p className="text-sm text-gray-500">{t('profileGate.completeDesc')}</p>
              </div>
            ) : (
              <>
                {/* Step indicator (only shown when there are 2 steps) */}
                {totalSteps === 2 && (
                  <div className="flex items-center justify-center gap-2 mb-6">
                    {[1, 2].map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                          n === currentStepNum
                            ? 'bg-red-500 text-white'
                            : n < currentStepNum
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {n < currentStepNum ? <i className="ri-check-line text-xs"></i> : n}
                        </div>
                        {n < totalSteps && (
                          <div className={`w-8 h-0.5 ${n < currentStepNum ? 'bg-green-400' : 'bg-gray-200'}`}></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <i className="ri-user-line text-red-500 text-2xl"></i>
                </div>
                <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                  {t('profileGate.title')}
                </h2>
                <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
                  {missing.firstName && missing.lastName
                    ? t('profileGate.missingBoth')
                    : missing.firstName
                    ? t('profileGate.missingFirst')
                    : t('profileGate.missingLast')}
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      <i className="ri-error-warning-line text-red-500 text-sm"></i>
                    </div>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSaveName} className="space-y-4">
                  {missing.firstName && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('common.firstName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder={t('profileGate.firstNamePlaceholder')}
                        autoFocus
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                      />
                    </div>
                  )}
                  {missing.lastName && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('common.lastName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder={t('profileGate.lastNamePlaceholder')}
                        autoFocus={!missing.firstName}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white py-3 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {saving ? t('common.saving') : missing.phone ? t('common.continue') : t('common.save')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Phone step — SMS verification */}
      <PhoneVerifyModal
        open={showModal && step === 'phone'}
        userId={userId}
        initialPhone={phone}
        title={t('phoneVerify.title')}
        reason={t('profileGate.phoneReason')}
        onVerified={() => { setShowModal(false); }}
        onClose={() => { setShowModal(false); }}
      />
    </>
  );
}
