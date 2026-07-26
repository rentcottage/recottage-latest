import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useT } from '../../../i18n';

interface BlockedRange {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  host_email: string;
  created_at: string;
}

interface Property {
  id: string;
  title: string;
  status: string;
}

interface Props {
  properties: Property[];
  loading: boolean;
}

const DAY_KEYS = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'];
const MONTH_KEYS = [
  'monthJanuary', 'monthFebruary', 'monthMarch', 'monthApril', 'monthMay', 'monthJune',
  'monthJuly', 'monthAugust', 'monthSeptember', 'monthOctober', 'monthNovember', 'monthDecember',
];

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isDateBlocked(dateStr: string, ranges: BlockedRange[], propId: string): boolean {
  return ranges.some((r) => r.property_id === propId && dateStr >= r.start_date && dateStr <= r.end_date);
}

function isDateInRange(dateStr: string, start: string, end: string): boolean {
  if (!start || !end) return false;
  const [s, e] = start <= end ? [start, end] : [end, start];
  return dateStr >= s && dateStr <= e;
}

export default function HostBlockedDatesSection({ properties, loading: propsLoading }: Props) {
  const { t } = useT();
  const DAYS = DAY_KEYS.map((k) => t(`host.blockedDates.${k}`));
  const MONTHS = MONTH_KEYS.map((k) => t(`host.blockedDates.${k}`));
  const { user } = useAuth();
  const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [selectStart, setSelectStart] = useState('');
  const [selectEnd, setSelectEnd] = useState('');
  const [hoveredDate, setHoveredDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [filterPropertyId, setFilterPropertyId] = useState('all');

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBlocked = useCallback(async () => {
    if (!user?.email || propsLoading || properties.length === 0) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('blocked_dates')
      .select('*')
      .eq('host_email', user.email)
      .order('start_date', { ascending: true });
    setBlockedRanges((data ?? []) as BlockedRange[]);
    setLoading(false);
  }, [user?.email, properties, propsLoading]);

  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);

  useEffect(() => {
    if (!selectedPropertyId && properties.length > 0) {
      const approved = properties.find((p) => p.status === 'approved') || properties[0];
      setSelectedPropertyId(approved.id);
    }
  }, [properties, selectedPropertyId]);

  const calDays = useMemo(() => {
    const firstDow = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const days: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calYear, calMonth]);

  const today = new Date().toISOString().split('T')[0];

  const handleDayClick = (dateStr: string) => {
    if (dateStr < today) return;
    if (!selectStart || (selectStart && selectEnd)) {
      // Start new selection
      setSelectStart(dateStr);
      setSelectEnd('');
    } else {
      // Second click - complete the selection
      if (dateStr === selectStart) {
        // Same date clicked twice - treat as single day block
        setSelectEnd(dateStr);
      } else if (dateStr < selectStart) {
        setSelectStart(dateStr);
        setSelectEnd(selectStart);
      } else {
        setSelectEnd(dateStr);
      }
    }
  };

  const handleSave = async () => {
    if (!selectStart || !selectedPropertyId || !user?.email) return;
    // If no end date selected, treat as single day block
    const endDate = selectEnd || selectStart;
    const [s, e] = selectStart <= endDate ? [selectStart, endDate] : [endDate, selectStart];
    setSaving(true);
    const { error } = await supabase.from('blocked_dates').insert({
      property_id: selectedPropertyId,
      start_date: s,
      end_date: e,
      reason: reason.trim() || null,
      host_email: user.email,
    });
    if (error) {
      showToast(t('host.blockedDates.failedToSave'), 'error');
    } else {
      showToast(selectEnd && selectEnd !== selectStart ? t('host.blockedDates.datesBlockedSuccess') : t('host.blockedDates.dateBlockedSuccess'), 'success');
      setSelectStart('');
      setSelectEnd('');
      setReason('');
      fetchBlocked();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('blocked_dates').delete().eq('id', id);
    if (error) {
      showToast(t('host.blockedDates.failedToRemove'), 'error');
    } else {
      showToast(t('host.blockedDates.blockedDatesRemoved'), 'success');
      setBlockedRanges((prev) => prev.filter((r) => r.id !== id));
    }
    setDeletingId(null);
  };

  const prevMonth = () => setCalMonth((m) => { if (m === 1) { setCalYear((y) => y - 1); return 12; } return m - 1; });
  const nextMonth = () => setCalMonth((m) => { if (m === 12) { setCalYear((y) => y + 1); return 1; } return m + 1; });

  const filteredRanges = filterPropertyId === 'all'
    ? blockedRanges
    : blockedRanges.filter((r) => r.property_id === filterPropertyId);

  const propMap = Object.fromEntries(properties.map((p) => [p.id, p.title]));

  return (
    <div>
      <div className="mb-5 md:mb-6">
        <h2 className="text-base md:text-xl font-bold text-gray-900">{t('host.blockedDates.title')}</h2>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5">{t('host.blockedDates.sub')}</p>
      </div>

      {propsLoading ? (
        <div className="bg-white rounded-card border border-line shadow-card flex items-center justify-center py-16">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-4 h-4 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
            <span className="text-sm">{t('host.common.loading')}</span>
          </div>
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-card border border-line shadow-card flex flex-col items-center py-16 text-gray-400">
          <div className="w-10 h-10 flex items-center justify-center mb-2"><i className="ri-home-smile-line text-3xl"></i></div>
          <p className="text-sm">{t('host.blockedDates.noPropertiesYet')}</p>
          <p className="text-xs mt-1">{t('host.blockedDates.noPropertiesSub')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
          {/* Left: Calendar picker */}
          <div className="md:col-span-3 bg-white rounded-card border border-line shadow-card p-4 md:p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('host.blockedDates.blockNewDates')}</h3>

            {/* Property selector */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-500 mb-2">{t('host.blockedDates.property')}</label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            {/* Calendar */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                <i className="ri-arrow-left-s-line text-gray-600"></i>
              </button>
              <span className="text-sm font-semibold text-gray-900">{MONTHS[calMonth - 1]} {calYear}</span>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                <i className="ri-arrow-right-s-line text-gray-600"></i>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d.slice(0, 2)}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calDays.map((day, idx) => {
                if (!day) return <div key={idx} className="aspect-square" />;
                const dateStr = toDateStr(calYear, calMonth, day);
                const isPast = dateStr < today;
                const isBlocked = isDateBlocked(dateStr, blockedRanges, selectedPropertyId);
                const isStart = dateStr === selectStart;
                const isEnd = dateStr === selectEnd;
                // Show hover preview when selecting a range
                const rangeEnd = hoveredDate && !selectEnd && selectStart && hoveredDate !== selectStart ? hoveredDate : selectEnd;
                const inRange = !isStart && !isEnd && isDateInRange(dateStr, selectStart, rangeEnd);
                const isToday = dateStr === today;
                // Single day selection (start set but no end yet, and not hovering a different date)
                const isSingleSelected = isStart && !selectEnd && (!hoveredDate || hoveredDate === selectStart);

                return (
                  <button
                    key={idx}
                    onClick={() => !isPast && !isBlocked && handleDayClick(dateStr)}
                    onMouseEnter={() => setHoveredDate(dateStr)}
                    onMouseLeave={() => setHoveredDate('')}
                    disabled={isPast || isBlocked}
                    className={`aspect-square flex items-center justify-center text-xs rounded-lg transition-all cursor-pointer relative ${
                      isBlocked
                        ? 'bg-red-100 text-red-400 cursor-not-allowed'
                        : isPast
                        ? 'text-gray-300 cursor-not-allowed'
                        : isStart && isEnd
                        ? 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400'
                        : isStart || isEnd
                        ? 'bg-emerald-600 text-white font-bold'
                        : inRange
                        ? 'bg-emerald-100 text-emerald-800'
                        : isSingleSelected
                        ? 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400'
                        : 'text-gray-700 hover:bg-gray-100'
                    } ${isToday && !isStart && !isEnd && !isSingleSelected ? 'ring-1 ring-emerald-400' : ''}`}
                  >
                    {day}
                    {isBlocked && (
                      <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-red-400 rounded-full" />
                    )}
                    {isSingleSelected && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-emerald-200 font-normal">{t('host.blockedDates.oneDay')}</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-4 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-600"></div>
                <span>{t('host.blockedDates.legendSelected')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-100"></div>
                <span>{t('host.blockedDates.legendRange')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-100"></div>
                <span>{t('host.blockedDates.legendAlreadyBlocked')}</span>
              </div>
            </div>

            {/* Selected range + reason + save */}
            {(selectStart || selectEnd) && (
              <div className="mt-5 border-t border-gray-100 pt-5 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-1 bg-emerald-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-gray-400 mb-0.5">{t('host.blockedDates.from')}</p>
                    <p className="font-semibold text-gray-900">{selectStart ? fmt(selectStart) : '—'}</p>
                  </div>
                  <div className="w-4 h-4 flex items-center justify-center text-gray-300">
                    <i className="ri-arrow-right-line"></i>
                  </div>
                  <div className="flex-1 bg-emerald-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-gray-400 mb-0.5">{t('host.blockedDates.to')}</p>
                    <p className="font-semibold text-gray-900">{selectEnd ? fmt(selectEnd) : (selectStart ? t('host.blockedDates.sameDaySingle') : t('host.blockedDates.selectEndDate'))}</p>
                  </div>
                </div>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('host.blockedDates.reasonPlaceholder')}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={!selectStart || saving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {saving ? (
                      <>
                        <div className="w-3 h-3 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                        {t('host.blockedDates.saving')}
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 flex items-center justify-center"><i className="ri-lock-line"></i></div>
                        {selectEnd && selectEnd !== selectStart ? t('host.blockedDates.blockTheseDates') : t('host.blockedDates.blockThisDate')}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => { setSelectStart(''); setSelectEnd(''); setReason(''); }}
                    className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t('host.blockedDates.clear')}
                  </button>
                </div>
                {!selectEnd && selectStart && (
                  <p className="text-xs text-gray-400 text-center">
                    {t('host.blockedDates.clickSameDateHint')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: Blocked ranges list */}
          <div className="md:col-span-2 bg-white rounded-card border border-line shadow-card overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">{t('host.blockedDates.blockedPeriods')}</h3>
                <button
                  onClick={fetchBlocked}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 cursor-pointer whitespace-nowrap"
                >
                  <div className="w-3 h-3 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                  {t('host.common.refresh')}
                </button>
              </div>
              {/* Filter */}
              <select
                value={filterPropertyId}
                onChange={(e) => setFilterPropertyId(e.target.value)}
                className="w-full text-xs border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              >
                <option value="all">{t('host.blockedDates.allProperties')}</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-4 h-4 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                    <span className="text-xs">{t('host.common.loading')}</span>
                  </div>
                </div>
              ) : filteredRanges.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <div className="w-9 h-9 flex items-center justify-center mb-2"><i className="ri-calendar-check-line text-2xl"></i></div>
                  <p className="text-xs text-center">{t('host.blockedDates.noBlockedDatesYet')}<br />{t('host.blockedDates.allDatesAvailable')}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredRanges.map((r) => (
                    <div key={r.id} className="px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate mb-0.5">
                            {propMap[r.property_id] || t('host.blockedDates.unknown')}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <i className="ri-calendar-close-line text-red-400"></i>
                            <span>{fmt(r.start_date)}</span>
                            <span className="text-gray-400">→</span>
                            <span>{fmt(r.end_date)}</span>
                          </div>
                          {r.reason && (
                            <p className="text-xs text-gray-400 mt-1 italic">{r.reason}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title={t('host.blockedDates.removeBlock')}
                        >
                          {deletingId === r.id ? (
                            <div className="w-3 h-3 flex items-center justify-center animate-spin"><i className="ri-loader-4-line text-xs"></i></div>
                          ) : (
                            <i className="ri-delete-bin-line text-sm"></i>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium text-white ${toast.type === 'success' ? 'bg-gray-900' : 'bg-red-500'}`}>
          <div className="w-4 h-4 flex items-center justify-center">
            <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'}></i>
          </div>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
