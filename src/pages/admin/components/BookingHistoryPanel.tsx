import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useTranslation } from '@lib/i18n';
import type { Lang } from '@lib/i18n';

interface LogEntry {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string;
  changed_by: string;
  note: string | null;
  created_at: string;
}

interface Props {
  bookingId: string;
  isOpen: boolean;
}

interface EventConfig {
  icon: string;
  label: string;
  color: string;
  dotColor: string;
  bg: string;
}

// `label` holds an i18n key, resolved with t() at render time.
const EVENT_CONFIG: Record<string, EventConfig> = {
  created: {
    icon: 'ri-add-circle-line',
    label: 'admin.history.eventCreated',
    color: 'text-gray-600',
    dotColor: 'bg-gray-400',
    bg: 'bg-gray-100',
  },
  confirmed: {
    icon: 'ri-checkbox-circle-line',
    label: 'admin.history.eventConfirmed',
    color: 'text-green-600',
    dotColor: 'bg-green-500',
    bg: 'bg-green-50',
  },
  host_approved: {
    icon: 'ri-checkbox-circle-line',
    label: 'admin.history.eventHostApproved',
    color: 'text-green-600',
    dotColor: 'bg-green-500',
    bg: 'bg-green-50',
  },
  rejected: {
    icon: 'ri-close-circle-line',
    label: 'common.rejected',
    color: 'text-red-500',
    dotColor: 'bg-red-400',
    bg: 'bg-red-50',
  },
  host_rejected: {
    icon: 'ri-close-circle-line',
    label: 'admin.history.eventHostRejected',
    color: 'text-red-500',
    dotColor: 'bg-red-400',
    bg: 'bg-red-50',
  },
  host_cancelled: {
    icon: 'ri-calendar-close-line',
    label: 'admin.history.eventHostCancelled',
    color: 'text-red-600',
    dotColor: 'bg-red-500',
    bg: 'bg-red-50',
  },
  cancelled: {
    icon: 'ri-close-circle-line',
    label: 'admin.history.eventCancelled',
    color: 'text-red-500',
    dotColor: 'bg-red-400',
    bg: 'bg-red-50',
  },
  dates_changed: {
    icon: 'ri-calendar-2-line',
    label: 'admin.history.eventDatesChanged',
    color: 'text-amber-600',
    dotColor: 'bg-amber-400',
    bg: 'bg-amber-50',
  },
  dates_approved: {
    icon: 'ri-calendar-check-line',
    label: 'admin.history.eventDatesApproved',
    color: 'text-green-600',
    dotColor: 'bg-green-400',
    bg: 'bg-green-50',
  },
  dates_rejected: {
    icon: 'ri-calendar-close-line',
    label: 'admin.history.eventDatesRejected',
    color: 'text-red-500',
    dotColor: 'bg-red-400',
    bg: 'bg-red-50',
  },
  date_change_requested: {
    icon: 'ri-calendar-2-line',
    label: 'admin.history.eventDateChangeRequested',
    color: 'text-amber-600',
    dotColor: 'bg-amber-400',
    bg: 'bg-amber-50',
  },
  payment_initiated: {
    icon: 'ri-bank-card-line',
    label: 'admin.history.eventPaymentInitiated',
    color: 'text-gray-500',
    dotColor: 'bg-gray-400',
    bg: 'bg-gray-50',
  },
};

// Values are i18n keys, resolved with t() at render time.
const actorLabel: Record<string, string> = {
  admin: 'admin.history.actorAdmin',
  customer: 'admin.history.actorCustomer',
  system: 'admin.history.actorSystem',
};

function formatTs(ts: string, lang: Lang) {
  return new Date(ts).toLocaleString(lang, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BookingHistoryPanel({ bookingId, isOpen }: Props) {
  const { t, lang } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!isOpen || fetched) return;
    setLoading(true);
    supabase
      .from('booking_status_logs')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setLogs((data as LogEntry[]) ?? []);
        setLoading(false);
        setFetched(true);
      });
  }, [isOpen, bookingId, fetched]);

  if (!isOpen) return null;

  return (
    <div className="px-6 pb-5 pt-1 bg-gray-50 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-4 pt-3">
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-history-line text-gray-400 text-sm"></i>
        </div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {t('admin.history.title')}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-3 pl-2">
          <div className="w-4 h-4 flex items-center justify-center animate-spin">
            <i className="ri-loader-4-line text-sm"></i>
          </div>
          <span className="text-xs">{t('admin.history.loading')}</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center gap-2 text-gray-400 py-3 pl-2">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-information-line text-sm"></i>
          </div>
          <span className="text-xs">{t('admin.history.empty')}</span>
        </div>
      ) : (
        <ol className="relative border-l-2 border-line ml-2 space-y-0">
          {logs.map((entry, idx) => {
            const cfg = EVENT_CONFIG[entry.event_type] ?? EVENT_CONFIG.created;
            const isLast = idx === logs.length - 1;
            return (
              <li key={entry.id} className={`ml-5 ${isLast ? 'pb-1' : 'pb-5'}`}>
                {/* Dot */}
                <span
                  className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ${cfg.dotColor} ring-2 ring-white`}
                  style={{ marginTop: '2px' }}
                />
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg} w-full`}>
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className={`${cfg.icon} ${cfg.color} text-sm`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${cfg.color}`}>{t(cfg.label)}</span>
                      {entry.from_status && entry.from_status !== entry.to_status && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <span className="capitalize">{entry.from_status}</span>
                          <i className="ri-arrow-right-line text-xs"></i>
                          <span className="capitalize">{entry.to_status}</span>
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                        {t('admin.history.byActor', {
                          actor: actorLabel[entry.changed_by] ? t(actorLabel[entry.changed_by]) : entry.changed_by,
                        })}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{entry.note}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{formatTs(entry.created_at, lang)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
