import { useState, useMemo, useCallback, useEffect } from 'react';

interface Booking {
  id: string;
  user_name: string | null;
  user_email: string;
  property_id: string | null;
  property_title: string;
  property_location: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  price_per_night: number | null;
  total_price: number | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  created_at: string;
  date_change_status: string | null;
  requested_check_in: string | null;
  requested_check_out: string | null;
  requested_total_price: number | null;
  date_change_requested_at: string | null;
  approval_deadline?: string | null;
  rejection_note?: string | null;
}

type FilterStatus = 'all' | 'pending_host_approval' | 'confirmed' | 'cancelled' | 'completed' | 'rejected';
type ActionType = 'approve' | 'reject' | 'cancel' | null;

interface Props {
  bookings: Booking[];
  loading: boolean;
  showCancelledOnly?: boolean;
  hostEmail: string;
  onRefresh: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

// Send the project apikey + bearer on every booking-handler call, identical to
// the admin panel's calls (which work). The host actions previously sent no auth
// headers at all — the only thing that differed from the working admin path —
// so host approve/reject/cancel were rejected while admin succeeded.
const FN_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTs(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    pending_host_approval: 'bg-orange-100 text-orange-700',
    pending_payment: 'bg-gray-100 text-gray-500',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
    cancelled_by_host: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-gray-100 text-gray-600',
    payment_failed: 'bg-red-50 text-red-400',
  };
  return map[s] ?? 'bg-gray-100 text-gray-600';
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: 'Pending',
    pending_host_approval: 'Awaiting Approval',
    pending_payment: 'Pending Payment',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    cancelled_by_host: 'Cancelled by Host',
    rejected: 'Rejected',
    completed: 'Completed',
    payment_failed: 'Payment Failed',
  };
  return map[s] ?? s;
}

function statusIcon(s: string) {
  if (s === 'confirmed') return 'ri-checkbox-circle-line';
  if (s === 'cancelled' || s === 'rejected') return 'ri-close-circle-line';
  if (s === 'completed') return 'ri-star-line';
  if (s === 'pending_host_approval') return 'ri-time-line';
  return 'ri-time-line';
}

function paymentBadge(s: string | null) {
  if (s === 'paid') return 'bg-green-100 text-green-700';
  if (s === 'refunded' || s === 'refund_pending') return 'bg-amber-100 text-amber-700';
  if (s === 'cancelled') return 'bg-red-100 text-red-500';
  return 'bg-gray-100 text-gray-500';
}

function paymentMethodBadge(m: string | null) {
  if (m === 'pay_at_property') return { cls: 'bg-amber-100 text-amber-700', label: 'At Property', icon: 'ri-home-heart-line' };
  return { cls: 'bg-gray-100 text-gray-500', label: 'Online', icon: 'ri-bank-card-line' };
}

function needsApproval(status: string) {
  return status === 'pending_host_approval' || status === 'pending';
}

function isCancelledStatus(status: string) {
  return status === 'cancelled' || status === 'cancelled_by_host';
}

// ── Approval deadline countdown ──────────────────────────────────────────
function useApprovalCountdown(deadline: string | null | undefined) {
  const [remaining, setRemaining] = useState<{ hours: number; mins: number; expired: boolean } | null>(null);

  useEffect(() => {
    if (!deadline) { setRemaining(null); return; }
    const calc = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setRemaining({ hours: 0, mins: 0, expired: true }); return; }
      const totalMins = Math.floor(diff / 60000);
      setRemaining({ hours: Math.floor(totalMins / 60), mins: totalMins % 60, expired: false });
    };
    calc();
    const iv = setInterval(calc, 30000);
    return () => clearInterval(iv);
  }, [deadline]);

  return remaining;
}

