import { useMemo } from 'react';
import { useTranslation, type TranslateFn } from '@lib/i18n';

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
}

function fmt(d: string, lang: string) {
  return new Date(d).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTs(d: string, lang: string) {
  return new Date(d).toLocaleDateString(lang, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function statusBadge(s: string) {
  if (s === 'approved') return 'bg-green-100 text-green-700';
  if (s === 'rejected') return 'bg-red-100 text-red-600';
  return 'bg-amber-100 text-amber-700';
}

function statusLabel(s: string, t: TranslateFn) {
  if (s === 'approved') return t('host.dateChange.status.approved');
  if (s === 'rejected') return t('host.bookings.status.rejected');
  if (s === 'pending') return t('host.bookings.status.pending');
  return s;
}

export default function HostDateChangeSection({ bookings, loading }: Props) {
  const { t, lang } = useTranslation();
  const dateChanges = useMemo(() =>
    bookings.filter((b) => b.date_change_status !== null),
    [bookings]
  );

  return (
    <div>
      <div className="mb-5 md:mb-6">
        <h2 className="text-base md:text-xl font-bold text-gray-900">{t('host.dateChange.title')}</h2>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5">{t('host.dateChange.subtitle')}</p>
      </div>

      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line"></i>
              </div>
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          </div>
        ) : dateChanges.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <div className="w-10 h-10 flex items-center justify-center mb-2">
              <i className="ri-calendar-check-line text-3xl"></i>
            </div>
            <p className="text-sm">{t('host.dateChange.emptyTitle')}</p>
            <p className="text-xs mt-1">{t('host.dateChange.emptySubtitle')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    t('host.bookings.guest'),
                    t('host.bookings.table.property'),
                    t('host.dateChange.table.currentDates'),
                    t('host.dateChange.table.requestedDates'),
                    t('host.dateChange.table.price'),
                    t('host.dateChange.table.requested'),
                    t('host.bookings.table.status'),
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
                      <p className="text-xs md:text-sm text-gray-500 line-through">{fmt(b.check_in, lang)}</p>
                      <p className="text-xs text-gray-400 line-through">→ {fmt(b.check_out, lang)}</p>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4 whitespace-nowrap">
                      <p className="text-xs md:text-sm font-medium text-gray-900">
                        {b.requested_check_in ? fmt(b.requested_check_in, lang) : '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {b.requested_check_out ? `→ ${fmt(b.requested_check_out, lang)}` : ''}
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
                        {b.date_change_requested_at ? fmtTs(b.date_change_requested_at, lang) : '—'}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge(b.date_change_status ?? 'pending')}`}>
                        {statusLabel(b.date_change_status ?? 'pending', t)}
                      </span>
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
