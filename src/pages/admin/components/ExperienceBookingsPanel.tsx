import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

interface ExperienceBooking {
  id: string;
  experience_type: 'wine_tasting' | 'cooking_class';
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  preferred_date: string;
  preferred_time: string | null;
  guests: number;
  message: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
type TypeFilter = 'all' | 'wine_tasting' | 'cooking_class';

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  pending: { label: 'Pending', badgeClass: 'bg-amber-100 text-amber-700', icon: 'ri-time-line' },
  confirmed: { label: 'Confirmed', badgeClass: 'bg-green-100 text-green-700', icon: 'ri-checkbox-circle-line' },
  completed: { label: 'Completed', badgeClass: 'bg-blue-100 text-blue-700', icon: 'ri-check-double-line' },
  cancelled: { label: 'Cancelled', badgeClass: 'bg-red-100 text-red-600', icon: 'ri-close-circle-line' },
};

const EXP_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  wine_tasting: { label: 'Wine Tasting', icon: 'ri-goblet-line', color: 'text-purple-600', bg: 'bg-purple-50' },
  cooking_class: { label: 'Cooking Class', icon: 'ri-restaurant-line', color: 'text-orange-600', bg: 'bg-orange-50' },
};

function formatDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatCreated(str: string) {
  return new Date(str).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface ActionMenuProps {
  booking: ExperienceBooking;
  onStatusChange: (id: string, status: ExperienceBooking['status']) => void;
  loading: boolean;
}

function ActionMenu({ booking, onStatusChange, loading }: ActionMenuProps) {
  const [open, setOpen] = useState(false);

  const actions = ([
    { status: 'confirmed', label: 'Confirm', icon: 'ri-checkbox-circle-line', color: 'text-green-600' },
    { status: 'completed', label: 'Mark Completed', icon: 'ri-check-double-line', color: 'text-blue-600' },
    { status: 'cancelled', label: 'Cancel', icon: 'ri-close-circle-line', color: 'text-red-500' },
    { status: 'pending', label: 'Reset to Pending', icon: 'ri-restart-line', color: 'text-gray-500' },
  ] as { status: ExperienceBooking['status']; label: string; icon: string; color: string }[])
    .filter((a) => a.status !== booking.status);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <div className="w-3 h-3 flex items-center justify-center">
          <i className="ri-more-2-fill text-gray-500"></i>
        </div>
        Actions
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-gray-100 rounded-xl py-1 min-w-[160px]">
            {actions.map((a) => (
              <button
                key={a.status}
                onClick={() => {
                  onStatusChange(booking.id, a.status);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer whitespace-nowrap ${a.color}`}
              >
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <i className={a.icon}></i>
                </div>
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ExperienceBookingsPanel() {
  const [bookings, setBookings] = useState<ExperienceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('experience_bookings')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setBookings(data as ExperienceBooking[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleStatusChange = async (id: string, status: ExperienceBooking['status']) => {
    setActionLoading(id);
    const { error } = await supabase
      .from('experience_bookings')
      .update({ status })
      .eq('id', id);
    if (!error) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b))
      );
      showToast(`Status updated to "${STATUS_CONFIG[status].label}".`, 'success');
    } else {
      showToast('Failed to update status. Please try again.', 'error');
    }
    setActionLoading(null);
  };

  const filtered = bookings.filter((b) => {
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesType = typeFilter === 'all' || b.experience_type === typeFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      b.customer_name.toLowerCase().includes(q) ||
      (b.customer_email ?? '').toLowerCase().includes(q) ||
      b.customer_phone.includes(q);
    return matchesStatus && matchesType && matchesSearch;
  });

  const counts = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
    wine: bookings.filter((b) => b.experience_type === 'wine_tasting').length,
    cooking: bookings.filter((b) => b.experience_type === 'cooking_class').length,
  };

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'confirmed', label: 'Confirmed', count: counts.confirmed },
    { key: 'completed', label: 'Completed', count: counts.completed },
    { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <i className="ri-goblet-line text-orange-500 text-base"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Experience Booking Requests</h2>
            <p className="text-xs text-gray-400 mt-0.5">Wine Tasting &amp; Cooking Class requests</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Type filter pills */}
          <div className="flex gap-1.5">
            {([
              { key: 'all' as TypeFilter, label: 'All types' },
              { key: 'wine_tasting' as TypeFilter, label: '🍷 Wine Tasting' },
              { key: 'cooking_class' as TypeFilter, label: '🍳 Cooking Class' },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  typeFilter === t.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
                {t.key !== 'all' && (
                  <span className="ml-1 opacity-60">
                    {t.key === 'wine_tasting' ? counts.wine : counts.cooking}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={fetchBookings}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-refresh-line"></i>
            </div>
            Refresh
          </button>
        </div>
      </div>

      {/* Status tabs + search */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
          {statusTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === t.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              <span className={`text-xs ${statusFilter === t.key ? 'text-white/70' : 'text-gray-400'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <i className="ri-search-line text-gray-400 text-xs"></i>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="pl-8 pr-4 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 w-52"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-5 h-5 flex items-center justify-center animate-spin">
              <i className="ri-loader-4-line text-xl"></i>
            </div>
            <span className="text-sm">Loading requests…</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="w-12 h-12 flex items-center justify-center mb-3">
            <i className="ri-inbox-line text-4xl"></i>
          </div>
          <p className="text-sm font-medium">No experience requests found</p>
          <p className="text-xs mt-1">
            {bookings.length === 0
              ? 'No booking requests submitted yet.'
              : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {filtered.map((b) => {
            const expCfg = EXP_CONFIG[b.experience_type] ?? { label: b.experience_type ?? 'Experience', icon: 'ri-star-line', color: 'text-gray-600', bg: 'bg-gray-100' };
            const stCfg = STATUS_CONFIG[b.status] ?? { label: b.status ?? 'Unknown', badgeClass: 'bg-gray-100 text-gray-700', icon: 'ri-question-line' };
            const isExpanded = expandedId === b.id;
            return (
              <div key={b.id}>
                <div className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Experience badge */}
                    <div className={`w-10 h-10 flex-shrink-0 ${expCfg.bg} rounded-xl flex items-center justify-center mt-0.5`}>
                      <i className={`${expCfg.icon} ${expCfg.color} text-base`}></i>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{b.customer_name}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${expCfg.bg} ${expCfg.color}`}>
                              <i className={`${expCfg.icon} text-xs`}></i>
                              {expCfg.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${stCfg.badgeClass}`}>
                              <i className={`${stCfg.icon} text-xs`}></i>
                              {stCfg.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <i className="ri-phone-line text-gray-400"></i>
                              {b.customer_phone}
                            </span>
                            {b.customer_email && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <i className="ri-mail-line text-gray-400"></i>
                                {b.customer_email}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <ActionMenu
                            booking={b}
                            onStatusChange={handleStatusChange}
                            loading={actionLoading === b.id}
                          />
                          <button
                            onClick={() => setExpandedId((p) => (p === b.id ? null : b.id))}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <i className={isExpanded ? 'ri-chevron-up-line' : 'ri-chevron-down-line'}></i>
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                        </div>
                      </div>

                      {/* Quick stats row */}
                      <div className="flex flex-wrap gap-4 mt-2">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <i className="ri-calendar-event-line text-gray-400"></i>
                          {formatDate(b.preferred_date)}
                          {b.preferred_time && (
                            <span className="text-gray-400 ml-0.5">at {b.preferred_time}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <i className="ri-group-line text-gray-400"></i>
                          {b.guests} {b.guests === 1 ? 'guest' : 'guests'}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <i className="ri-time-line"></i>
                          Submitted {formatCreated(b.created_at)}
                        </span>
                        <span className="text-xs text-gray-400 font-mono truncate max-w-[100px]">
                          #{b.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-6 pb-4 pt-1 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact Details</p>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <i className="ri-user-line text-gray-400 w-4"></i>
                          {b.customer_name}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <i className="ri-phone-line text-gray-400 w-4"></i>
                          <a href={`tel:${b.customer_phone}`} className="hover:text-red-500 transition-colors">
                            {b.customer_phone}
                          </a>
                        </div>
                        {b.customer_email && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <i className="ri-mail-line text-gray-400 w-4"></i>
                            <a href={`mailto:${b.customer_email}`} className="hover:text-red-500 transition-colors">
                              {b.customer_email}
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Booking Details</p>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <i className="ri-calendar-event-line text-gray-400 w-4"></i>
                          {formatDate(b.preferred_date)}
                          {b.preferred_time && <span className="text-gray-500">— {b.preferred_time}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <i className="ri-group-line text-gray-400 w-4"></i>
                          {b.guests} {b.guests === 1 ? 'guest' : 'guests'}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <i className={`${expCfg.icon} ${expCfg.color} w-4`}></i>
                          <span className={`font-medium ${expCfg.color}`}>{expCfg.label}</span>
                        </div>
                      </div>
                    </div>
                    {b.message && (
                      <div className="mt-2 pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                          Message / Special Requests
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed bg-white rounded-lg px-4 py-3 border border-gray-100">
                          {b.message}
                        </p>
                      </div>
                    )}
                    {/* Contact action buttons */}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
                      <a
                        href={`tel:${b.customer_phone}`}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <div className="w-3.5 h-3.5 flex items-center justify-center">
                          <i className="ri-phone-line"></i>
                        </div>
                        Call Customer
                      </a>
                      {b.customer_email && (
                        <a
                          href={`mailto:${b.customer_email}`}
                          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <div className="w-3.5 h-3.5 flex items-center justify-center">
                            <i className="ri-mail-send-line"></i>
                          </div>
                          Send Email
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
  );
}
