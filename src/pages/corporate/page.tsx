import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import SEO from '../../components/feature/SEO';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '@lib/i18n';

const CORPORATE_FN_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/corporate-application-handler`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

interface CorporateApplication {
  id: string;
  agency_name: string;
  status: ApplicationStatus;
  rejection_note: string | null;
}

type Mode = 'apply' | 'signin';

export default function CorporatePage() {
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>('apply');
  const [appLoading, setAppLoading] = useState(true);
  const [existing, setExisting] = useState<CorporateApplication | null>(null);

  // Apply form
  const [form, setForm] = useState({
    agency_name: '',
    tax_id: '',
    rep_first_name: '',
    rep_last_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Sign-in form
  const [signin, setSignin] = useState({ tax_id: '', password: '' });
  const [signinError, setSigninError] = useState('');
  const [signinLoading, setSigninLoading] = useState(false);

  // Look up an existing application for the signed-in user.
  useEffect(() => {
    let cancelled = false;
    async function lookup() {
      if (authLoading) return;
      if (!isLoggedIn || !user) {
        setAppLoading(false);
        return;
      }
      const { data } = await supabase
        .from('corporate_applications')
        .select('id, agency_name, status, rejection_note')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setExisting(data as CorporateApplication);
        if (data.status === 'approved') {
          navigate('/corporate/dashboard', { replace: true });
        }
      }
      setAppLoading(false);
    }
    lookup();
    return () => { cancelled = true; };
  }, [authLoading, isLoggedIn, user, navigate]);

  // Pre-fill the email from the logged-in user (for apply mode only).
  useEffect(() => {
    if (user?.email && !form.email) {
      setForm((f) => ({ ...f, email: user.email ?? '' }));
    }
  }, [user, form.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!form.agency_name || !form.tax_id || !form.rep_first_name || !form.rep_last_name || !form.email || !form.phone.trim() || !form.password) {
      setSubmitError(t('corporate.form.fillAllRequired'));
      return;
    }
    if (form.password.length < 8) {
      setSubmitError(t('authPages.validation.passwordMinLength'));
      return;
    }
    if (form.password !== form.confirm_password) {
      setSubmitError(t('authPages.validation.passwordsNoMatch'));
      return;
    }
    setSubmitting(true);
    try {
      const { confirm_password: _confirm, ...payload } = form;
      void _confirm;
      const res = await fetch(CORPORATE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError((data.error as string) ?? t('corporate.form.requestFailed', { status: res.status }));
      } else {
        setSubmitSuccess(true);
      }
    } catch (err) {
      console.error(err);
      setSubmitError(t('corporate.networkError'));
    }
    setSubmitting(false);
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigninError('');
    if (!signin.tax_id.trim() || !signin.password) {
      setSigninError(t('corporate.signin.enterCredentials'));
      return;
    }
    setSigninLoading(true);
    try {
      const res = await fetch(CORPORATE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'corporate-login', tax_id: signin.tax_id, password: signin.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setSigninError((data.error as string) ?? t('corporate.signin.failed', { status: res.status }));
        setSigninLoading(false);
        return;
      }
      // Consume the admin-issued magic-link token to set the session client-side.
      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: data.hashed_token,
        type: 'magiclink',
      });
      if (otpErr) {
        setSigninError(otpErr.message);
        setSigninLoading(false);
        return;
      }
      if (data.status === 'approved') {
        navigate('/corporate/dashboard', { replace: true });
      } else {
        // Refresh the page so the pending/rejected status banner renders.
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      setSigninError(t('corporate.networkError'));
    }
  };

  const update = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SEO
        title={t('corporate.seo.title')}
        description={t('corporate.seo.description')}
        canonical="/corporate"
      />
      <Header />

      {/* Hero */}
      <section className="border-b border-gray-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold mb-6">
            <i className="ri-briefcase-line"></i>
            {t('corporate.hero.badge')}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-5 tracking-tight">
            {t('corporate.hero.title1')}<br />
            <span className="text-emerald-700">{t('corporate.hero.title2')}</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            {t('corporate.hero.desc1')} <strong>{t('corporate.hero.descStrong')}</strong> {t('corporate.hero.desc2')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2"><i className="ri-check-line text-emerald-600 text-base"></i>{t('corporate.hero.point1')}</div>
            <div className="flex items-center gap-2"><i className="ri-check-line text-emerald-600 text-base"></i>{t('corporate.hero.point2')}</div>
            <div className="flex items-center gap-2"><i className="ri-check-line text-emerald-600 text-base"></i>{t('corporate.hero.point3')}</div>
          </div>
        </div>
      </section>

      {/* State-aware section */}
      <section className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        {authLoading || appLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="w-5 h-5 animate-spin"><i className="ri-loader-4-line text-xl"></i></div>
            <span className="ml-3 text-sm">{t('common.loading')}</span>
          </div>
        ) : existing && existing.status === 'pending' ? (
          <StatusCard
            color="amber"
            icon="ri-time-line"
            title={t('corporate.statusCards.pendingTitle')}
            message={t('corporate.statusCards.pendingMessage', { agencyName: existing.agency_name })}
          />
        ) : existing && existing.status === 'rejected' ? (
          <StatusCard
            color="red"
            icon="ri-close-circle-line"
            title={t('corporate.statusCards.rejectedTitle')}
            message={`${t('corporate.statusCards.rejectedMessage', { agencyName: existing.agency_name })}${existing.rejection_note ? ` ${t('corporate.statusCards.rejectedReason', { reason: existing.rejection_note })}` : ''} ${t('corporate.statusCards.rejectedContact')}`}
          />
        ) : submitSuccess ? (
          <StatusCard
            color="emerald"
            icon="ri-checkbox-circle-line"
            title={t('corporate.statusCards.successTitle')}
            message={t('corporate.statusCards.successMessage')}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setMode('apply')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${mode === 'apply' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t('corporate.applyAsAgency')}
              </button>
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${mode === 'signin' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t('corporate.signIn')}
              </button>
            </div>

            {mode === 'apply' ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-sm text-gray-500">{t('corporate.form.requiredNote1')} <span className="text-red-500">*</span> {t('corporate.form.requiredNote2')}</p>
                <Field label={t('corporate.form.agencyName')} value={form.agency_name} onChange={update('agency_name')} placeholder={t('corporate.form.agencyNamePlaceholder')} />
                <Field label={t('corporate.form.taxIdFull')} value={form.tax_id} onChange={update('tax_id')} placeholder={t('corporate.form.taxIdPlaceholder')} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t('corporate.form.repFirstName')} value={form.rep_first_name} onChange={update('rep_first_name')} placeholder={t('corporate.form.firstNamePlaceholder')} />
                  <Field label={t('corporate.form.repLastName')} value={form.rep_last_name} onChange={update('rep_last_name')} placeholder={t('corporate.form.lastNamePlaceholder')} />
                </div>
                <Field label={t('corporate.form.email')} type="email" value={form.email} onChange={update('email')} placeholder="agency@example.com" />
                <Field label={t('corporate.form.phone')} type="tel" value={form.phone} onChange={update('phone')} placeholder="+995 555 12 34 56" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t('corporate.form.password')} type="password" value={form.password} onChange={update('password')} placeholder="••••••••" />
                  <Field label={t('corporate.form.confirmPassword')} type="password" value={form.confirm_password} onChange={update('confirm_password')} placeholder="••••••••" />
                </div>

                {submitError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 animate-spin"><i className="ri-loader-4-line"></i></div>
                      {t('corporate.form.submitting')}
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-line"></i>
                      {t('corporate.form.submitButton')}
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  {t('corporate.form.alreadyHaveAccount')}{' '}
                  <button type="button" onClick={() => setMode('signin')} className="text-emerald-700 hover:underline cursor-pointer">
                    {t('corporate.form.signInWithTaxId')}
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignin} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{t('corporate.signin.title')}</h2>
                  <p className="text-sm text-gray-500">{t('corporate.signin.subtitle')}</p>
                </div>
                <Field
                  label={t('corporate.signin.taxIdLabel')}
                  value={signin.tax_id}
                  onChange={(e) => setSignin((s) => ({ ...s, tax_id: e.target.value }))}
                  placeholder={t('corporate.form.taxIdPlaceholder')}
                />
                <Field
                  label={t('corporate.signin.passwordLabel')}
                  type="password"
                  value={signin.password}
                  onChange={(e) => setSignin((s) => ({ ...s, password: e.target.value }))}
                  placeholder="••••••••"
                />

                {signinError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {signinError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={signinLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  {signinLoading ? (
                    <>
                      <div className="w-4 h-4 animate-spin"><i className="ri-loader-4-line"></i></div>
                      {t('corporate.signin.signingIn')}
                    </>
                  ) : (
                    <>
                      <i className="ri-login-circle-line"></i>
                      {t('corporate.signIn')}
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  {t('corporate.signin.newHere')}{' '}
                  <button type="button" onClick={() => setMode('apply')} className="text-emerald-700 hover:underline cursor-pointer">
                    {t('corporate.applyAsAgency')}
                  </button>
                </p>
              </form>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
      />
    </div>
  );
}

function StatusCard({
  color, icon, title, message,
}: {
  color: 'amber' | 'red' | 'emerald';
  icon: string;
  title: string;
  message: string;
}) {
  const palette = {
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconText: 'text-amber-600', title: 'text-amber-900' },
    red: { bg: 'bg-red-50', border: 'border-red-200', iconBg: 'bg-red-100', iconText: 'text-red-600', title: 'text-red-900' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', title: 'text-emerald-900' },
  }[color];

  return (
    <div className={`${palette.bg} ${palette.border} border rounded-2xl p-6 md:p-8 flex items-start gap-4`}>
      <div className={`${palette.iconBg} ${palette.iconText} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0`}>
        <i className={`${icon} text-2xl`}></i>
      </div>
      <div>
        <h3 className={`${palette.title} text-lg font-bold mb-1`}>{title}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
