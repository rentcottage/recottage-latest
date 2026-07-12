import { useState, useEffect, useCallback } from 'react';

interface DateChangeRequest {
  id: string;
  user_name: string | null;
  user_email: string;
  property_title: string;
  property_location: string | null;
  check_in: string;
  check_out: string;
  requested_check_in: string;
  requested_check_out: string;
  requested_total_price: number | null;
  total_price: number | null;
  date_change_status: string;
  date_change_requested_at: string | null;
}

type DCFilter = 'pending' | 'all' | 'approved' | 'rejected';

const SUPABASE_FN_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/booking-handler`;
const ADMIN_HOST_ACTIONS_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-host-actions`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

function statusBadge(s: string) {
  if (s === 'approved') return 'bg-green-100 text-green-700';
  if (s === 'rejected') return 'bg-red-100 text-red-600';
  return 'bg-amber-100 text-amber-700';
}

function statusIcon(s: string) {
  if (s === 'approved') return 'ri-checkbox-circle-line';
  if (s === 'rejected') return 'ri-close-circle-line';
  return 'ri-time-line';
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTs(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  refreshTrigger?: number;
}

export default function DateChangeRequests({ refreshTrigger }: Props) {
  const [requests, setRequests] = useState<DateChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DCFilter>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    // bookings is RLS-locked; admins read via the password-gated service function.
    const res = await fetch(ADMIN_HOST_ACTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
      },
      body: JSON.stringify({ action: 'fetch-bookings', scope: 'date-changes' }),
    });
    const data = await res.json().catch(() => ({}));
    setRequests((res.ok && Array.isArray(data.bookings) ? data.bookings : []) as DateChangeRequest[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests, refreshTrigger]);

  const handleDateAction = async (bookingId: string, action: 'admin-approve-dates' | 'admin-reject-dates') => {
    setActionLoading(bookingId + action);
    try {
      const res = await fetch(SUPABASE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action, bookingId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const newStatus = action === 'admin-approve-dates' ? 'approved' : 'rejected';
        setRequests((prev) => prev.map((r) => r.id === bookingId ? { ...r, date_change_status: newStatus } : r));
        showToast(
          action === 'admin-approve-dates'
            ? 'Date change approved — customer notified.'
            : 'Date change rejected — customer notified.',
          'success'
        );
      } else {
        showToast(data.error ?? 'Something went wrong. Please try again.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }
    setActionLoading(null);
  };

  const filtered = requests.filter((r) => filter === 'all' || r.date_change_status === filter);

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.date_change_status === 'pending').length,
    approved: requests.filter((r) => r.date_change_status === 'approved').length,
    rejected: requests.filter((r) => r.date_change_status === 'rejected').length,
  };

  const tabs: { key: DCFilter; label: string; color: string }[] = [
    { key: 'pending', label: 'Pending', color: 'text-amber-600' },
    { key: 'all', label: 'All', color: 'text-gray-600' },
    { key: 'approved', label: 'Approved', color: 'text-green-600' },
    { key: 'rejected', label: 'Rejected', color: 'text-red-500' },
  ];

  return (
    <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
            <i className="ri-calendar-2-line text-amber-600 text-sm"></i>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Date Change Requests</h2>
            <p className="text-xs text-gray-400">Customer-submitted requests to modify booking dates</p>
          </div>
          {counts.pending > 0 && (
            <span className="ml-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {counts.pending} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  filter === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                <span className={`text-xs font-semibold ${filter === t.key ? t.color : 'text-gray-400'}`}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={fetchRequests}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer whitespace-nowrap"
          >
            <div className="w-3 h-3 flex items-center justify-center">
              <i className="ri-refresh-line"></i>
            </div>
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-4 h-4 flex items-center justify-center animate-spin">
              <i className="ri-loader-4-line"></i>
            </div>
            <span className="text-sm">Loading requests…</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="w-10 h-10 flex items-center justify-center mb-3">
            <i className="ri-calendar-check-line text-3xl"></i>
          </div>
          <p className="text-sm font-medium">No date change requests</p>
          <p className="text-xs mt-1">
            {filter === 'pending' ? 'No pending requests right now.' : 'Nothing to show for this filter.'}
          </p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Guest', 'Cottage', 'Current Dates', 'Requested Dates', 'Price', 'Requested At', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                {/* Guest */}
                <td className="px-5 py-4">
                  <p className="text-sm font-medium text-gray-900">{r.user_name || '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.user_email}</p>
                </td>
                {/* Cottage */}
                <td className="px-5 py-4">
                  <p className="text-sm font-medium text-gray-900 max-w-[140px] truncate notranslate" translate="no">{r.property_title}</p>
                  {r.property_location && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <i className="ri-map-pin-line text-xs"></i>
                      {r.property_location}
                    </p>
                  )}
                </td>
                {/* Current Dates */}
                <td className="px-5 py-4 whitespace-nowrap">
                  <p className="text-sm text-gray-500 line-through">{fmt(r.check_in)}</p>
                  <p className="text-xs text-gray-400 line-through">→ {fmt(r.check_out)}</p>
                </td>
                {/* Requested Dates */}
                <td className="px-5 py-4 whitespace-nowrap">
                  <p className="text-sm font-medium text-gray-900">{fmt(r.requested_check_in)}</p>
                  <p className="text-xs text-gray-500">→ {fmt(r.requested_check_out)}</p>
                </td>
                {/* Price */}
                <td className="px-5 py-4 whitespace-nowrap">
                  {r.requested_total_price !== null ? (
                    <div>
                      <p className="text-sm font-semibold text-gray-900">₾{r.requested_total_price}</p>
                      {r.total_price && r.total_price !== r.requested_total_price && (
                        <p className="text-xs text-gray-400 line-through">₾{r.total_price}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                {/* Requested At */}
                <td className="px-5 py-4 whitespace-nowrap">
                  <span className="text-xs text-gray-400">
                    {r.date_change_requested_at ? fmtTs(r.date_change_requested_at) : '—'}
                  </span>
                </td>
                {/* Status */}
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge(r.date_change_status)}`}>
                    <i className={`${statusIcon(r.date_change_status)} text-xs`}></i>
                    {r.date_change_status}
                  </span>
                </td>
                {/* Actions */}
                <td className="px-5 py-4">
                  {r.date_change_status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDateAction(r.id, 'admin-approve-dates')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                      >
                        {actionLoading === r.id + 'admin-approve-dates' ? (
                          <div className="w-3 h-3 flex items-center justify-center animate-spin">
                            <i className="ri-loader-4-line"></i>
                          </div>
                        ) : (
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className="ri-check-line"></i>
                          </div>
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleDateAction(r.id, 'admin-reject-dates')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                      >
                        {actionLoading === r.id + 'admin-reject-dates' ? (
                          <div className="w-3 h-3 flex items-center justify-center animate-spin">
                            <i className="ri-loader-4-line"></i>
                          </div>
                        ) : (
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className="ri-close-line"></i>
                          </div>
                        )}
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Processed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
