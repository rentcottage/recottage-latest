import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface Props {
  experienceType: string;
  experienceLabel?: string;
}

const TIME_OPTIONS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00',
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function ExperienceBookingForm({ experienceType, experienceLabel }: Props) {
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

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.customer_name.trim()) { setError('Please enter your full name.'); return; }
    if (!form.customer_phone.trim()) { setError('Please enter a phone number.'); return; }
    if (!form.preferred_date) { setError('Please select a preferred date.'); return; }
    if (parseInt(form.guests, 10) < 1) { setError('Guests must be at least 1.'); return; }

    setSubmitting(true);
    const dbType =
      experienceType === 'wine'
        ? 'wine_tasting'
        : experienceType === 'cooking'
        ? 'cooking_class'
        : experienceType;
    const { error: sbErr } = await supabase.from('experience_bookings').insert({
      experience_type: dbType,
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
      setError('Something went wrong. Please try again.');
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 md:py-16 px-4 md:px-6 bg-white rounded-xl md:rounded-2xl border border-gray-100">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 md:mb-5">
          <i className="ri-checkbox-circle-line text-green-500 text-2xl md:text-3xl"></i>
        </div>
        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">Request Sent!</h3>
        <p className="text-xs md:text-sm text-gray-500 leading-relaxed max-w-sm mb-5 md:mb-6">
          We received your booking request for the{' '}
          <strong>
            {experienceLabel ??
              (experienceType === 'wine'
                ? 'Wine Tasting'
                : experienceType === 'cooking'
                ? 'Cooking Class'
                : 'experience')}
          </strong>.
          Our team will contact you within 24 hours to confirm.
        </p>
        <button
          onClick={() => {
            setSuccess(false);
            setForm({ customer_name: '', customer_email: '', customer_phone: '', preferred_date: '', preferred_time: '', guests: '1', message: '' });
          }}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-gray-700 transition-colors whitespace-nowrap"
        >
          Book Another Experience
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-6 space-y-3 md:space-y-5">
      <div>
        <h2 className="text-base md:text-xl font-bold text-gray-900">
          {experienceType === 'wine' ? 'Book Wine Tasting' : 'Book Cooking Class'}
        </h2>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5 md:mt-1">
          Fill in your details and we&apos;ll confirm within 24 hours.
        </p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
          Full Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.customer_name}
          onChange={(e) => set('customer_name', e.target.value)}
          placeholder="e.g. Ana Beridze"
          className="w-full px-3 md:px-4 py-2 md:py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
          Email Address <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="email"
          name="email"
          value={form.customer_email}
          onChange={(e) => set('customer_email', e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 md:px-4 py-2 md:py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
          Phone Number <span className="text-red-400">*</span>
        </label>
        <input
          type="tel"
          value={form.customer_phone}
          onChange={(e) => set('customer_phone', e.target.value)}
          placeholder="+995 5XX XXX XXX"
          className="w-full px-3 md:px-4 py-2 md:py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      {/* Date + Time row */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
            Preferred Date <span className="text-red-400">*</span>
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
            Time <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            value={form.preferred_time}
            onChange={(e) => set('preferred_time', e.target.value)}
            className="w-full px-2 md:px-4 py-2 md:py-2.5 text-xs md:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
          >
            <option value="">Any time</option>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Guests */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
          Number of Guests <span className="text-red-400">*</span>
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
            onClick={() => set('guests', String(Math.min(12, parseInt(form.guests, 10) + 1)))}
            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-add-line text-sm"></i>
          </button>
          <span className="text-xs text-gray-400 ml-1">Max 12</span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 md:mb-1.5">
          Special Requests <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={form.message}
          onChange={(e) => {
            if (e.target.value.length <= 500) set('message', e.target.value);
          }}
          rows={2}
          placeholder="Dietary restrictions, special occasions…"
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
            Sending Request…
          </>
        ) : (
          <>
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-calendar-check-line"></i>
            </div>
            Send Booking Request
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400">
        Free cancellation · Confirmed within 24 hours
      </p>
    </form>
  );
}
