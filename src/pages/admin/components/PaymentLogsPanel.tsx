import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface StatusLog {
  id: string;
  booking_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  changed_by: string | null;
  note: string | null;
  created_at: string;
  // joined from bookings
  booking?: {
    user_email: string;
    user_name: string | null;
    property_title: string;
    total_price: number;
    payment_status: string | null;
    payment_method: string | null;
  } | null;
}

type EventFilter = 'all' | 'bog_callback' | 'payment' | 'status_change' | 'admin';

function eventBadge(eventType: string): { label: string; cls: string; icon: string } {
  const t = eventType?.toLowerCase() ?? '';
  if (t.includes('bog') || t.includes('callback')) {
    return { label: 'BOG Callback', cls: 'bg-violet-100 text-violet-700', icon: 'ri-bank-card-line' };
  }
  if (t.includes('payment_verified') || t === 'payment_success') {
    return { label: 'Payment Verified', cls: 'bg-green-100 text-green-700', icon: 'ri-shield-check-line' };
  }
  if (t.includes('payment_failed') || t === 'payment_failure') {
    return { label: 'Payment Failed', cls: 'bg-red-100 text-red-600', icon: 'ri-shield-cross-line' };
  }
  if (t.includes('payment')) {
    return { label: 'Payment Event', cls: 'bg-emerald-100 text-emerald-700', icon: 'ri-secure-payment-line' };
  }
  if (t.includes('confirm')) {
    return { label: 'Confirmed', cls: 'bg-green-100 text-green-700', icon: 'ri-checkbox-circle-line' };
  }
  if (t.includes('reject') || t.includes('cancel')) {
    return { label: 'Cancelled/Rejected', cls: 'bg-red-100 text-red-600', icon: 'ri-close-circle-line' };
  }
  if (t.includes('admin')) {
    return { label: 'Admin Action', cls: 'bg-orange-100 text-orange-700', icon: 'ri-admin-line' };
  }
  return { label: eventType, cls: 'bg-gray-100 text-gray-600', icon: 'ri-file-list-line' };
}

function statusPill(status: string | null) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'confirmed') return 'bg-green-100 text-green-700';
  if (s.includes('cancel') || s.includes('reject') || s.includes('fail')) return 'bg-red-100 text-red-600';
  if (s.includes('pending')) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}

