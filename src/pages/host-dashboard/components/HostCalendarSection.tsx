import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';

interface Booking {
  id: string;
  user_name: string | null;
  user_email: string;
  property_id: string | null;
  property_title: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number | null;
  status: string;
  payment_status: string | null;
}

interface BlockedRange {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

interface Property {
  id: string;
  title: string;
  status: string;
}

interface Props {
  properties: Property[];
  bookings: Booking[];
  loading: boolean;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fmt(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function datesBetween(start: string, end: string): string[] {
  const result: string[] = [];
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    result.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

/**
 * PRIVACY RULE: Host may only see customer personal details on or after check-in date.
 */
function canSeeGuestDetails(checkIn: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return today >= checkIn;
}

function maskName(name: string | null): string {
  if (!name || !name.trim()) return 'Guest';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + '.';
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

function statusColor(status: string): { bg: string; text: string; dot: string; label: string } {
  if (status === 'confirmed') return { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'Confirmed' };
  if (status === 'pending') return { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Pending' };
  if (status === 'cancelled') return { bg: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-400', label: 'Cancelled' };
  if (status === 'completed') return { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Completed' };
  return { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-300', label: status };
}

export default function HostCalendarSection({ properties, bookings, loading }: Props) {
  const { user } = useAuth();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const fetchBlocked = useCallback(async () => {
    if (!user?.email || properties.length === 0) return;
    setBlockedLoading(true);
    const { data } = await supabase
      .from('blocked_dates')
      .select('id, property_id, start_date, end_date, reason')
      .eq('host_email', user.email);
    setBlockedRanges((data ?? []) as BlockedRange[]);
    setBlockedLoading(false);
  }, [user?.email, properties]);

  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);

  useEffect(() => {
    if (selectedPropertyId !== 'all' && !properties.find((p) => p.id === selectedPropertyId)) {
      setSelectedPropertyId('all');
    }
  }, [properties, selectedPropertyId]);

  // Build a map: date -> { bookings: [], blocked: boolean, blockedReason: string }
  const calendarData = useMemo(() => {
    const map: Record<string, { bookings: Booking[]; blocked: boolean; blockedReason: string }> = {};

    const relevantPropertyIds = selectedPropertyId === 'all'
      ? properties.map((p) => p.id)
      : [selectedPropertyId];

    // Fill booking dates
    const relevantBookings = bookings.filter(
      (b) => b.property_id && relevantPropertyIds.includes(b.property_id) && b.status !== 'cancelled',
    );

    for (const booking of relevantBookings) {
      const days = datesBetween(booking.check_in, booking.check_out);
      for (const d of days) {
        if (!map[d]) map[d] = { bookings: [], blocked: false, blockedReason: '' };
        if (!map[d].bookings.find((b) => b.id === booking.id)) {
          map[d].bookings.push(booking);
        }
      }
    }

    // Fill blocked dates
    const relevantBlocked = selectedPropertyId === 'all'
      ? blockedRanges
      : blockedRanges.filter((r) => r.property_id === selectedPropertyId);

    for (const range of relevantBlocked) {
      const days = datesBetween(range.start_date, range.end_date);
      for (const d of days) {
        if (!map[d]) map[d] = { bookings: [], blocked: false, blockedReason: '' };
        map[d].blocked = true;
        if (range.reason && !map[d].blockedReason) map[d].blockedReason = range.reason;
      }
    }

    return map;
  }, [bookings, blockedRanges, selectedPropertyId, properties]);

  // Build calendar grid (Monday-first)
  const calDays = useMemo(() => {
    const firstDow = new Date(calYear, calMonth - 1, 1).getDay(); // 0=Sun
    const mondayOffset = firstDow === 0 ? 6 : firstDow - 1; // shift to Mon-first
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const grid: (number | null)[] = Array(mondayOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [calYear, calMonth]);

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
  };
  const goToday = () => {
    setCalYear(new Date().getFullYear());
    setCalMonth(new Date().getMonth() + 1);
  };

  const today = new Date().toISOString().split('T')[0];

  const selectedDayData = selectedDay ? calendarData[selectedDay] : null;
  const hoveredDayData = hoveredDay ? calendarData[hoveredDay] : null;

  const propMap = Object.fromEntries(properties.map((p) => [p.id, p.title]));

  // Summary stats for the current month
  const monthStr = `${calYear}-${String(calMonth).padStart(2, '0')}`;
  const monthBookings = bookings.filter(
    (b) => (b.check_in?.startsWith(monthStr) || b.check_out?.startsWith(monthStr))
      && (selectedPropertyId === 'all' || b.property_id === selectedPropertyId)
      && b.status !== 'cancelled',
  );
  const confirmedCount = monthBookings.filter((b) => b.status === 'confirmed').length;
  const pendingCount = monthBookings.filter((b) => b.status === 'pending').length;
  const blockedDaysCount = Object.entries(calendarData).filter(([d, v]) => d.startsWith(monthStr) && v.blocked).length;

  return (
    <div>
      <div className="mb-5 md:mb-6">
        <h2 className="text-base md:text-xl font-bold text-gray-900">Booking Calendar</h2>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5">Monthly overview of all bookings and blocked dates across your properties</p>
      </div>

      {loading || blockedLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-24">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-4 h-4 flex items-center justify-center animate-spin">
              <i className="ri-loader-4-line"></i>
            </div>
            <span className="text-sm">Loading calendar…</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Property filter */}
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 flex items-center justify-center text-gray-400">
                <i className="ri-home-smile-line"></i>
              </div>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white min-w-48"
              >
                <option value="all">All properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            {/* Month nav */}
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <i className="ri-arrow-left-s-line text-gray-600"></i>
              </button>
              <div className="min-w-40 text-center">
                <span className="text-base font-bold text-gray-900">
                  {MONTHS[calMonth - 1]} {calYear}
                </span>
              </div>
              <button
                onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <i className="ri-arrow-right-s-line text-gray-600"></i>
              </button>
              <button
                onClick={goToday}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
              >
                Today
              </button>
            </div>
          </div>

          {/* Month stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div className="bg-white rounded-xl border border-gray-200 px-3 md:px-4 py-2.5 md:py-3 flex items-center gap-2 md:gap-3">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-checkbox-circle-line text-green-600 text-xs md:text-sm"></i>
              </div>
              <div>
                <p className="text-base md:text-xl font-bold text-gray-900">{confirmedCount}</p>
                <p className="text-[10px] md:text-xs text-gray-400 leading-tight">Confirmed</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-3 md:px-4 py-2.5 md:py-3 flex items-center gap-2 md:gap-3">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-time-line text-amber-600 text-xs md:text-sm"></i>
              </div>
              <div>
                <p className="text-base md:text-xl font-bold text-gray-900">{pendingCount}</p>
                <p className="text-[10px] md:text-xs text-gray-400 leading-tight">Pending</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-3 md:px-4 py-2.5 md:py-3 flex items-center gap-2 md:gap-3">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-calendar-close-line text-red-500 text-xs md:text-sm"></i>
              </div>
              <div>
                <p className="text-base md:text-xl font-bold text-gray-900">{blockedDaysCount}</p>
                <p className="text-[10px] md:text-xs text-gray-400 leading-tight">Blocked</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Calendar grid */}
            <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-3 md:p-5">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-3">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {calDays.map((day, idx) => {
                  if (!day) return <div key={idx} className="aspect-square" />;
                  const dateStr = toDateStr(calYear, calMonth, day);
                  const data = calendarData[dateStr];
                  const isToday = dateStr === today;
                  const isPast = dateStr < today;
                  const isSelected = selectedDay === dateStr;
                  const hasConfirmed = data?.bookings.some((b) => b.status === 'confirmed');
                  const hasPending = data?.bookings.some((b) => b.status === 'pending');
                  const hasCompleted = data?.bookings.some((b) => b.status === 'completed');
                  const isBlocked = data?.blocked;
                  const hasBooking = data?.bookings.length > 0;

                  let cellBg = '';
                  let cellText = isPast ? 'text-gray-300' : 'text-gray-700';
                  let dotColor = '';

                  if (isBlocked && hasConfirmed) {
                    cellBg = 'bg-green-200';
                    cellText = 'text-green-900';
                    dotColor = 'bg-red-500';
                  } else if (isBlocked) {
                    cellBg = 'bg-red-100';
                    cellText = 'text-red-600';
                  } else if (hasConfirmed) {
                    cellBg = 'bg-green-100';
                    cellText = 'text-green-800';
                    dotColor = 'bg-green-500';
                  } else if (hasPending) {
                    cellBg = 'bg-amber-100';
                    cellText = 'text-amber-800';
                    dotColor = 'bg-amber-500';
                  } else if (hasCompleted) {
                    cellBg = 'bg-gray-100';
                    cellText = 'text-gray-600';
                    dotColor = 'bg-gray-400';
                  }

                  if (isSelected) cellBg = 'ring-2 ring-emerald-500 ' + cellBg;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                      onMouseEnter={() => setHoveredDay(dateStr)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all cursor-pointer relative text-xs ${cellBg} ${cellText} ${!cellBg && !isPast ? 'hover:bg-gray-50' : ''} ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}
                    >
                      <span className={`font-medium ${isToday ? 'underline decoration-2' : ''}`}>{day}</span>
                      {(hasBooking || isBlocked) && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {isBlocked && <div className="w-1 h-1 rounded-full bg-red-500" />}
                          {hasConfirmed && <div className="w-1 h-1 rounded-full bg-green-600" />}
                          {hasPending && <div className="w-1 h-1 rounded-full bg-amber-500" />}
                        </div>
                      )}
                      {data?.bookings.length > 1 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-gray-700 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                          {data.bookings.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5 mt-5 pt-4 border-t border-gray-100 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 rounded bg-green-100 border border-green-200"></div>
                  <span>Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-200"></div>
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 rounded bg-red-100 border border-red-200"></div>
                  <span>Blocked</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 rounded bg-gray-100 border border-gray-200"></div>
                  <span>Completed</span>
                </div>
                <span className="text-xs text-gray-400 ml-auto">Click a day to see details</span>
              </div>
            </div>

            {/* Side panel: day details or upcoming */}
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
              {selectedDay && selectedDayData ? (
                <div className="flex flex-col h-full">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{fmt(selectedDay)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {selectedDayData.bookings.length} booking{selectedDayData.bookings.length !== 1 ? 's' : ''}
                        {selectedDayData.blocked ? ' · Blocked' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedDay(null)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer transition-colors text-gray-400"
                    >
                      <i className="ri-close-line text-sm"></i>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {selectedDayData.blocked && (
                      <div className="mx-4 mt-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <i className="ri-calendar-close-line text-red-500 text-xs"></i>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-red-700">Blocked date</p>
                          {selectedDayData.blockedReason && (
                            <p className="text-xs text-red-500 mt-0.5">{selectedDayData.blockedReason}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedDayData.bookings.length === 0 ? (
                      <div className="flex flex-col items-center py-12 px-4 text-gray-400">
                        <div className="w-8 h-8 flex items-center justify-center mb-2">
                          <i className="ri-calendar-line text-2xl"></i>
                        </div>
                        <p className="text-xs text-center">No bookings on this date</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {selectedDayData.bookings.map((b) => {
                          const col = statusColor(b.status);
                          return (
                            <div key={b.id} className="px-4 py-3.5">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.bg} ${col.text}`}>
                                  {col.label}
                                </span>
                                {b.payment_status === 'paid' && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                                    Paid
                                  </span>
                                )}
                              </div>
                              {canSeeGuestDetails(b.check_in) ? (
                                <div className="mb-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-semibold text-gray-900">{b.user_name || 'Guest'}</p>
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                      <i className="ri-eye-line text-[10px]"></i>
                                      Visible
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">{b.user_email}</p>
                                </div>
                              ) : (
                                <div className="mb-1.5">
                                  <p className="text-sm font-semibold text-gray-700">{maskName(b.user_name)}</p>
                                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                    <i className="ri-lock-line text-[10px]"></i>
                                    Details revealed on check-in
                                  </p>
                                </div>
                              )}
                              <p className="text-xs text-gray-500 truncate mb-1.5 notranslate" translate="no">{b.property_title}</p>
                              {selectedPropertyId === 'all' && b.property_id && propMap[b.property_id] && (
                                <p className="text-xs text-gray-400 mb-1.5 truncate">
                                  <i className="ri-home-line mr-1"></i>
                                  {propMap[b.property_id]}
                                </p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span>
                                  <i className="ri-calendar-line mr-1"></i>
                                  {fmt(b.check_in)} → {fmt(b.check_out)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1.5">
                                <span className="text-xs text-gray-400">
                                  <i className="ri-group-line mr-1"></i>
                                  {b.guests} guest{b.guests !== 1 ? 's' : ''}
                                </span>
                                {b.total_price && (
                                  <span className="text-sm font-bold text-gray-900">₾{b.total_price.toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Upcoming bookings list */
                <div className="flex flex-col h-full">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-900">Upcoming Bookings</p>
                    <p className="text-xs text-gray-400 mt-0.5">Next stays across your properties</p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {(() => {
                      const upcoming = bookings
                        .filter(
                          (b) =>
                            b.check_in >= today &&
                            b.status !== 'cancelled' &&
                            (selectedPropertyId === 'all' || b.property_id === selectedPropertyId),
                        )
                        .sort((a, b) => a.check_in.localeCompare(b.check_in))
                        .slice(0, 12);

                      if (upcoming.length === 0) {
                        return (
                          <div className="flex flex-col items-center py-12 px-4 text-gray-400">
                            <div className="w-9 h-9 flex items-center justify-center mb-2">
                              <i className="ri-calendar-check-line text-3xl"></i>
                            </div>
                            <p className="text-xs text-center">No upcoming bookings yet</p>
                          </div>
                        );
                      }

                      return (
                        <div className="divide-y divide-gray-50">
                          {upcoming.map((b) => {
                            const col = statusColor(b.status);
                            return (
                              <div key={b.id} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${col.bg} ${col.text}`}>
                                    {col.label}
                                  </span>
                                  {b.total_price && (
                                    <span className="text-xs font-bold text-gray-900">₾{b.total_price.toLocaleString()}</span>
                                  )}
                                </div>
                                {canSeeGuestDetails(b.check_in) ? (
                                  <p className="text-xs font-semibold text-gray-800">{b.user_name || 'Guest'}</p>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <p className="text-xs font-semibold text-gray-600">{maskName(b.user_name)}</p>
                                    <i className="ri-lock-line text-gray-400 text-[10px]"></i>
                                  </div>
                                )}
                                <p className="text-[10px] text-gray-400 truncate notranslate" translate="no">{b.property_title}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  {fmt(b.check_in)} → {fmt(b.check_out)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
