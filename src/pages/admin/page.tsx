import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import BookingHistoryPanel from './components/BookingHistoryPanel';
import AdminGate from './components/AdminGate';
import DateChangeRequests from './components/DateChangeRequests';
import HostApplications from './components/HostApplications';
import ExperienceBookingsPanel from './components/ExperienceBookingsPanel';
import CompletedBookingsPanel from './components/CompletedBookingsPanel';
import UserManagementPanel from './components/UserManagementPanel';
import HostNewsPanel from './components/HostNewsPanel';
import PaymentLogsPanel from './components/PaymentLogsPanel';
import ExperiencesPanel from './components/ExperiencesPanel';

interface Booking {
  id: string;
  user_email: string;
  user_name: string | null;
  property_title: string;
  property_location: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  created_at: string;
  date_change_status: string | null;
  canceled_by: string | null;
  canceled_at: string | null;
  rejection_note?: string | null;
}

type FilterStatus = 'pending' | 'all' | 'confirmed' | 'cancelled';

const SUPABASE_FN_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/booking-handler`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

// Returns badge style class string
function statusBadgeClass(status: string): string {
  if (status === 'confirmed') return 'bg-green-100 text-green-700';
  if (status === 'cancelled' || status === 'cancelled_by_host') return 'bg-red-100 text-red-600';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700';
  if (status === 'pending_host_approval') return 'bg-amber-100 text-amber-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}

interface StatusDisplay {
  icon: string;
  label: string;
  badgeClass: string;
}

function getStatusDisplay(booking: Booking): StatusDisplay {
  const { status, canceled_by } = booking;

  if (status === 'cancelled_by_host') {
    return { icon: 'ri-calendar-close-line', label: 'Cancelled by Host', badgeClass: 'bg-red-100 text-red-700' };
  }
  if (status === 'cancelled') {
    if (canceled_by === 'host') {
      return { icon: 'ri-calendar-close-line', label: 'Cancelled by Host', badgeClass: 'bg-red-100 text-red-700' };
    }
    if (canceled_by === 'customer') {
      return { icon: 'ri-user-unfollow-line', label: 'Cancelled by Customer', badgeClass: 'bg-orange-100 text-orange-700' };
    }
    if (canceled_by === 'admin') {
      return { icon: 'ri-close-circle-line', label: 'Cancelled by Admin', badgeClass: 'bg-red-100 text-red-600' };
    }
    return { icon: 'ri-close-circle-line', label: 'Cancelled', badgeClass: 'bg-red-100 text-red-600' };
  }
  if (status === 'rejected') {
    if (canceled_by === 'host') {
      return { icon: 'ri-close-circle-line', label: 'Rejected by Host', badgeClass: 'bg-rose-100 text-rose-700' };
    }
    if (canceled_by === 'admin') {
      return { icon: 'ri-close-circle-line', label: 'Rejected by Admin', badgeClass: 'bg-rose-100 text-rose-700' };
    }
    return { icon: 'ri-close-circle-line', label: 'Rejected', badgeClass: 'bg-rose-100 text-rose-700' };
  }
  if (status === 'confirmed') return { icon: 'ri-checkbox-circle-line', label: 'Confirmed', badgeClass: 'bg-green-100 text-green-700' };
  if (status === 'pending_host_approval') return { icon: 'ri-time-line', label: 'Awaiting Host', badgeClass: 'bg-amber-100 text-amber-700' };
  if (status === 'pending') return { icon: 'ri-time-line', label: 'Pending', badgeClass: 'bg-amber-100 text-amber-700' };
  return { icon: 'ri-question-line', label: status, badgeClass: 'bg-gray-100 text-gray-600' };
}

function isCancelledStatus(status: string): boolean {
  return ['cancelled', 'cancelled_by_host', 'rejected'].includes(status);
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatCreated(str: string) {
  return new Date(str).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatCanceledAt(str: string) {
  return new Date(str).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Admin Rejection Note Modal ───────────────────────────────────────────────
interface RejectNoteModalProps {
  bookingId: string;
  propertyTitle: string;
  guestName: string | null;
  onConfirm: (bookingId: string, note: string) => void;
  onCancel: () => void;
  loading: boolean
}

const QUICK_REASONS = [
  'Required details were missing from the booking request.',
  'Personal details were missing or incomplete.',
  'Booking information was incomplete.',
  'The request could not be accepted at this time.',
  'The requested dates are no longer available.',
];

function RejectNoteModal({ bookingId, propertyTitle, guestName, onConfirm, onCancel, loading }: RejectNoteModalProps) {
  const [note, setNote] = useState('');

  const handleQuickReason = (reason: string) => {
    setNote(reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <i className="ri-close-circle-line text-red-500 text-lg"></i>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Reject Booking</h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[260px]">
                {guestName ? `${guestName} · ` : ''}{propertyTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 mb-4">
            Optionally add a rejection reason. This will be saved and included in the notification emails sent to both the customer and the host.
          </p>

          {/* Quick reasons */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick reasons</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleQuickReason(reason)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                    note === reason
                      ? 'bg-red-50 border-red-300 text-red-700 font-semibold'
                      : 'border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Custom note textarea */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              Custom rejection note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Type a custom reason for rejection (optional)…"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-800 placeholder-gray-400"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{note.length}/500</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer whitespace-nowrap transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(bookingId, note)}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
          >
            {loading ? (
              <div className="w-4 h-4 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line"></i>
              </div>
            ) : (
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-close-circle-line"></i>
              </div>
            )}
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0);
  const [pendingExperienceCount, setPendingExperienceCount] = useState(0);
  const [rejectModal, setRejectModal] = useState<{ bookingId: string; propertyTitle: string; guestName: string | null } | null>(null);

  // Fetch pending experience bookings count
  useEffect(() => {
    supabase
      .from('experience_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPendingExperienceCount(count ?? 0));
  }, []);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('id,user_email,user_name,property_title,property_location,check_in,check_out,guests,total_price,status,payment_status,payment_method,created_at,date_change_status,canceled_by,canceled_at,rejection_note')
      .order('created_at', { ascending: false });
    if (!error && data) setBookings(data as Booking[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleAction = async (bookingId: string, action: 'confirm' | 'reject') => {
    if (action === 'reject') {
      const booking = bookings.find((b) => b.id === bookingId);
      setRejectModal({
        bookingId,
        propertyTitle: booking?.property_title ?? '',
        guestName: booking?.user_name ?? null,
      });
      return;
    }
    setActionLoading(bookingId + action);
    try {
      const res = await fetch(SUPABASE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'admin-confirm-booking', bookingId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId ? { ...b, status: 'confirmed', canceled_by: null, canceled_at: null } : b
          )
        );
        showToast('Booking confirmed — confirmation email sent to customer.', 'success');
      } else {
        showToast(data.error ?? 'Something went wrong. Please try again.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }
    setActionLoading(null);
  };

  const handleConfirmReject = async (bookingId: string, note: string) => {
    setActionLoading(bookingId + 'reject');
    try {
      const res = await fetch(SUPABASE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'admin-reject-booking', bookingId, rejectionNote: note.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const now = new Date().toISOString();
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? { ...b, status: 'rejected', canceled_by: 'admin', canceled_at: now, rejection_note: note.trim() || null }
              : b
          )
        );
        showToast('Booking rejected — notification emails sent to customer and host.', 'success');
      } else {
        showToast(data.error ?? 'Something went wrong. Please try again.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }
    setActionLoading(null);
    setRejectModal(null);
  };

  const filtered = bookings.filter((b) => {
    let matchesStatus: boolean;
    if (filter === 'all') {
      matchesStatus = true;
    } else if (filter === 'cancelled') {
      matchesStatus = isCancelledStatus(b.status);
    } else if (filter === 'pending') {
      matchesStatus = b.status === 'pending' || b.status === 'pending_host_approval';
    } else {
      matchesStatus = b.status === filter;
    }
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      b.user_name?.toLowerCase().includes(q) ||
      b.user_email.toLowerCase().includes(q) ||
      b.property_title.toLowerCase().includes(q) ||
      (b.property_location ?? '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const today = new Date().toISOString().split('T')[0];
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending' || b.status === 'pending_host_approval').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    cancelled: bookings.filter((b) => isCancelledStatus(b.status)).length,
    completed: bookings.filter((b) => b.status === 'confirmed' && b.check_out <= today).length,
  };

  const tabs: { key: FilterStatus; label: string; color: string }[] = [
    { key: 'pending', label: 'Pending', color: 'text-amber-600' },
    { key: 'all', label: 'All Bookings', color: 'text-gray-600' },
    { key: 'confirmed', label: 'Confirmed', color: 'text-green-600' },
    { key: 'cancelled', label: 'Cancelled', color: 'text-red-500' },
  ];

  return (
    <AdminGate>
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Header bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <i className="ri-calendar-check-line text-white text-sm"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Bookings Admin</h1>
                <p className="text-xs text-gray-400 leading-none">RentCottage.Ge</p>
              </div>
            </div>
            <button
              onClick={fetchBookings}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-refresh-line"></i>
              </div>
              Refresh
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Stats row */}
          <div className="grid grid-cols-8 gap-4 mb-8">
            {[
              { label: 'Total', count: counts.all, icon: 'ri-file-list-3-line', color: 'text-gray-600', bg: 'bg-gray-100' },
              { label: 'Pending', count: counts.pending, icon: 'ri-time-line', color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Confirmed', count: counts.confirmed, icon: 'ri-checkbox-circle-line', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Completed', count: counts.completed, icon: 'ri-medal-line', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Cancelled', count: counts.cancelled, icon: 'ri-close-circle-line', color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Date Changes', count: bookings.filter((b) => b.date_change_status === 'pending').length, icon: 'ri-calendar-2-line', color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Applications', count: pendingApplicationsCount, icon: 'ri-home-smile-line', color: 'text-orange-500', bg: 'bg-orange-50' },
              { label: 'Experiences', count: pendingExperienceCount, icon: 'ri-goblet-line', color: 'text-purple-500', bg: 'bg-purple-50' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">{s.label}</span>
                  <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                    <i className={`${s.icon} ${s.color} text-sm`}></i>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{s.count}</p>
              </div>
            ))}
          </div>

          {/* Filters + Search */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              {/* Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
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

              {/* Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <i className="ri-search-line text-gray-400 text-sm"></i>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search guest, property…"
                  className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 w-64"
                />
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="w-5 h-5 flex items-center justify-center animate-spin">
                    <i className="ri-loader-4-line text-xl"></i>
                  </div>
                  <span className="text-sm">Loading bookings…</span>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <div className="w-12 h-12 flex items-center justify-center mb-3">
                  <i className="ri-inbox-line text-4xl"></i>
                </div>
                <p className="text-sm font-medium">No bookings found</p>
                <p className="text-xs mt-1">
                  {filter === 'pending' ? 'No pending requests right now.' : 'Try adjusting your filters.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="w-10 px-3 py-3" />
                    {['Guest', 'Property', 'Dates', 'Guests', 'Total', 'Submitted', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((b) => {
                    const isExpanded = expandedId === b.id;
                    const statusDisplay = getStatusDisplay(b);
                    const isCancelled = isCancelledStatus(b.status);
                    return (
                      <>
                        <tr key={b.id} className={`transition-colors ${isExpanded ? 'bg-gray-50/80' : 'hover:bg-gray-50/60'}`}>
                          {/* Expand toggle */}
                          <td className="px-3 py-4">
                            <button
                              onClick={() => toggleExpand(b.id)}
                              title="View history"
                              className={`w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                                isExpanded
                                  ? 'bg-gray-200 text-gray-700'
                                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                              }`}
                            >
                              <i className={`${isExpanded ? 'ri-arrow-up-s-line' : 'ri-history-line'} text-sm`}></i>
                            </button>
                          </td>
                          {/* Guest */}
                          <td className="px-5 py-4">
                            <p className="text-sm font-medium text-gray-900">{b.user_name || '—'}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{b.user_email}</p>
                          </td>
                          {/* Property */}
                          <td className="px-5 py-4">
                            <p className="text-sm font-medium text-gray-900 max-w-[160px] truncate notranslate" translate="no">{b.property_title}</p>
                            {b.property_location && (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <i className="ri-map-pin-line text-xs"></i>
                                {b.property_location}
                              </p>
                            )}
                          </td>
                          {/* Dates */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <p className="text-sm text-gray-800">{formatDate(b.check_in)}</p>
                            <p className="text-xs text-gray-400">→ {formatDate(b.check_out)}</p>
                          </td>
                          {/* Guests */}
                          <td className="px-5 py-4">
                            <span className="text-sm text-gray-800">{b.guests}</span>
                          </td>
                          {/* Total */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-gray-900">₾{b.total_price}</span>
                          </td>
                          {/* Submitted */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-xs text-gray-400">{formatCreated(b.created_at)}</span>
                          </td>
                          {/* Status — specific cancellation badge with timestamp + rejection note */}
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusDisplay.badgeClass}`}>
                              <i className={`${statusDisplay.icon} text-xs`}></i>
                              {statusDisplay.label}
                            </span>
                            {isCancelled && b.canceled_at && (
                              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                <i className="ri-time-line text-xs"></i>
                                {formatCanceledAt(b.canceled_at)}
                              </p>
                            )}
                            {b.rejection_note && (
                              <div className="mt-1.5 max-w-[180px]" title={b.rejection_note}>
                                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-2 py-1 leading-snug line-clamp-2">
                                  <i className="ri-chat-quote-line mr-1"></i>
                                  {b.rejection_note}
                                </p>
                              </div>
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-4">
                            {(b.status === 'pending' || b.status === 'pending_host_approval') ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleAction(b.id, 'confirm')}
                                  disabled={!!actionLoading}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                                >
                                  {actionLoading === b.id + 'confirm' ? (
                                    <div className="w-3 h-3 flex items-center justify-center animate-spin">
                                      <i className="ri-loader-4-line"></i>
                                    </div>
                                  ) : (
                                    <div className="w-3 h-3 flex items-center justify-center">
                                      <i className="ri-check-line"></i>
                                    </div>
                                  )}
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleAction(b.id, 'reject')}
                                  disabled={!!actionLoading}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                                >
                                  {actionLoading === b.id + 'reject' ? (
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
                              <span className="text-xs text-gray-400 italic">No action needed</span>
                            )}
                          </td>
                        </tr>
                        {/* Expandable history row */}
                        {isExpanded && (
                          <tr key={b.id + '-history'}>
                            <td colSpan={9} className="p-0">
                              <BookingHistoryPanel bookingId={b.id} isOpen={isExpanded} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Date Change Requests section */}
          <div className="mt-8">
            <DateChangeRequests />
          </div>

          {/* Host Applications section */}
          <div className="mt-8">
            <HostApplications onPendingCountChange={setPendingApplicationsCount} />
          </div>

          {/* Experiences (homepage cards) management */}
          <div className="mt-8">
            <ExperiencesPanel />
          </div>

          {/* Experience Booking Requests section */}
          <div className="mt-8">
            <ExperienceBookingsPanel />
          </div>

          {/* Completed Bookings section */}
          <div className="mt-8">
            <CompletedBookingsPanel />
          </div>

          {/* User Management section */}
          <div className="mt-8">
            <UserManagementPanel />
          </div>

          {/* Host News & Announcements section */}
          <div className="mt-8">
            <HostNewsPanel />
          </div>

          {/* Payment Verification Logs section */}
          <div className="mt-8">
            <PaymentLogsPanel />
          </div>
        </div>

        {/* Rejection Note Modal */}
        {rejectModal && (
          <RejectNoteModal
            bookingId={rejectModal.bookingId}
            propertyTitle={rejectModal.propertyTitle}
            guestName={rejectModal.guestName}
            onConfirm={handleConfirmReject}
            onCancel={() => setRejectModal(null)}
            loading={actionLoading === rejectModal.bookingId + 'reject'}
          />
        )}

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium text-white transition-all ${
              toast.type === 'success' ? 'bg-gray-900' : 'bg-red-500'
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'}></i>
            </div>
            {toast.msg}
          </div>
        )}
      </div>
    </AdminGate>
  );
}