function ApprovalCountdown({ deadline }: { deadline: string | null | undefined }) {
  const r = useApprovalCountdown(deadline);
  if (!r) return null;
  if (r.expired) return (
    <span className="inline-flex items-center gap-1 text-xs text-red-500 font-semibold">
      <i className="ri-alarm-warning-line"></i>
      Deadline expired
    </span>
  );
  const isUrgent = r.hours < 3;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isUrgent ? 'text-red-500' : 'text-amber-600'}`}>
      <i className={`${isUrgent ? 'ri-alarm-warning-line' : 'ri-timer-2-line'}`}></i>
      {r.hours}h {r.mins}m left
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOST DASHBOARD PRIVACY RULE — PERMANENT — DO NOT MODIFY WITHOUT EXPLICIT REQUEST
//
// Hosts must NEVER see customer personal details (name, email, phone) in the
// dashboard booking table. Customer identity is always shown as "Guest" with
// a lock icon. The ONLY exception is the contact-reveal email sent 1 day before
// check-in via the booking-reminders edge function — that is the sole channel
// through which hosts learn guest contact details.
//
// DO NOT restore canSeeGuestDetails(), maskName(), or any email/name display
// in this component without an explicit user request.
// ═══════════════════════════════════════════════════════════════════════════════

const QUICK_REJECT_REASONS = [
  'The dates are no longer available',
  'The property cannot host this request',
  'The booking request cannot be accepted at this time',
  'Minimum stay requirement not met',
];

export default function HostBookingsSection({ bookings, loading, showCancelledOnly = false, hostEmail, onRefresh }: Props) {
  const [filter, setFilter] = useState<FilterStatus>(showCancelledOnly ? 'cancelled' : 'all');
  const [search, setSearch] = useState('');

  // Approve / Reject state
  const [actionLoading, setActionLoading] = useState<Record<string, ActionType>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [actionSuccess, setActionSuccess] = useState<Record<string, string>>({});

  // Rejection note modal
  const [rejectNoteBookingId, setRejectNoteBookingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Cancel state
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState<Record<string, boolean>>({});
  const [cancelError, setCancelError] = useState<Record<string, string>>({});
  const [cancelSuccess, setCancelSuccess] = useState<Set<string>>(new Set());

  const displayBookings = useMemo(() => {
    if (showCancelledOnly) return bookings.filter((b) => isCancelledStatus(b.status));
    return bookings;
  }, [bookings, showCancelledOnly]);

  const counts = useMemo(() => ({
    all: displayBookings.length,
    pending_host_approval: displayBookings.filter((b) => needsApproval(b.status)).length,
    confirmed: displayBookings.filter((b) => b.status === 'confirmed').length,
    cancelled: displayBookings.filter((b) => isCancelledStatus(b.status)).length,
    rejected: displayBookings.filter((b) => b.status === 'rejected').length,
    completed: displayBookings.filter((b) => b.status === 'completed').length,
  }), [displayBookings]);

  const filtered = useMemo(() => {
    let base: Booking[];
    if (filter === 'all') {
      base = displayBookings;
    } else if (filter === 'pending_host_approval') {
      base = displayBookings.filter((b) => needsApproval(b.status));
    } else if (filter === 'cancelled') {
      base = displayBookings.filter((b) => isCancelledStatus(b.status));
    } else {
      base = displayBookings.filter((b) => b.status === filter);
    }
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    // PRIVACY RULE: search by property/location only — never by guest name or email
    return base.filter((b) =>
      b.property_title.toLowerCase().includes(q) ||
      (b.property_location ?? '').toLowerCase().includes(q)
    );
  }, [displayBookings, filter, search]);

  // ── Approve ──────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (bookingId: string) => {
    setActionLoading((prev) => ({ ...prev, [bookingId]: 'approve' }));
    setActionError((prev) => ({ ...prev, [bookingId]: '' }));
    setActionSuccess((prev) => ({ ...prev, [bookingId]: '' }));
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/booking-handler`, {
        method: 'POST',
        headers: FN_HEADERS,
        body: JSON.stringify({ action: 'host-approve-booking', bookingId, hostEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to approve booking');
      setActionSuccess((prev) => ({ ...prev, [bookingId]: 'approved' }));
      onRefresh();
    } catch (e: unknown) {
      setActionError((prev) => ({ ...prev, [bookingId]: e instanceof Error ? e.message : 'Something went wrong' }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [bookingId]: null }));
    }
  }, [hostEmail, onRefresh]);

  // ── Reject (with note) ───────────────────────────────────────────────
  const handleReject = useCallback(async (bookingId: string, note: string) => {
    setActionLoading((prev) => ({ ...prev, [bookingId]: 'reject' }));
    setActionError((prev) => ({ ...prev, [bookingId]: '' }));
    setActionSuccess((prev) => ({ ...prev, [bookingId]: '' }));
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/booking-handler`, {
        method: 'POST',
        headers: FN_HEADERS,
        body: JSON.stringify({ action: 'host-reject-booking', bookingId, hostEmail, rejectionNote: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to reject booking');
      setActionSuccess((prev) => ({ ...prev, [bookingId]: 'rejected' }));
      setRejectNoteBookingId(null);
      setRejectNote('');
      onRefresh();
    } catch (e: unknown) {
      setActionError((prev) => ({ ...prev, [bookingId]: e instanceof Error ? e.message : 'Something went wrong' }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [bookingId]: null }));
    }
  }, [hostEmail, onRefresh]);

  // ── Cancel (confirmed bookings) ──────────────────────────────────────
  const handleCancelConfirmed = useCallback(async (bookingId: string) => {
    setCancelLoading((prev) => ({ ...prev, [bookingId]: true }));
    setCancelError((prev) => ({ ...prev, [bookingId]: '' }));
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/booking-handler`, {
        method: 'POST',
        headers: FN_HEADERS,
        body: JSON.stringify({ action: 'host-cancel-booking', bookingId, hostEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to cancel booking');
      setCancelSuccess((prev) => new Set(prev).add(bookingId));
      setCancelConfirm(null);
      onRefresh();
    } catch (e: unknown) {
      setCancelError((prev) => ({ ...prev, [bookingId]: e instanceof Error ? e.message : 'Something went wrong' }));
    } finally {
      setCancelLoading((prev) => ({ ...prev, [bookingId]: false }));
    }
  }, [hostEmail, onRefresh]);

  const tabs: { key: FilterStatus; label: string; color: string }[] = showCancelledOnly
    ? [{ key: 'cancelled', label: 'Cancelled', color: 'text-red-500' }]
    : [
        { key: 'all', label: 'All', color: 'text-gray-600' },
        { key: 'pending_host_approval', label: 'Needs Approval', color: 'text-orange-600' },
        { key: 'confirmed', label: 'Confirmed', color: 'text-green-600' },
        { key: 'rejected', label: 'Rejected', color: 'text-red-500' },
        { key: 'cancelled', label: 'Cancelled', color: 'text-red-400' },
        { key: 'completed', label: 'Completed', color: 'text-gray-500' },
      ];

  const pendingApprovalCount = counts.pending_host_approval;

  // ── Expire overdue pending approvals on mount ──────────────────────────
  useEffect(() => {
    const expireOverdue = async () => {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/booking-handler`, {
          method: 'POST',
          headers: FN_HEADERS,
          body: JSON.stringify({ action: 'expire-pending-approvals', hostEmail }),
        });
        onRefresh();
      } catch {
        // non-fatal
      }
    };
    if (hostEmail) expireOverdue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostEmail]);

  return (
    <div>
      {/* ── Rejection Note Modal ─────────────────────────────────────── */}
      {rejectNoteBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-xl flex-shrink-0">
                <i className="ri-close-circle-line text-red-600 text-xl"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Reject Booking</h3>
                <p className="text-xs text-gray-400 mt-0.5">Add a reason for the guest (optional but recommended)</p>
              </div>
            </div>

            {/* Quick reasons */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick reasons</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_REJECT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setRejectNote(reason)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                      rejectNote === reason
                        ? 'bg-red-50 border-red-300 text-red-700 font-semibold'
                        : 'bg-gray-50 border-line text-gray-600 hover:border-red-200 hover:text-red-600'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom note */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Custom message
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Type a custom reason for the guest…"
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{rejectNote.length}/500</p>
            </div>

            {actionError[rejectNoteBookingId] && (
              <p className="text-xs text-red-500 mb-3 leading-snug">{actionError[rejectNoteBookingId]}</p>
            )}

            <div className="flex gap-2">
              <button
                disabled={!!actionLoading[rejectNoteBookingId]}
                onClick={() => handleReject(rejectNoteBookingId, rejectNote)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                {actionLoading[rejectNoteBookingId] === 'reject'
                  ? <i className="ri-loader-4-line animate-spin"></i>
                  : <i className="ri-close-circle-line"></i>}
                Confirm Rejection
              </button>
              <button
                disabled={!!actionLoading[rejectNoteBookingId]}
                onClick={() => { setRejectNoteBookingId(null); setRejectNote(''); }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!showCancelledOnly && (
        <div className="mb-5 md:mb-6">
          <h2 className="text-base md:text-xl font-bold text-gray-900">Bookings</h2>
          <p className="text-xs md:text-sm text-gray-400 mt-0.5">All bookings across your properties</p>
        </div>
      )}
      {showCancelledOnly && (
        <div className="mb-5 md:mb-6">
          <h2 className="text-base md:text-xl font-bold text-gray-900">Cancelled Bookings</h2>
          <p className="text-xs md:text-sm text-gray-400 mt-0.5">History of all cancelled reservations</p>
        </div>
      )}

      {/* Alert banner — pending approvals */}
      {!showCancelledOnly && pendingApprovalCount > 0 && (
        <div className="mb-4 md:mb-5 flex items-center gap-2 md:gap-3 bg-orange-50 border border-orange-200 rounded-xl px-3 md:px-5 py-3 md:py-4">
          <div className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-orange-100 rounded-lg flex-shrink-0">
            <i className="ri-alarm-warning-line text-orange-600 text-base md:text-lg"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm font-semibold text-orange-800">
              {pendingApprovalCount} booking {pendingApprovalCount === 1 ? 'request needs' : 'requests need'} your approval
            </p>
            <p className="text-xs text-orange-600 mt-0.5 hidden sm:block">Review and approve or reject below — guests are waiting.</p>
          </div>
          <button
            onClick={() => setFilter('pending_host_approval')}
            className="flex-shrink-0 px-2.5 md:px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Review Now
          </button>
        </div>
      )}

      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-gray-100 gap-3">
          {!showCancelledOnly && (
            <div className="overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-max">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      filter === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t.label}
                    {counts[t.key] > 0 && (
                      <span className={`text-xs font-semibold ${filter === t.key ? t.color : 'text-gray-400'}`}>
                        {counts[t.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {showCancelledOnly && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-close-circle-line text-red-500"></i>
              </div>
              <span className="font-medium text-gray-700">{counts.cancelled} cancelled bookings</span>
            </div>
          )}
          <div className="relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <i className="ri-search-line text-gray-400 text-sm"></i>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search property, location…"
              className="pl-9 pr-4 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 w-full sm:w-52"
            />
          </div>
        </div>

        {/* Privacy notice */}
        <div className="px-3 md:px-6 py-2 border-b border-gray-100 bg-amber-50/60 flex items-center gap-2">
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <i className="ri-lock-line text-amber-500 text-xs"></i>
          </div>
          <p className="text-xs text-amber-700">
            Guest contact details are private and only revealed <strong>1 day before check-in</strong>.
          </p>
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
              {filter === 'pending_host_approval' ? 'No bookings awaiting your approval right now.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Guest', 'Property', 'Dates', 'Guests', 'Total', 'Payment', 'Method', 'Status', 'Submitted', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((b) => {
                  const isAwaitingApproval = needsApproval(b.status);
                  const isConfirmed = b.status === 'confirmed';
                  const isActing = !!actionLoading[b.id];
                  const errMsg = actionError[b.id];
                  const successMsg = actionSuccess[b.id];
                  const isCancelConfirming = cancelConfirm === b.id;
                  const isCancelling = cancelLoading[b.id];
                  const cancelErr = cancelError[b.id];
                  const wasCancelled = cancelSuccess.has(b.id);

                  return (
                    <tr
                      key={b.id}
                      className={`transition-colors ${
                        isAwaitingApproval
                          ? 'bg-orange-50/40 hover:bg-orange-50/70'
                          : isConfirmed && !wasCancelled
                          ? 'hover:bg-gray-50/60'
                          : 'hover:bg-gray-50/60'
                      }`}
                    >
                      {/* Guest — PRIVACY RULE: never show name/email/phone */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 flex-shrink-0 bg-gray-100 rounded-full flex items-center justify-center">
                            <i className="ri-lock-line text-gray-400 text-xs"></i>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">Guest</p>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <i className="ri-lock-line text-[10px]"></i>
                              Private
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Property */}
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-gray-900 max-w-[140px] truncate notranslate" translate="no">{b.property_title}</p>
                        {b.property_location && (
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <i className="ri-map-pin-line text-xs"></i>
                            {b.property_location}
                          </p>
                        )}
                      </td>
                      {/* Dates */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-800">{fmt(b.check_in)}</p>
                        <p className="text-xs text-gray-400">&rarr; {fmt(b.check_out)}</p>
                      </td>
                      {/* Guests */}
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-800">{b.guests}</span>
                      </td>
                      {/* Total */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {b.total_price != null ? `\u20BE${b.total_price}` : '—'}
                        </span>
                      </td>
                      {/* Payment status */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${paymentBadge(b.payment_status)}`}>
                          {b.payment_status ?? 'pending'}
                        </span>
                      </td>
                      {/* Payment method */}
                      <td className="px-4 py-4">
                        {(() => {
                          const pm = paymentMethodBadge(b.payment_method);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pm.cls}`}>
                              <i className={`${pm.icon} text-xs`}></i>
                              {pm.label}
                            </span>
                          );
                        })()}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(b.status)}`}>
                          <i className={`${statusIcon(b.status)} text-xs`}></i>
                          {statusLabel(b.status)}
                        </span>
                        {b.status === 'pending_host_approval' && b.approval_deadline && (
                          <div className="mt-1">
                            <ApprovalCountdown deadline={b.approval_deadline} />
                          </div>
                        )}
                        {b.date_change_status === 'pending' && (
                          <span className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                            <i className="ri-calendar-2-line text-xs"></i>
                            Date change requested
                          </span>
                        )}
                        {/* Rejection note indicator */}
                        {b.status === 'rejected' && b.rejection_note && (
                          <div className="mt-1.5 max-w-[160px]">
                            <p className="text-xs text-red-500 italic leading-snug truncate" title={b.rejection_note}>
                              <i className="ri-chat-1-line mr-0.5"></i>
                              {b.rejection_note}
                            </p>
                          </div>
                        )}
                      </td>
                      {/* Submitted */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-400">{fmtTs(b.created_at)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 min-w-[150px]">

                        {/* ── Awaiting approval: Approve + Reject ── */}
                        {isAwaitingApproval && (
                          <div className="flex flex-col gap-1.5">
                            {successMsg ? (
                              <span className={`text-xs font-semibold ${successMsg === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                                <i className={`${successMsg === 'approved' ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'} mr-1`}></i>
                                {successMsg === 'approved' ? 'Approved!' : 'Rejected'}
                              </span>
                            ) : (
                              <>
                                <button
                                  disabled={isActing}
                                  onClick={() => handleApprove(b.id)}
                                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  {actionLoading[b.id] === 'approve'
                                    ? <i className="ri-loader-4-line animate-spin"></i>
                                    : <i className="ri-checkbox-circle-line"></i>}
                                  Approve
                                </button>
                                <button
                                  disabled={isActing}
                                  onClick={() => { setRejectNoteBookingId(b.id); setRejectNote(''); }}
                                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 text-xs font-semibold rounded-lg border border-red-200 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <i className="ri-close-circle-line"></i>
                                  Reject
                                </button>
                                {errMsg && (
                                  <p className="text-xs text-red-500 mt-0.5 max-w-[140px] leading-snug">{errMsg}</p>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* ── Confirmed: Cancel button ── */}
                        {isConfirmed && !wasCancelled && (
                          <div className="flex flex-col gap-1.5">
                            {!isCancelConfirming ? (
                              <button
                                onClick={() => setCancelConfirm(b.id)}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-500 hover:text-red-700 text-xs font-semibold rounded-lg border border-red-200 hover:border-red-300 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <i className="ri-calendar-close-line"></i>
                                Cancel Booking
                              </button>
                            ) : (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-w-[200px]">
                                <p className="text-xs text-gray-700 font-medium mb-1 leading-snug">
                                  Cancel this booking?
                                </p>
                                <p className="text-xs text-gray-500 mb-3 leading-snug">
                                  The guest will be notified by email. This cannot be undone.
                                </p>
                                {cancelErr && (
                                  <p className="text-xs text-red-500 mb-2 leading-snug">{cancelErr}</p>
                                )}
                                <div className="flex gap-1.5">
                                  <button
                                    disabled={isCancelling}
                                    onClick={() => handleCancelConfirmed(b.id)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    {isCancelling
                                      ? <i className="ri-loader-4-line animate-spin text-xs"></i>
                                      : <i className="ri-check-line text-xs"></i>}
                                    Yes, Cancel
                                  </button>
                                  <button
                                    disabled={isCancelling}
                                    onClick={() => { setCancelConfirm(null); setCancelError((p) => ({ ...p, [b.id]: '' })); }}
                                    className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-600 text-xs font-medium rounded-md border border-line transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    Keep
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Cancelled by host success feedback ── */}
                        {wasCancelled && (
                          <span className="text-xs font-semibold text-red-500">
                            <i className="ri-close-circle-line mr-1"></i>
                            Cancelled
                          </span>
                        )}

                        {/* ── No actions available ── */}
                        {!isAwaitingApproval && !isConfirmed && !wasCancelled && (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