function formatTs(str: string) {
  return new Date(str).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatTsShort(str: string) {
  return new Date(str).toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function timeAgo(str: string) {
  const diff = Date.now() - new Date(str).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function matchesFilter(log: StatusLog, filter: EventFilter): boolean {
  const t = log.event_type?.toLowerCase() ?? '';
  if (filter === 'all') return true;
  if (filter === 'bog_callback') return t.includes('bog') || t.includes('callback');
  if (filter === 'payment') return t.includes('payment');
  if (filter === 'status_change') return t.includes('confirm') || t.includes('reject') || t.includes('cancel') || t.includes('status');
  if (filter === 'admin') return t.includes('admin');
  return true;
}

// ─── Log Detail Drawer ────────────────────────────────────────────────────────
interface LogDrawerProps {
  log: StatusLog;
  onClose: () => void;
}

function LogDrawer({ log, onClose }: LogDrawerProps) {
  const badge = eventBadge(log.event_type);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[520px] max-w-full h-screen bg-white overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <i className={`${badge.icon} text-violet-600 text-sm`}></i>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Log Entry Detail</h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{log.id.slice(0, 16)}…</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-5">
          {/* Timestamp */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <i className="ri-time-line text-gray-400 text-sm"></i>
            </div>
            <div>
              <p className="text-xs text-gray-400">Timestamp</p>
              <p className="text-sm font-semibold text-gray-900">{formatTs(log.created_at)}</p>
            </div>
          </div>

          {/* Event Type */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Event Type</p>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${badge.cls}`}>
              <div className="w-3 h-3 flex items-center justify-center">
                <i className={badge.icon}></i>
              </div>
              {badge.label}
            </span>
            <p className="text-xs text-gray-400 font-mono mt-2">{log.event_type}</p>
          </div>

          {/* Status Transition */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status Transition</p>
            <div className="flex items-center gap-3">
              {log.from_status ? (
                <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${statusPill(log.from_status) ?? 'bg-gray-100 text-gray-600'}`}>
                  {log.from_status}
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-400 italic">—</span>
              )}
              <div className="w-4 h-4 flex items-center justify-center text-gray-400">
                <i className="ri-arrow-right-line text-sm"></i>
              </div>
              {log.to_status ? (
                <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${statusPill(log.to_status) ?? 'bg-gray-100 text-gray-600'}`}>
                  {log.to_status}
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-400 italic">—</span>
              )}
            </div>
          </div>

          {/* Changed By */}
          {log.changed_by && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Triggered By</p>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-user-line text-gray-400 text-sm"></i>
                </div>
                <span className="text-sm text-gray-700 font-mono">{log.changed_by}</span>
              </div>
            </div>
          )}

          {/* Note / Raw Payload */}
          {log.note && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Note / Payload</p>
              <div className="bg-gray-900 rounded-xl px-4 py-4 overflow-x-auto">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(log.note ?? ''), null, 2);
                    } catch {
                      return log.note;
                    }
                  })()}
                </pre>
              </div>
            </div>
          )}

          {/* Booking Info */}
          {log.booking && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Linked Booking</p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className="ri-user-line text-gray-400 text-sm"></i>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Guest</p>
                    <p className="text-sm font-medium text-gray-900">{log.booking.user_name || log.booking.user_email}</p>
                    {log.booking.user_name && <p className="text-xs text-gray-400">{log.booking.user_email}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className="ri-home-4-line text-gray-400 text-sm"></i>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Property</p>
                    <p className="text-sm font-medium text-gray-900">{log.booking.property_title}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="text-sm font-semibold text-gray-900">₾{log.booking.total_price}</p>
                  </div>
                  {log.booking.payment_method && (
                    <div>
                      <p className="text-xs text-gray-400">Method</p>
                      <p className="text-sm font-medium text-gray-700">{log.booking.payment_method}</p>
                    </div>
                  )}
                  {log.booking.payment_status && (
                    <div>
                      <p className="text-xs text-gray-400">Payment Status</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusPill(log.booking.payment_status) ?? 'bg-gray-100 text-gray-600'}`}>
                        {log.booking.payment_status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Booking ID */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Booking ID</p>
            <p className="text-xs font-mono text-gray-500 bg-gray-50 rounded-lg px-3 py-2 break-all">{log.booking_id}</p>
          </div>

          {/* Log ID */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Log ID</p>
            <p className="text-xs font-mono text-gray-400 bg-gray-50 rounded-lg px-3 py-2 break-all">{log.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Failure Alert Banner ─────────────────────────────────────────────────────
interface FailureAlertBannerProps {
  failedLogs: StatusLog[];
  onViewLog: (log: StatusLog) => void;
  onDismiss: () => void;
}

function FailureAlertBanner({ failedLogs, onViewLog, onDismiss }: FailureAlertBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? failedLogs : failedLogs.slice(0, 3);

  return (
    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 overflow-hidden">
      {/* Banner header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-red-600">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 flex items-center justify-center bg-white/20 rounded-lg flex-shrink-0">
            <i className="ri-alarm-warning-line text-white text-base"></i>
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">
              {failedLogs.length} BOG Payment Failure{failedLogs.length !== 1 ? 's' : ''} Detected
            </p>
            <p className="text-xs text-red-100 mt-0.5">
              Immediate attention required — review failed callbacks below
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-white/20 text-white text-xs font-bold rounded-full">
            {failedLogs.length}
          </span>
          <button
            onClick={onDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
            title="Dismiss alert"
          >
            <i className="ri-close-line text-base"></i>
          </button>
        </div>
      </div>

      {/* Failure list */}
      <div className="divide-y divide-red-100">
        {shown.map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between px-5 py-3 hover:bg-red-100/50 transition-colors"
          >
            <div className="flex items-center gap-4 min-w-0">
              {/* Icon */}
              <div className="w-8 h-8 flex items-center justify-center bg-red-100 rounded-lg flex-shrink-0">
                <i className="ri-shield-cross-line text-red-500 text-sm"></i>
              </div>

              {/* Details */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-red-700 font-mono bg-red-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                    {log.event_type}
                  </span>
                  {log.to_status && (
                    <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                      → {log.to_status}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500 font-mono">
                    Booking: {log.booking_id.slice(0, 8)}…
                  </span>
                  {log.booking?.property_title && (
                    <span className="text-xs text-gray-500 truncate max-w-[160px]">
                      {log.booking.property_title}
                    </span>
                  )}
                  {log.booking?.user_email && (
                    <span className="text-xs text-gray-400 truncate max-w-[160px]">
                      {log.booking.user_email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-gray-600">{formatTsShort(log.created_at)}</p>
                <p className="text-xs text-gray-400">{timeAgo(log.created_at)}</p>
              </div>
              <button
                onClick={() => onViewLog(log)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <div className="w-3 h-3 flex items-center justify-center">
                  <i className="ri-eye-line"></i>
                </div>
                Inspect
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Show more / less */}
      {failedLogs.length > 3 && (
        <div className="px-5 py-2.5 border-t border-red-100 bg-red-50/80">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 cursor-pointer transition-colors"
          >
            <div className="w-3 h-3 flex items-center justify-center">
              <i className={expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}></i>
            </div>
            {expanded ? 'Show less' : `Show ${failedLogs.length - 3} more failure${failedLogs.length - 3 !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function PaymentLogsPanel() {
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<StatusLog | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [newCount, setNewCount] = useState(0);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('booking_status_logs')
      .select(`
        id, booking_id, event_type, from_status, to_status, changed_by, note, created_at,
        booking:bookings(user_email, user_name, property_title, total_price, payment_status, payment_method)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      if (silent) {
        setLogs((prev) => {
          const prevIds = new Set(prev.map((l) => l.id));
          const incoming = data as unknown as StatusLog[];
          const fresh = incoming.filter((l) => !prevIds.has(l.id));
          if (fresh.length > 0) {
            setNewCount((c) => c + fresh.length);
            // Re-surface the alert if new failures arrive
            const hasNewFailures = fresh.some((l) => l.event_type?.toLowerCase().includes('failed'));
            if (hasNewFailures) setAlertDismissed(false);
          }
          return incoming;
        });
      } else {
        setLogs(data as unknown as StatusLog[]);
      }
      setLastRefreshed(new Date());
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Live polling
  useEffect(() => {
    if (liveMode) {
      intervalRef.current = setInterval(() => fetchLogs(true), 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [liveMode, fetchLogs]);

  const filtered = logs.filter((log) => {
    if (!matchesFilter(log, filter)) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      log.event_type?.toLowerCase().includes(q) ||
      log.booking_id?.toLowerCase().includes(q) ||
      log.changed_by?.toLowerCase().includes(q) ||
      log.note?.toLowerCase().includes(q) ||
      log.booking?.user_email?.toLowerCase().includes(q) ||
      log.booking?.user_name?.toLowerCase().includes(q) ||
      log.booking?.property_title?.toLowerCase().includes(q)
    );
  });

  const counts = {
    all: logs.length,
    bog_callback: logs.filter((l) => matchesFilter(l, 'bog_callback')).length,
    payment: logs.filter((l) => matchesFilter(l, 'payment')).length,
    status_change: logs.filter((l) => matchesFilter(l, 'status_change')).length,
    admin: logs.filter((l) => matchesFilter(l, 'admin')).length,
  };

  // All logs where event_type contains "failed" (case-insensitive)
  const failedLogs = logs.filter((l) => l.event_type?.toLowerCase().includes('failed'));

  const filterTabs: { key: EventFilter; label: string; icon: string; color: string }[] = [
    { key: 'all', label: 'All Events', icon: 'ri-list-check', color: 'text-gray-600' },
    { key: 'bog_callback', label: 'BOG Callbacks', icon: 'ri-bank-card-line', color: 'text-violet-600' },
    { key: 'payment', label: 'Payments', icon: 'ri-secure-payment-line', color: 'text-emerald-600' },
    { key: 'status_change', label: 'Status Changes', icon: 'ri-exchange-line', color: 'text-amber-600' },
    { key: 'admin', label: 'Admin Actions', icon: 'ri-admin-line', color: 'text-orange-600' },
  ];

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
            <i className="ri-shield-keyhole-line text-violet-600 text-sm"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Payment Verification Logs</h2>
            <p className="text-xs text-gray-400">Real-time audit trail — BOG callbacks &amp; booking status events</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live mode toggle */}
          <button
            onClick={() => { setLiveMode((v) => !v); setNewCount(0); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all border ${
              liveMode
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-line text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${liveMode ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
            {liveMode ? 'Live' : 'Live Off'}
          </button>

          {newCount > 0 && (
            <span className="px-2.5 py-1 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">
              +{newCount} new
            </span>
          )}

          <button
            onClick={() => { fetchLogs(); setNewCount(0); }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-refresh-line"></i>
            </div>
            Refresh
          </button>
        </div>
      </div>

      {/* Failure alert banner */}
      {!alertDismissed && failedLogs.length > 0 && (
        <FailureAlertBanner
          failedLogs={failedLogs}
          onViewLog={(log) => setSelectedLog(log)}
          onDismiss={() => setAlertDismissed(true)}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Total Events', count: counts.all, icon: 'ri-list-check', color: 'text-gray-600', bg: 'bg-gray-100' },
          { label: 'BOG Callbacks', count: counts.bog_callback, icon: 'ri-bank-card-line', color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Payment Events', count: counts.payment, icon: 'ri-secure-payment-line', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Status Changes', count: counts.status_change, icon: 'ri-exchange-line', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Admin Actions', count: counts.admin, icon: 'ri-admin-line', color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-card border border-line shadow-card px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{s.label}</span>
              <div className={`w-6 h-6 ${s.bg} rounded-md flex items-center justify-center`}>
                <i className={`${s.icon} ${s.color} text-xs`}></i>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.count}</p>
          </div>
        ))}
      </div>

      {/* Last refreshed */}
      <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
        <div className="w-3 h-3 flex items-center justify-center">
          <i className="ri-time-line"></i>
        </div>
        Last refreshed: {formatTs(lastRefreshed.toISOString())}
        {liveMode && (
          <span className="ml-2 inline-flex items-center gap-1 text-green-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Polling every 5s
          </span>
        )}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        {/* Filters + Search */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
            {filterTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  filter === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="w-3 h-3 flex items-center justify-center">
                  <i className={t.icon}></i>
                </div>
                {t.label}
                <span className={`text-xs font-semibold ${filter === t.key ? t.color : 'text-gray-400'}`}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <i className="ri-search-line text-gray-400 text-sm"></i>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event, booking ID, guest…"
              className="pl-9 pr-4 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 w-72"
            />
          </div>
        </div>

        {/* Log table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-5 h-5 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line text-xl"></i>
              </div>
              <span className="text-sm">Loading logs…</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-12 h-12 flex items-center justify-center mb-3">
              <i className="ri-file-list-3-line text-4xl"></i>
            </div>
            <p className="text-sm font-medium">No log entries found</p>
            <p className="text-xs mt-1">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Time', 'Event Type', 'Booking', 'Guest', 'Status Change', 'Triggered By', 'Note', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log) => {
                  const badge = eventBadge(log.event_type);
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Time */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs font-medium text-gray-800">{formatTsShort(log.created_at)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{timeAgo(log.created_at)}</p>
                      </td>

                      {/* Event Type */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${badge.cls}`}>
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className={badge.icon}></i>
                          </div>
                          {badge.label}
                        </span>
                        <p className="text-xs text-gray-400 font-mono mt-1 max-w-[140px] truncate" title={log.event_type}>
                          {log.event_type}
                        </p>
                      </td>

                      {/* Booking ID */}
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono text-gray-500 max-w-[100px] truncate" title={log.booking_id}>
                          {log.booking_id.slice(0, 8)}…
                        </p>
                        {log.booking?.property_title && (
                          <p className="text-xs text-gray-400 mt-0.5 max-w-[120px] truncate" title={log.booking.property_title}>
                            {log.booking.property_title}
                          </p>
                        )}
                      </td>

                      {/* Guest */}
                      <td className="px-4 py-3">
                        {log.booking ? (
                          <>
                            <p className="text-xs font-medium text-gray-800 whitespace-nowrap">
                              {log.booking.user_name || '—'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 max-w-[140px] truncate">
                              {log.booking.user_email}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Status Change */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.from_status ? (
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${statusPill(log.from_status) ?? 'bg-gray-100 text-gray-600'}`}>
                              {log.from_status}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                          {(log.from_status || log.to_status) && (
                            <div className="w-3 h-3 flex items-center justify-center text-gray-400">
                              <i className="ri-arrow-right-line text-xs"></i>
                            </div>
                          )}
                          {log.to_status ? (
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${statusPill(log.to_status) ?? 'bg-gray-100 text-gray-600'}`}>
                              {log.to_status}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Triggered By */}
                      <td className="px-4 py-3">
                        {log.changed_by ? (
                          <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                            {log.changed_by}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Note preview */}
                      <td className="px-4 py-3 max-w-[180px]">
                        {log.note ? (
                          <p className="text-xs text-gray-500 truncate font-mono" title={log.note}>
                            {log.note.slice(0, 60)}{log.note.length > 60 ? '…' : ''}
                          </p>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* View */}
                      <td className="px-4 py-3">
                        <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-violet-100 text-gray-400 hover:text-violet-600 transition-colors">
                          <i className="ri-eye-line text-sm"></i>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing <strong>{filtered.length}</strong> of <strong>{logs.length}</strong> log entries (latest 200)
            </p>
            <p className="text-xs text-gray-400">Click any row to inspect full payload</p>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedLog && (
        <LogDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
