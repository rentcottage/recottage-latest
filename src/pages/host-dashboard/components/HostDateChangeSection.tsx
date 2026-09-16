import { useMemo, useState } from 'react';
import { useT } from '../../../i18n';
import { supabase } from '../../../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

interface Booking {
  id: string;
  user_name: string | null;
  user_email: string;
  property_title: string;
  property_location: string | null;
  check_in: string;
  check_out: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  requested_total_price: number | null;
  total_price: number | null;
  date_change_status: string | null;
  date_change_requested_at: string | null;
}

interface Props {
  bookings: Booking[];
  loading: boolean;
  onRefresh?: () => void;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTs(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function statusBadge(s: string) {
  if (s === 'approved') return 'bg-green-100 text-green-700';
  if (s === 'rejected') return 'bg-red-100 text-red-600';
  return 'bg-amber-100 text-amber-700';
}

const STATUS_KEY: Record<string, string> = {
  approved: 'host.common.statusApproved',
  rejected: 'host.common.statusRejected',
  pending: 'host.common.statusPending',
};

export default function HostDateChangeSection({ bookings, loading, onRefresh }: Props) {
  const { t } = useT();
  const [actionLoading, setActionLoading] = useState<Record<string, 'approve' | 'reject' | null>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});

  // booking-handler authorizes this from the signed-in host's session token
  // and checks property ownership server-side; nothing in the body is trusted.
  const decide = async (bookingId: string, decision: 'approve' | 'reject') => {
    setActionLoading((prev) => ({ ...prev, [bookingId]: decision }));
    setActionError((prev) => ({ ...prev, [bookingId]: '' }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/booking-handler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${sessionData?.session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ action: decision === 'approve' ? 'host-approve-dates' : 'host-reject-dates', bookingId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? t('host.bookings.somethingWentWrong'));
      onRefresh?.();
    } catch (e: unknown) {
      setActionError((prev) => ({ ...prev, [bookingId]: e instanceof Error ? e.message : t('host.bookings.somethingWentWrong') }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [bookingId]: null }));
    }
  };
  const dateChanges = useMemo(() =>
    bookings.filter((b) => b.date_change_status !== null),
    [bookings]
  );

  return (
    <div>
      <div className="mb-5 md:mb-6">
        <h2 className="text-base md:text-xl font-bold text-gray-900">{t('host.dateChange.title')}</h2>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5">{t('host.dateChange.sub')}</p>
      </div>

      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line"></i>
              </div>
              <span className="text-sm">{t('host.common.loading')}</span>
            </div>
          </div>
        ) : dateChanges.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <div className="w-10 h-10 flex items-center justify-center mb-2">
              <i className="ri-calendar-check-line text-3xl"></i>
            </div>
            <p className="text-sm">{t('host.dateChange.noRequestsTitle')}</p>
            <p className="text-xs mt-1">{t('host.dateChange.noRequestsSub')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    t('host.dateChange.colGuest'),
                    t('host.dateChange.colProperty'),
                    t('host.dateChange.colCurrentDates'),
                    t('host.dateChange.colRequestedDates'),
                    t('host.dateChange.colPrice'),
                    t('host.dateChange.colRequested'),
                    t('host.dateChange.colStatus'),
                    t('host.bookings.colActions'),
                  ].map((h) => (
                    <th key={h} className="px-3 md:px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dateChanges.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 md:px-5 py-3 md:py-4">
                      <p className="text-xs md:text-sm font-medium text-gray-900">{b.user_name || '—'}</p>
                      <p className="text-xs text-gray-400">{b.user_email}</p>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4">
                      <p className="text-xs md:text-sm font-medium text-gray-900 max-w-[120px] md:max-w-[140px] truncate notranslate" translate="no">{b.property_title}</p>
                      {b.property_location && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <i className="ri-map-pin-line text-xs"></i>
                          {b.property_location}
                        </p>
                      )}
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4 whitespace-nowrap">
                      <p className="text-xs md:text-sm text-gray-500 line-through">{fmt(b.check_in)}</p>
                      <p className="text-xs text-gray-400 line-through">→ {fmt(b.check_out)}</p>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4 whitespace-nowrap">
                      <p className="text-xs md:text-sm font-medium text-gray-900">
                        {b.requested_check_in ? fmt(b.requested_check_in) : '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {b.requested_check_out ? `→ ${fmt(b.requested_check_out)}` : ''}
                      </p>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4 whitespace-nowrap">
                      {b.requested_total_price != null ? (
                        <div>
                          <p className="text-xs md:text-sm font-semibold text-gray-900">₾{b.requested_total_price}</p>
                          {b.total_price && b.total_price !== b.requested_total_price && (
                            <p className="text-xs text-gray-400 line-through">₾{b.total_price}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4 whitespace-nowrap">
                      <span className="text-xs text-gray-400">
                        {b.date_change_requested_at ? fmtTs(b.date_change_requested_at) : '—'}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge(b.date_change_status ?? 'pending')}`}>
                        {b.date_change_status && STATUS_KEY[b.date_change_status] ? t(STATUS_KEY[b.date_change_status]) : b.date_change_status}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4 whitespace-nowrap">
                      {b.date_change_status === 'pending' ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => decide(b.id, 'approve')}
                              disabled={!!actionLoading[b.id]}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                            >
                              <i className={actionLoading[b.id] === 'approve' ? 'ri-loader-4-line animate-spin' : 'ri-check-line'}></i>
                              {t('host.bookings.approve')}
                            </button>
                            <button
                              onClick={() => decide(b.id, 'reject')}
                              disabled={!!actionLoading[b.id]}
                              className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                            >
                              <i className={actionLoading[b.id] === 'reject' ? 'ri-loader-4-line animate-spin' : 'ri-close-line'}></i>
                              {t('host.bookings.reject')}
                            </button>
                          </div>
                          {actionError[b.id] && (
                            <p className="text-xs text-red-500 max-w-[220px] whitespace-normal">{actionError[b.id]}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
