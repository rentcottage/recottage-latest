import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import AuthModals from '../../../components/feature/AuthModals';
import { useT } from '../../../i18n';

interface Props {
  experienceType: string;
  experienceLabel?: string;
}

const NOTIFY_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/experience-booking-notify`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

const TIME_OPTIONS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00',
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function ExperienceBookingForm({ experienceType, experienceLabel }: Props) {
  const { t } = useT();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    preferred_date: '',
    preferred_time: '',
    guests: '1',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.customer_name.trim()) { setError(t('property.experienceForm.nameRequired')); return; }
    if (!form.customer_phone.trim()) { setError(t('property.experienceForm.phoneRequired')); return; }
    if (!form.preferred_date) { setError(t('property.experienceForm.dateRequired')); return; }
    if (parseInt(form.guests, 10) < 1) { setError(t('property.experienceForm.guestsMin')); return; }

    // Final auth check — short-circuit before hitting Supabase if the session
    // disappeared while the form was open.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setError(t('property.experienceForm.loginRequired'));
      return;
    }

    setSubmitting(true);
    // Legacy short codes used to be the only experiences. New experiences come
    // from the `experiences` table and pass their UUID. Detect that and store
    // the UUID in experience_id, while keeping a friendly category in
    // experience_type ('custom' for DB-backed, legacy values otherwise).
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(experienceType);
    const dbType = isUuid
      ? 'custom'
      : experienceType === 'wine'
      ? 'wine_tasting'
      : experienceType === 'cooking'
      ? 'cooking_class'
      : experienceType;
    const { error: sbErr } = await supabase
      .from('experience_bookings')
      .insert({
        experience_type: dbType,
        experience_id: isUuid ? experienceType : null,
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim() || null,
        customer_phone: form.customer_phone.trim(),
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time || null,
        guests: parseInt(form.guests, 10),
        message: form.message.trim() || null,
        status: 'pending',
      });
    setSubmitting(false);

    if (sbErr) {
      setError(t('property.experienceForm.genericError'));
      return;
    }

    // Fire-and-forget: notify the company inbox. Failure here doesn't roll
    // back the booking — the row is already saved.
    void fetch(NOTIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        experienceTitle: experienceLabel,
        experienceId: isUuid ? experienceType : null,
        experienceType: dbType,
        customerName: form.customer_name.trim(),
        customerEmail: form.customer_email.trim() || null,
        customerPhone: form.customer_phone.trim(),
        preferredDate: form.preferred_date,
        preferredTime: form.preferred_time || null,
        guests: parseInt(form.guests, 10),
        message: form.message.trim() || null,
      }),
    }).catch((e) => console.error('[experience-booking-notify] failed:', e));

    setSuccess(true);
  };

  // Auth gate — anonymous visitors can browse but can't book.
  if (authLoading) {
    return (
      <div className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-6 md:p-8 text-center text-sm text-gray-400">
        {t('property.experienceForm.loading')}
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <div className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-6 md:p-8 text-center">
          <div className="w-12 h-12 md:w-14 md:h-14 mx-auto bg-yellow-50 rounded-full flex items-center justify-center mb-4">
            <i className="ri-lock-line text-yellow-500 text-2xl"></i>
          </div>
          <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">
            {t('property.experienceForm.signInTitle')}
          </h3>
          <p className="text-xs md:text-sm text-gray-500 max-w-sm mx-auto mb-5">
            {t('property.experienceForm.signInSub')}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => setShowLogin(true)}
              className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap"
            >
              {t('property.experienceForm.logIn')}
            </button>
            <button
              onClick={() => setShowSignup(true)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap"
            >
              {t('property.experienceForm.createAccount')}
            </button>
          </div>
        </div>
        <AuthModals
          showLogin={showLogin}
          showSignup={showSignup}
          onCloseLogin={() => setShowLogin(false)}
          onCloseSignup={() => setShowSignup(false)}
          onSwitchToSignup={() => { setShowLogin(false); setShowSignup(true); }}
          onSwitchToLogin={() => { setShowSignup(false); setShowLogin(true); }}
        />
      </>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 md:py-16 px-4 md:px-6 bg-white rounded-xl md:rounded-2xl border border-gray-100">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 md:mb-5">
          <i className="ri-checkbox-circle-line text-green-500 text-2xl md:text-3xl"></i>
        </div>
        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">{t('property.experienceForm.requestSentTitle')}</h3>
        <p className="text-xs md:text-sm text-gray-500 leading-relaxed max-w-sm mb-5 md:mb-6">
          {t('property.experienceForm.requestSentBody', {
            experience: experienceLabel ??
              (experienceType === 'wine'
                ? t('property.experienceForm.wineTasting')
                : experienceType === 'cooking'
                ? t('property.experienceForm.cookingClass')
                : t('property.experienceForm.genericExperience')),
          })}
        </p>
        <button
          onClick={() => {
            setSuccess(false);
            setForm({ customer_name: '', customer_email: '', customer_phone: '', preferred_date: '', preferred_time: '', guests: '1', message: '' });
          }}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-gray-700 transition-colors whitespace-nowrap"
        >
          {t('property.experienceForm.bookAnother')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-6 space-y-3 md:space-y-5">
      <div>
        <h2 className="text-base md:text-xl font-bold text-gray-900">
          {experienceLabel
            ? t('property.experienceForm.bookTitle', { experience: experienceLabel })
            : experienceType === 'wine'
            ? t('property.experienceForm.bookWineTasting')
            : experienceType === 'cooking'
            ? t('property.experienceForm.bookCookingClass')
            : t('property.experienceForm.bookGeneric')}
        </h2>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5 md:mt-1">
          {t('property.experienceForm.confirmWithin24h')}
        </p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
          {t('property.experienceForm.fullName')} <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.customer_name}
          onChange={(e) => set('customer_name', e.target.value)}
          placeholder={t('property.experienceForm.fullNamePlaceholder')}
          className="w-full px-3 md:px-4 py-2 md:py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
          {t('property.experienceForm.emailAddress')} <span className="text-gray-400 font-normal">{t('property.experienceForm.optional')}</span>
        </label>
        <input
          type="email"
          name="email"
          value={form.customer_email}
          onChange={(e) => set('customer_email', e.target.value)}
          placeholder={t('property.experienceForm.emailPlaceholder')}
          className="w-full px-3 md:px-4 py-2 md:py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
          {t('property.experienceForm.phoneNumber')} <span className="text-red-400">*</span>
        </label>
        <input
          type="tel"
          value={form.customer_phone}
          onChange={(e) => set('customer_phone', e.target.value)}
          placeholder={t('property.experienceForm.phonePlaceholder')}
          className="w-full px-3 md:px-4 py-2 md:py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      {/* Date + Time row */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
            {t('property.experienceForm.preferredDate')} <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={form.preferred_date}
            min={todayISO()}
            onChange={(e) => set('preferred_date', e.target.value)}
            className="w-full px-2 md:px-4 py-2 md:py-2.5 text-xs md:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
            {t('property.experienceForm.time')} <span className="text-gray-400 font-normal">{t('property.experienceForm.optional')}</span>
          </label>
          <select
            value={form.preferred_time}
            onChange={(e) => set('preferred_time', e.target.value)}
            className="w-full px-2 md:px-4 py-2 md:py-2.5 text-xs md:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
          >
            <option value="">{t('property.experienceForm.anyTime')}</option>
            {TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Guests */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
          {t('property.experienceForm.numberOfGuests')} <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => set('guests', String(Math.max(1, parseInt(form.guests, 10) - 1)))}
            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-subtract-line text-sm"></i>
          </button>
          <span className="text-base font-semibold text-gray-900 w-6 text-center">{form.guests}</span>
          <button
            type="button"
            onClick={() => set('guests', String(Math.min(15, parseInt(form.guests, 10) + 1)))}
            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-add-line text-sm"></i>
          </button>
          <span className="text-xs text-gray-400 ml-1">{t('property.experienceForm.maxGuestsNote')}</span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
          {t('property.experienceForm.specialRequests')} <span className="text-gray-400 font-normal">{t('property.experienceForm.optional')}</span>
        </label>
        <textarea
          value={form.message}
          onChange={(e) => {
            if (e.target.value.length <= 500) set('message', e.target.value);
          }}
          rows={2}
          placeholder={t('property.experienceForm.specialRequestsPlaceholder')}
          className="w-full px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
        />
        <p className="text-xs text-gray-400 mt-0.5 text-right">{form.message.length}/500</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 bg-red-50 border border-red-100 rounded-lg">
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <i className="ri-error-warning-line text-red-500 text-sm"></i>
          </div>
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 md:py-3 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <div className="w-4 h-4 flex items-center justify-center animate-spin">
              <i className="ri-loader-4-line"></i>
            </div>
            {t('property.experienceForm.sendingRequest')}
          </>
        ) : (
          <>
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-calendar-check-line"></i>
            </div>
            {t('property.experienceForm.sendBookingRequest')}
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400">
        {t('property.experienceForm.freeCancellationNote')}
      </p>
    </form>
  );
}
