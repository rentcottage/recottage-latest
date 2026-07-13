import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@lib/i18n';

interface Timeslot {
  start_time: string;
  end_time: string;
}

interface BookingTexts {
  stepDateTitle?: string;
  stepTimeTitle?: string;
  stepFormTitle?: string;
  selectDatePrompt?: string;
  selectTimePrompt?: string;
  noSlotsAvailable?: string;
  nameLabel?: string;
  namePlaceholder?: string;
  phoneLabel?: string;
  phonePlaceholder?: string;
  selectedDateLabel?: string;
  selectedTimeLabel?: string;
  modifyTimeBtn?: string;
  submitBtn?: string;
  submittingBtn?: string;
  successMessage?: string;
  errorMessage?: string;
  weekDays?: string[];
  monthNames?: string[];
  availableLegend?: string;
  selectedLegend?: string;
}

export interface BookingCalendarProps {
  timeslotsApi: string;
  appointmentsApi: string;
  texts?: BookingTexts;
  containerStyle?: React.CSSProperties;
}

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function formatTime(timeStr: string): string {
  const parts = timeStr.split(' ');
  if (parts.length >= 2) return parts[1].slice(0, 5);
  return timeStr.slice(0, 5);
}

export function BookingCalendar({
  timeslotsApi,
  appointmentsApi,
  texts = {},
  containerStyle,
}: BookingCalendarProps) {
  const { t, lang } = useTranslation();

  const defaultTexts = useMemo<Required<BookingTexts>>(
    () => ({
      stepDateTitle: t('calendar.stepDateTitle'),
      stepTimeTitle: t('calendar.stepTimeTitle'),
      stepFormTitle: t('calendar.stepFormTitle'),
      selectDatePrompt: t('calendar.selectDatePrompt'),
      selectTimePrompt: t('calendar.selectTimePrompt'),
      noSlotsAvailable: t('calendar.noSlotsAvailable'),
      nameLabel: t('calendar.nameLabel'),
      namePlaceholder: t('home.bookingForm.fullNamePlaceholder'),
      phoneLabel: t('calendar.phoneLabel'),
      phonePlaceholder: t('calendar.phonePlaceholder'),
      selectedDateLabel: t('calendar.dateLabel'),
      selectedTimeLabel: t('calendar.timeLabel'),
      modifyTimeBtn: t('calendar.modifyTime'),
      submitBtn: t('calendar.confirmBooking'),
      submittingBtn: t('calendar.submitting'),
      successMessage: t('calendar.bookingSuccess'),
      errorMessage: t('calendar.bookingError'),
      // 2021-08-01 was a Sunday — reference dates only, used to render
      // weekday/month names in the active language.
      weekDays: Array.from({ length: 7 }, (_, i) =>
        new Date(2021, 7, i + 1).toLocaleDateString(lang, { weekday: 'short' })
      ),
      monthNames: Array.from({ length: 12 }, (_, m) =>
        new Date(2021, m, 1).toLocaleDateString(lang, { month: 'long' })
      ),
      availableLegend: t('calendar.available'),
      selectedLegend: t('calendar.selected'),
    }),
    [t, lang]
  );

  const txt = useMemo(() => ({ ...defaultTexts, ...texts }), [defaultTexts, texts]);

  const [step, setStep] = useState(0);
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [loading, setLoading] = useState(true);
  const [calYear, setCalYear] = useState(0);
  const [calMonth, setCalMonth] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Timeslot | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchTimeslots = useCallback(async (): Promise<Timeslot[]> => {
    try {
      setLoading(true);
      const res = await fetch(timeslotsApi);
      const data = await res.json();
      const slots: Timeslot[] = Array.isArray(data)
        ? data
        : (data.timeslots ?? data.data ?? []);
      setTimeslots(slots);
      return slots;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, [timeslotsApi]);

  const updateCalendarMonth = useCallback(
    (slots: Timeslot[], currentYear: number, currentMonth: number) => {
      if (slots.length === 0) return;
      const today = getTodayStr();
      const dates = [...new Set(slots.map((s) => s.start_time.split(' ')[0]))].sort();
      const closest = dates.find((d) => d >= today) ?? dates[dates.length - 1];
      if (!closest) return;
      const [y, m] = closest.split('-').map(Number);
      const hasInCurrentMonth = dates.some((d) => {
        const [dy, dm] = d.split('-').map(Number);
        return dy === currentYear && dm === currentMonth && d >= today;
      });
      if (!hasInCurrentMonth) {
        setCalYear(y);
        setCalMonth(m);
      }
    },
    []
  );

  useEffect(() => {
    fetchTimeslots().then((slots) => {
      if (slots.length === 0) return;
      const today = getTodayStr();
      const dates = [...new Set(slots.map((s) => s.start_time.split(' ')[0]))].sort();
      const closest = dates.find((d) => d >= today) ?? dates[dates.length - 1];
      if (closest) {
        const [y, m] = closest.split('-').map(Number);
        setCalYear(y);
        setCalMonth(m);
      }
    });
  }, [fetchTimeslots]);

  const availableDatesSet = useMemo(
    () => new Set(timeslots.map((s) => s.start_time.split(' ')[0])),
    [timeslots]
  );

  const slotsForDate = useMemo(
    () => (selectedDate ? timeslots.filter((s) => s.start_time.split(' ')[0] === selectedDate) : []),
    [timeslots, selectedDate]
  );

  const calDays = useMemo(
    () => (calYear > 0 && calMonth > 0 ? getCalendarDays(calYear, calMonth) : []),
    [calYear, calMonth]
  );

  const prevMonth = () => {
    setCalMonth((m) => {
      if (m === 1) { setCalYear((y) => y - 1); return 12; }
      return m - 1;
    });
  };

  const nextMonth = () => {
    setCalMonth((m) => {
      if (m === 12) { setCalYear((y) => y + 1); return 1; }
      return m + 1;
    });
  };

  const handleDateSelect = (dateStr: string) => {
    if (!availableDatesSet.has(dateStr)) return;
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setStep(1);
  };

  const handleSlotSelect = (slot: Timeslot) => {
    setSelectedSlot(slot);
    setStep(2);
  };

  const handleModifyTime = () => {
    setStep(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        customer_name: formName,
        customer_phone: formPhone,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        notes: '',
      };
      const res = await fetch(appointmentsApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      setSubmitSuccess(true);
      const freshSlots = await fetchTimeslots();
      updateCalendarMonth(freshSlots, calYear, calMonth);
      setTimeout(() => {
        setSubmitSuccess(false);
        setStep(0);
        setSelectedDate(null);
        setSelectedSlot(null);
        setFormName('');
        setFormPhone('');
      }, 3000);
    } catch {
      setSubmitError(txt.errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && calYear === 0) {
    return (
      <div style={containerStyle} className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-400">{t('calendar.loadingAvailability')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 max-w-xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {[0, 1, 2].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                step === s
                  ? 'bg-red-500 text-white shadow-md shadow-red-200'
                  : step > s
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {step > s ? <i className="ri-check-line text-sm"></i> : s + 1}
            </div>
            {s < 2 && (
              <div className={`w-14 h-0.5 mx-1 transition-colors ${step > s ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 0: Date Selection ── */}
      {step === 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{txt.stepDateTitle}</h3>
          <p className="text-sm text-gray-400 mb-6">{txt.selectDatePrompt}</p>

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-s-line text-gray-600 text-lg"></i>
            </button>
            <span className="font-semibold text-gray-900 text-sm">
              {calYear > 0 && calMonth > 0 ? `${txt.monthNames[calMonth - 1]} ${calYear}` : ''}
            </span>
            <button
              onClick={nextMonth}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-arrow-right-s-line text-gray-600 text-lg"></i>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {txt.weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                {day.slice(0, 2)}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calDays.map((day, idx) => {
              if (!day) return <div key={idx} className="aspect-square" />;
              const dateStr = toDateStr(calYear, calMonth, day);
              const isAvail = availableDatesSet.has(dateStr);
              const isSel = dateStr === selectedDate;
              const isToday = dateStr === getTodayStr();
              const dow = new Date(calYear, calMonth - 1, day).getDay();
              return (
                <button
                  key={idx}
                  onClick={() => handleDateSelect(dateStr)}
                  disabled={!isAvail}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl text-xs transition-all cursor-pointer ${
                    isSel
                      ? 'bg-red-500 text-white font-semibold shadow-md shadow-red-200'
                      : isAvail
                      ? 'bg-red-50 text-gray-900 font-medium hover:bg-red-100 border border-red-200'
                      : 'text-gray-300 cursor-not-allowed'
                  } ${isToday && !isSel ? 'ring-1 ring-red-400' : ''}`}
                >
                  <span className={`text-[9px] leading-none mb-0.5 ${isSel ? 'text-red-100' : 'text-gray-400'}`}>
                    {txt.weekDays[dow].slice(0, 2)}
                  </span>
                  <span className="font-semibold text-sm leading-none">{day}</span>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 mt-5 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-50 border border-red-200"></div>
              <span>{txt.availableLegend}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span>{txt.selectedLegend}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 1: Time Slot Selection ── */}
      {step === 1 && selectedDate && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setStep(0)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-line text-gray-600"></i>
            </button>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{txt.stepTimeTitle}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{selectedDate}</p>
            </div>
          </div>

          {slotsForDate.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-calendar-close-line text-gray-400 text-xl"></i>
              </div>
              <p className="text-gray-400 text-sm">{txt.noSlotsAvailable}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {slotsForDate.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSlotSelect(slot)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedSlot === slot
                      ? 'border-red-500 bg-red-50 shadow-sm'
                      : 'border-gray-200 hover:border-red-300 hover:bg-red-50/40'
                  }`}
                >
                  <div className="font-semibold text-gray-900 text-sm">
                    {formatTime(slot.start_time)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t('calendar.until', { time: formatTime(slot.end_time) })}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                    <span className="text-xs text-green-600">{txt.availableLegend}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Review + Form + Submit ── */}
      {step === 2 && selectedSlot && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-6">{txt.stepFormTitle}</h3>

          {/* Read-only review */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">{txt.selectedDateLabel}</p>
                <p className="text-sm font-semibold text-gray-900">{selectedDate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">{txt.selectedTimeLabel}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatTime(selectedSlot.start_time)} – {formatTime(selectedSlot.end_time)}
                </p>
              </div>
            </div>
            <button
              onClick={handleModifyTime}
              className="mt-3 text-xs text-red-500 hover:text-red-600 cursor-pointer underline underline-offset-2 transition-colors"
            >
              {txt.modifyTimeBtn}
            </button>
          </div>

          {/* Success */}
          {submitSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-center gap-3">
              <i className="ri-checkbox-circle-fill text-green-500 text-xl"></i>
              <p className="text-sm text-green-800 font-medium">{txt.successMessage}</p>
            </div>
          )}

          {/* Error */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-center gap-3">
              <i className="ri-error-warning-line text-red-500 text-xl"></i>
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {txt.nameLabel} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={txt.namePlaceholder}
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {txt.phoneLabel} <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                required
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder={txt.phonePlaceholder}
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || submitSuccess}
              className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap mt-2"
            >
              {submitting ? txt.submittingBtn : txt.submitBtn}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
