import { useMemo } from 'react';

interface Booking {
  id: string;
  property_title: string;
  check_in: string;
  check_out: string;
  total_price: number | null;
  status: string;
  payment_status: string | null;
  created_at: string;
}

interface Props {
  bookings: Booking[];
  loading: boolean;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HostEarningsSection({ bookings, loading }: Props) {
  const stats = useMemo(() => {
    const earningBookings = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');
    const total = earningBookings.reduce((sum, b) => sum + (b.total_price ?? 0), 0);
    const confirmed = bookings.filter((b) => b.status === 'confirmed').reduce((sum, b) => sum + (b.total_price ?? 0), 0);
    const completed = bookings.filter((b) => b.status === 'completed').reduce((sum, b) => sum + (b.total_price ?? 0), 0);

    // Monthly breakdown
    const monthly: Record<string, number> = {};
    earningBookings.forEach((b) => {
      const month = new Date(b.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      monthly[month] = (monthly[month] ?? 0) + (b.total_price ?? 0);
    });

    return { total, confirmed, completed, monthly, earningBookings };
  }, [bookings]);

  const monthlyEntries = Object.entries(stats.monthly).slice(-6);

  return (
    <div>
      <div className="mb-5 md:mb-6">
        <h2 className="text-base md:text-xl font-bold text-gray-900">Earnings</h2>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5">Revenue from confirmed and completed bookings</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-5 md:mb-8">
        {[
          { label: 'Total Earnings', value: `₾${stats.total.toLocaleString()}`, icon: 'ri-money-cny-circle-line', sub: 'Confirmed + completed', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Confirmed Bookings', value: `₾${stats.confirmed.toLocaleString()}`, icon: 'ri-checkbox-circle-line', sub: 'Active confirmed stays', color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Completed Stays', value: `₾${stats.completed.toLocaleString()}`, icon: 'ri-star-line', sub: 'Fully completed stays', color: 'text-gray-600', bg: 'bg-gray-100' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-card border border-line shadow-card p-3 md:p-6">
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <span className="text-xs md:text-sm text-gray-500">{c.label}</span>
              <div className={`w-7 h-7 md:w-9 md:h-9 flex-shrink-0 ${c.bg} rounded-lg flex items-center justify-center`}>
                <i className={`${c.icon} ${c.color} text-sm md:text-base`}></i>
              </div>
            </div>
            {loading ? (
              <div className="h-6 md:h-8 bg-gray-100 rounded animate-pulse w-20 mb-1" />
            ) : (
              <p className="text-xl md:text-3xl font-bold text-gray-900 mb-0.5 md:mb-1">{c.value}</p>
            )}
            <p className="text-xs text-gray-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly breakdown */}
      {monthlyEntries.length > 0 && (
        <div className="bg-white rounded-card border border-line shadow-card p-4 md:p-6 mb-5 md:mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 md:mb-5">Monthly Breakdown</h3>
          <div className="space-y-3">
            {monthlyEntries.map(([month, amount]) => {
              const pct = stats.total > 0 ? Math.round((amount / stats.total) * 100) : 0;
              return (
                <div key={month} className="flex items-center gap-3 md:gap-4">
                  <span className="text-xs md:text-sm text-gray-500 w-20 md:w-24 flex-shrink-0">{month}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-gray-900 w-16 md:w-20 text-right">₾{amount.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Earnings table */}
      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Payment History</h3>
          <p className="text-xs text-gray-400 mt-0.5">All bookings that generated revenue</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 md:py-16">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line"></i>
              </div>
              <span className="text-sm">Loading…</span>
            </div>
          </div>
        ) : stats.earningBookings.length === 0 ? (
          <div className="flex flex-col items-center py-12 md:py-16 text-gray-400">
            <div className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center mb-2">
              <i className="ri-money-cny-circle-line text-2xl md:text-3xl"></i>
            </div>
            <p className="text-sm">No earnings yet</p>
            <p className="text-xs mt-1">Earnings appear here once bookings are confirmed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Property', 'Stay Dates', 'Status', 'Payment', 'Amount', 'Date'].map((h) => (
                    <th key={h} className="px-3 md:px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.earningBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 md:px-5 py-3 md:py-4">
                      <p className="text-xs md:text-sm font-medium text-gray-900 max-w-[140px] md:max-w-[200px] truncate notranslate" translate="no">{b.property_title}</p>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4 whitespace-nowrap">
                      <p className="text-xs md:text-sm text-gray-700">{fmt(b.check_in)} → {fmt(b.check_out)}</p>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        b.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {b.payment_status ?? 'pending'}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4 whitespace-nowrap">
                      <span className="text-xs md:text-sm font-bold text-emerald-700">
                        {b.total_price != null ? `₾${b.total_price.toLocaleString()}` : '—'}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-3 md:py-4 whitespace-nowrap">
                      <span className="text-xs text-gray-400">{fmt(b.created_at)}</span>
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
