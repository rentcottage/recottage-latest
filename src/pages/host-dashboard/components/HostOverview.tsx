import { useMemo } from 'react';
import { useTranslation } from '@lib/i18n';

interface Booking {
  id: string;
  property_title: string;
  status: string;
  total_price: number | null;
  payment_status: string | null;
  created_at: string;
  date_change_status: string | null;
}

interface Property {
  id: string;
  title: string;
  status: string;
}

interface Props {
  bookings: Booking[];
  properties: Property[];
  loading: boolean;
}

export default function HostOverview({ bookings, properties, loading }: Props) {
  const { t, lang } = useTranslation();

  const statusLabel = (s: string) => {
    const key = `common.status.${s}`;
    const out = t(key);
    return out === key ? s : out;
  };

  const stats = useMemo(() => {
    const active = bookings.filter((b) => b.status === 'confirmed').length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const earnings = bookings
      .filter((b) => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_price ?? 0), 0);
    const dateChangeRequests = bookings.filter((b) => b.date_change_status === 'pending').length;
    return { active, cancelled, completed, pending, earnings, dateChangeRequests };
  }, [bookings]);

  const cards = [
    {
      label: t('host.dashboard.nav.myProperties'),
      value: loading ? '—' : String(properties.length),
      icon: 'ri-home-smile-line',
      color: 'text-red-500',
      bg: 'bg-red-50',
      sub: t('host.overview.approvedCount', { count: properties.filter((p) => p.status === 'approved').length }),
    },
    {
      label: t('host.overview.activeBookings'),
      value: loading ? '—' : String(stats.active),
      icon: 'ri-calendar-check-line',
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      sub: t('host.overview.pendingRequests', { count: stats.pending }),
    },
    {
      label: t('host.dashboard.nav.cancelled'),
      value: loading ? '—' : String(stats.cancelled),
      icon: 'ri-close-circle-line',
      color: 'text-red-500',
      bg: 'bg-red-50',
      sub: t('host.overview.totalCancellations'),
    },
    {
      label: t('host.overview.completed'),
      value: loading ? '—' : String(stats.completed),
      icon: 'ri-checkbox-circle-line',
      color: 'text-gray-600',
      bg: 'bg-gray-100',
      sub: t('host.overview.finishedStays'),
    },
    {
      label: t('host.earnings.totalEarnings'),
      value: loading ? '—' : `₾${stats.earnings.toLocaleString()}`,
      icon: 'ri-money-cny-circle-line',
      color: 'text-red-500',
      bg: 'bg-red-50',
      sub: t('host.earnings.confirmedPlusCompleted'),
    },
    {
      label: t('host.dashboard.nav.dateRequests'),
      value: loading ? '—' : String(stats.dateChangeRequests),
      icon: 'ri-calendar-2-line',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      sub: t('host.overview.pendingDateChanges'),
    },
  ];

  return (
    <div>
      <div className="mb-5 md:mb-6">
        <h2 className="text-base md:text-xl font-bold text-gray-900">{t('host.overview.title')}</h2>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5">{t('host.overview.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-5 md:mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-card border border-line shadow-card p-3 md:p-6">
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <span className="text-xs md:text-sm text-gray-500 leading-tight">{c.label}</span>
              <div className={`w-7 h-7 md:w-9 md:h-9 flex-shrink-0 ${c.bg} rounded-lg flex items-center justify-center`}>
                <i className={`${c.icon} ${c.color} text-sm md:text-base`}></i>
              </div>
            </div>
            <p className="text-xl md:text-3xl font-bold text-gray-900 mb-0.5 md:mb-1">
              {loading ? (
                <span className="inline-block w-12 md:w-16 h-6 md:h-8 bg-gray-100 rounded animate-pulse" />
              ) : (
                c.value
              )}
            </p>
            <p className="text-xs text-gray-400 leading-tight">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent bookings summary */}
      <div className="bg-white rounded-card border border-line shadow-card p-4 md:p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 md:mb-4">{t('host.overview.recentBookingActivity')}</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 md:h-12 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center py-8 md:py-10 text-gray-400">
            <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center mb-2">
              <i className="ri-inbox-line text-2xl md:text-3xl"></i>
            </div>
            <p className="text-sm">{t('host.overview.noBookingsYet')}</p>
            <p className="text-xs mt-1 text-center">{t('host.overview.noBookingsHint')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {bookings.slice(0, 8).map((b) => {
              const badgeMap: Record<string, string> = {
                pending: 'bg-amber-100 text-amber-700',
                confirmed: 'bg-green-100 text-green-700',
                cancelled: 'bg-red-100 text-red-600',
                completed: 'bg-gray-100 text-gray-600',
              };
              return (
                <div key={b.id} className="flex items-center justify-between py-2.5 md:py-3 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 flex-shrink-0 bg-gray-50 rounded-lg flex items-center justify-center">
                      <i className="ri-home-line text-gray-400 text-xs"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium text-gray-900 truncate notranslate" translate="no">{b.property_title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(b.created_at).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
                    <span className="text-xs md:text-sm font-semibold text-gray-900">
                      {b.total_price ? `₾${b.total_price}` : '—'}
                    </span>
                    <span className={`px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full text-xs font-semibold capitalize ${badgeMap[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel(b.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
