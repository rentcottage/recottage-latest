import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

interface CompletedBooking {
  id: string;
  property_title: string;
  property_location: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  payment_method: string | null;
  payment_status: string | null;
  status: string;
  created_at: string;
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function paymentMethodLabel(method: string | null): string {
  if (!method) return '—';
  if (method === 'bog') return 'BOG Pay';
  if (method === 'cash') return 'Cash';
  if (method === 'bank_transfer') return 'Bank Transfer';
  return method;
}

function paymentStatusBadge(status: string | null) {
  if (status === 'paid') return 'bg-green-100 text-green-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  if (status === 'failed') return 'bg-red-100 text-red-600';
  return 'bg-gray-100 text-gray-500';
}

const PAYMENT_METHODS = ['All Methods', 'BOG Pay', 'Cash', 'Bank Transfer'];

function exportToCSV(rows: CompletedBooking[]) {
  const headers = [
    'Booking ID',
    'Property',
    'Location',
    'Check-in',
    'Check-out',
    'Guests',
    'Total Price (GEL)',
    'Payment Method',
    'Payment Status',
    'Booking Status',
    'Completed On',
    'Booked On',
  ];

  const escape = (val: string | number | null | undefined) => {
    const str = val == null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = rows.map((b) => [
    b.id,
    b.property_title,
    b.property_location ?? '',
    b.check_in,
    b.check_out,
    b.guests,
    b.total_price,
    paymentMethodLabel(b.payment_method),
    b.payment_status ?? '',
    'Completed',
    b.check_out,
    b.created_at ? b.created_at.split('T')[0] : '',
  ].map(escape).join(','));

  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `completed-bookings-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function CompletedBookingsPanel() {
  const [bookings, setBookings] = useState<CompletedBooking[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchProperty, setSearchProperty] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('All Methods');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchCompleted = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('bookings')
      .select(
        'id,property_title,property_location,check_in,check_out,guests,total_price,payment_method,payment_status,status,created_at'
      )
      .eq('status', 'confirmed')
      .lte('check_out', today)
      .order('check_out', { ascending: false });

    if (!error && data) {
      setBookings(data as CompletedBooking[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCompleted();
  }, [fetchCompleted]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const q = searchProperty.toLowerCase();
      const matchesProperty = !q || b.property_title.toLowerCase().includes(q) || (b.property_location ?? '').toLowerCase().includes(q);

      const methodMap: Record<string, string> = {
        'BOG Pay': 'bog',
        'Cash': 'cash',
        'Bank Transfer': 'bank_transfer',
      };
      const matchesMethod =
        filterPaymentMethod === 'All Methods' ||
        b.payment_method === methodMap[filterPaymentMethod];

      const checkOut = new Date(b.check_out);
      const matchesFrom = !filterDateFrom || checkOut >= new Date(filterDateFrom);
      const matchesTo = !filterDateTo || checkOut <= new Date(filterDateTo);

      return matchesProperty && matchesMethod && matchesFrom && matchesTo;
    });
  }, [bookings, searchProperty, filterPaymentMethod, filterDateFrom, filterDateTo]);

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, b) => sum + Number(b.total_price), 0),
    [filtered]
  );

  const hasActiveFilters =
    searchProperty !== '' ||
    filterPaymentMethod !== 'All Methods' ||
    filterDateFrom !== '' ||
    filterDateTo !== '';

  const clearFilters = () => {
    setSearchProperty('');
    setFilterPaymentMethod('All Methods');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
              <i className="ri-medal-line text-emerald-600 text-base"></i>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Completed Bookings</h2>
              <p className="text-xs text-gray-400 mt-0.5">Confirmed stays where check-out date has passed</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                showFilters || hasActiveFilters
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-filter-3-line text-sm"></i>
              </div>
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              )}
            </button>
            <button
              onClick={() => exportToCSV(filtered)}
              disabled={filtered.length === 0}
              title={filtered.length === 0 ? 'No data to export' : `Export ${filtered.length} booking${filtered.length !== 1 ? 's' : ''} to CSV`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-download-2-line text-sm"></i>
              </div>
              Export CSV
            </button>
            <button
              onClick={fetchCompleted}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200 cursor-pointer whitespace-nowrap transition-colors"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-refresh-line text-sm"></i>
              </div>
              Refresh
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-emerald-50 rounded-xl p-4">
            <p className="text-xs text-emerald-600 font-medium mb-1">Total Completed</p>
            <p className="text-2xl font-bold text-emerald-700">{filtered.length}</p>
            {filtered.length !== bookings.length && (
              <p className="text-xs text-emerald-500 mt-0.5">of {bookings.length} total</p>
            )}
          </div>
          <div className="bg-emerald-50 rounded-xl p-4">
            <p className="text-xs text-emerald-600 font-medium mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-700">₾{totalRevenue.toLocaleString()}</p>
            {filtered.length !== bookings.length && (
              <p className="text-xs text-emerald-500 mt-0.5">filtered results</p>
            )}
          </div>
          <div className="bg-emerald-50 rounded-xl p-4">
            <p className="text-xs text-emerald-600 font-medium mb-1">Avg. Booking Value</p>
            <p className="text-2xl font-bold text-emerald-700">
              {filtered.length > 0 ? `₾${Math.round(totalRevenue / filtered.length).toLocaleString()}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-end gap-4 flex-wrap">
            {/* Property search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Property / Location</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <i className="ri-search-line text-gray-400 text-sm"></i>
                </div>
                <input
                  type="text"
                  value={searchProperty}
                  onChange={(e) => setSearchProperty(e.target.value)}
                  placeholder="Search property name…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                />
              </div>
            </div>

            {/* Payment method */}
            <div className="min-w-[160px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment Method</label>
              <div className="relative">
                <select
                  value={filterPaymentMethod}
                  onChange={(e) => setFilterPaymentMethod(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white cursor-pointer"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                  <i className="ri-arrow-down-s-line text-gray-400 text-sm"></i>
                </div>
              </div>
            </div>

            {/* Date from */}
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Check-out From</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white cursor-pointer"
              />
            </div>

            {/* Date to */}
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Check-out To</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white cursor-pointer"
              />
            </div>

            {/* Clear */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 cursor-pointer whitespace-nowrap transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-close-line text-sm"></i>
                </div>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-gray-400">
            <div className="w-5 h-5 flex items-center justify-center animate-spin">
              <i className="ri-loader-4-line text-xl"></i>
            </div>
            <span className="text-sm">Loading completed bookings…</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <i className="ri-medal-line text-3xl text-gray-300"></i>
          </div>
          <p className="text-sm font-medium text-gray-500">No completed bookings found</p>
          <p className="text-xs mt-1 text-gray-400">
            {hasActiveFilters
              ? 'Try adjusting your filters.'
              : 'Completed stays will appear here once check-out dates have passed.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  'Booking ID',
                  'Property',
                  'Check-in',
                  'Check-out',
                  'Guests',
                  'Total',
                  'Payment Method',
                  'Payment Status',
                  'Status',
                  'Completed On',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/60 transition-colors">
                  {/* Booking ID */}
                  <td className="px-5 py-4">
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {b.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>

                  {/* Property */}
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-gray-900 max-w-[180px] truncate notranslate" translate="no">{b.property_title}</p>
                    {b.property_location && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <i className="ri-map-pin-line text-xs"></i>
                        {b.property_location}
                      </p>
                    )}
                  </td>

                  {/* Check-in */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">{formatDate(b.check_in)}</span>
                  </td>

                  {/* Check-out */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">{formatDate(b.check_out)}</span>
                  </td>

                  {/* Guests */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-group-line text-gray-400 text-xs"></i>
                      </div>
                      <span className="text-sm text-gray-800">{b.guests}</span>
                    </div>
                  </td>

                  {/* Total */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-gray-900">₾{Number(b.total_price).toLocaleString()}</span>
                  </td>

                  {/* Payment Method */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-bank-card-line text-gray-400 text-xs"></i>
                      </div>
                      <span className="text-sm text-gray-700">{paymentMethodLabel(b.payment_method)}</span>
                    </div>
                  </td>

                  {/* Payment Status */}
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize whitespace-nowrap ${paymentStatusBadge(b.payment_status)}`}
                    >
                      <i
                        className={`text-xs ${
                          b.payment_status === 'paid'
                            ? 'ri-checkbox-circle-line'
                            : b.payment_status === 'pending'
                            ? 'ri-time-line'
                            : 'ri-close-circle-line'
                        }`}
                      ></i>
                      {b.payment_status ?? 'Unknown'}
                    </span>
                  </td>

                  {/* Booking Status */}
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap">
                      <i className="ri-medal-line text-xs"></i>
                      Completed
                    </span>
                  </td>

                  {/* Completed On (check-out date) */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-xs text-gray-500">{formatDate(b.check_out)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer summary */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{filtered.length}</span> completed booking{filtered.length !== 1 ? 's' : ''}
              {hasActiveFilters && ` (filtered from ${bookings.length})`}
            </span>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-emerald-700">
                Total Revenue: ₾{totalRevenue.toLocaleString()}
              </span>
              <button
                onClick={() => exportToCSV(filtered)}
                className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer transition-colors"
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center">
                  <i className="ri-file-download-line text-xs"></i>
                </div>
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
