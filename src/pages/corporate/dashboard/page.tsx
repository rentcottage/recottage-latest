import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/feature/Header';
import SEO from '../../../components/feature/SEO';
import { supabase, type Booking } from '../../../lib/supabase';
import ChangeDatesModal from '../../profile/components/ChangeDatesModal';
import { useAuth, signOutUser } from '../../../hooks/useAuth';
import { useT } from '../../../i18n';

interface CorporateAccount {
  id: string;
  agency_name: string;
  tax_id: string;
  rep_first_name: string;
  rep_last_name: string;
  email: string;
  phone: string | null;
  commission_pct: number;
  status: string;
}

// The agency table needs the full booking shape so a row can be handed to
// ChangeDatesModal (which takes the shared Booking type) without reshaping.
type CorporateBooking = Booking;

type BookingFilter = 'all' | 'active' | 'pending' | 'completed' | 'cancelled';

/** Today in YYYY-MM-DD, compared against check_out (a date column). */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Which bucket a booking falls into.
 *
 * There is no "completed" status in the database — a stay is completed when it
 * is confirmed and its check-out has passed. This mirrors the admin panel's
 * definition exactly (admin-host-actions, scope 'completed') so the agency and
 * the admin never disagree about which bookings are done.
 */
function bucketOf(status: string, checkOut: string): BookingFilter | null {
  if (status === 'confirmed') return checkOut <= todayStr() ? 'completed' : 'active';
  if (status === 'pending' || status === 'pending_host_approval') return 'pending';
  if (status === 'cancelled' || status === 'cancelled_by_host' || status === 'rejected') return 'cancelled';
  return null;
}

/**
 * Can the agency still move this booking's dates?
 *
 * Mirrors the server's rules in booking-handler ('change-dates'): the stay must
 * not have started, and only one request may be open at a time. Agency bookings
 * store the AGENCY's email as user_email, which is what that action authorises
 * against — so the agency passes the same check the guest would.
 */
function canChangeDates(b: { status: string; check_in: string; date_change_status: string | null }): boolean {
  if (b.status !== 'confirmed') return false;
  if (b.check_in <= todayStr()) return false;
  return b.date_change_status !== 'pending';
}

const BOOKING_HANDLER_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/booking-handler`;

/**
 * Can the agency still cancel this booking?
 *
 * Mirrors booking-handler ('cancel'): anything not already cancelled/rejected,
 * as long as check-in has not arrived. Pending requests count — an agency should
 * be able to withdraw one before the host answers. A booking paid online is
 * refunded by the server as part of cancelling.
 */
function canCancel(b: { status: string; check_in: string }): boolean {
  if (b.status === 'cancelled' || b.status === 'cancelled_by_host' || b.status === 'rejected') return false;
  return b.check_in > todayStr();
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status: string) {
  if (status === 'confirmed') return 'bg-green-100 text-green-700';
  if (status === 'pending' || status === 'pending_host_approval') return 'bg-amber-100 text-amber-700';
  if (status === 'cancelled' || status === 'cancelled_by_host' || status === 'rejected') return 'bg-red-100 text-red-600';
  return 'bg-gray-100 text-gray-600';
}

export default function CorporateDashboard() {
  const { t, plural } = useT();
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<CorporateAccount | null>(null);
  const [bookings, setBookings] = useState<CorporateBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [gateError, setGateError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [datesBooking, setDatesBooking] = useState<CorporateBooking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CorporateBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const loadAccount = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('corporate_applications')
      .select('id, agency_name, tax_id, rep_first_name, rep_last_name, email, phone, commission_pct, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !data) {
      setGateError(t('corporate.dashboard.noAccountLinked'));
      setLoading(false);
      return;
    }
    if (data.status !== 'approved') {
      setGateError(data.status === 'pending'
        ? t('corporate.dashboard.pendingReview')
        : t('corporate.dashboard.notActive'));
      setLoading(false);
      return;
    }
    setAccount(data as CorporateAccount);
  }, [user, t]);

  const loadBookings = useCallback(async (corporateId: string) => {
    const { data } = await supabase
      .from('bookings')
      // Explicit column list — the full Booking shape, nothing more. These are
      // the agency's own bookings (RLS: bookings_corporate_read).
      .select('id, user_email, user_name, property_id, property_title, property_location, check_in, check_out, guests, price_per_night, total_price, status, payment_status, payment_method, created_at, requested_check_in, requested_check_out, requested_total_price, date_change_status, date_change_requested_at')
      .eq('corporate_id', corporateId)
      .order('created_at', { ascending: false });
    setBookings((data as CorporateBooking[]) ?? []);
    setLoading(false);
  }, []);

  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const res = await fetch(BOOKING_HANDLER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({
          action: 'cancel',
          bookingId: cancelTarget.id,
          // Agency bookings carry the agency's own email — the same value the
          // server authorises against.
          userEmail: session?.user?.email ?? cancelTarget.user_email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCancelError((data as { error?: string }).error ?? t('corporate.dashboard.cancelFailed'));
        return;
      }
      setCancelTarget(null);
      if (account) loadBookings(account.id);
    } catch {
      setCancelError(t('corporate.dashboard.cancelFailed'));
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, account, loadBookings, t]);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn || !user) {
      navigate('/corporate', { replace: true });
      return;
    }
    loadAccount();
  }, [authLoading, isLoggedIn, user, navigate, loadAccount]);

  useEffect(() => {
    if (account) loadBookings(account.id);
  }, [account, loadBookings]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 animate-spin"><i className="ri-loader-4-line text-xl"></i></div>
          <span className="text-sm">{t('corporate.dashboard.loading')}</span>
        </div>
      </div>
    );
  }

  if (gateError || !account) {
    return (
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Inter', sans-serif" }}>
        <Header />
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="ri-shield-keyhole-line text-amber-600 text-3xl"></i>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('corporate.dashboard.unavailableTitle')}</h1>
          <p className="text-sm text-gray-500 mb-6">{gateError ?? t('corporate.dashboard.unavailableFallback')}</p>
          <button
            onClick={() => navigate('/corporate')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            {t('corporate.dashboard.backToCorporate')}
          </button>
        </div>
      </div>
    );
  }

  const confirmedRevenue = bookings
    .filter((b) => b.status === 'confirmed' || b.payment_status === 'paid')
    .reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
  const commission = (confirmedRevenue * Number(account.commission_pct)) / 100;
  const totalBookings = bookings.length;

  const counts = bookings.reduce(
    (acc, b) => {
      const bucket = bucketOf(b.status, b.check_out);
      if (bucket) acc[bucket] += 1;
      return acc;
    },
    { all: bookings.length, active: 0, pending: 0, completed: 0, cancelled: 0 } as Record<BookingFilter, number>,
  );

  const visibleBookings = filter === 'all'
    ? bookings
    : bookings.filter((b) => bucketOf(b.status, b.check_out) === filter);

  const FILTERS: { key: BookingFilter; labelKey: string }[] = [
    { key: 'all',       labelKey: 'corporate.dashboard.filterAll' },
    { key: 'active',    labelKey: 'corporate.dashboard.filterActive' },
    { key: 'pending',   labelKey: 'corporate.dashboard.filterPending' },
    { key: 'completed', labelKey: 'corporate.dashboard.filterCompleted' },
    { key: 'cancelled', labelKey: 'corporate.dashboard.filterCancelled' },
  ];

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      confirmed: t('corporate.dashboard.statusConfirmed'),
      pending: t('corporate.dashboard.statusPending'),
      pending_host_approval: t('corporate.dashboard.statusPendingHostApproval'),
      cancelled: t('corporate.dashboard.statusCancelled'),
      cancelled_by_host: t('corporate.dashboard.statusCancelledByHost'),
      rejected: t('corporate.dashboard.statusRejected'),
    };
    return map[status] ?? status.replaceAll('_', ' ');
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SEO
        title="Corporate Dashboard | RentCottage.Ge"
        description="Agency dashboard — bookings on behalf of clients and commission tracking."
        canonical="/corporate/dashboard"
        noIndex
      />
      <Header />

      <div className="max-w-[1280px] mx-auto px-6 py-10">
        {/* Header strip */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">{t('corporate.dashboard.agencyDashboardLabel')}</div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{account.agency_name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('corporate.dashboard.repLine', { firstName: account.rep_first_name, lastName: account.rep_last_name, taxId: account.tax_id, pct: Number(account.commission_pct).toFixed(0) })}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/search?corporate=1')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <i className="ri-add-line"></i>
              {t('corporate.dashboard.bookCottage')}
            </button>
            <button
              onClick={signOutUser}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors cursor-pointer"
            >
              {t('corporate.dashboard.signOut')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <StatCard label={t('corporate.dashboard.statBookings')} value={totalBookings.toString()} icon="ri-calendar-check-line" />
          <StatCard label={t('corporate.dashboard.statRevenue')} value={`₾${confirmedRevenue.toLocaleString()}`} icon="ri-money-cny-circle-line" />
          <StatCard label={t('corporate.dashboard.statCommission', { pct: Number(account.commission_pct).toFixed(0) })} value={`₾${commission.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon="ri-percent-line" highlight />
        </div>

        {/* Bookings */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-gray-900">{t('corporate.dashboard.bookingHistoryTitle')}</h2>
              <span className="text-xs text-gray-400">
                {t('corporate.dashboard.totalSuffix', { count: filter === 'all' ? totalBookings : visibleBookings.length })}
              </span>
            </div>
            {/* Status filters — every bucket is always offered, showing 0 when
                empty, so an agency can see at a glance that (say) nothing is
                pending rather than wondering whether the tab is missing. */}
            <div className="flex flex-wrap gap-2 mt-3">
              {FILTERS.map((f) => {
                const on = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      on
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-600 hover:text-emerald-700'
                    }`}
                  >
                    {t(f.labelKey)}
                    <span
                      className={`notranslate rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                        on ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                      translate="no"
                    >
                      {counts[f.key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {visibleBookings.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-calendar-line text-gray-400 text-2xl"></i>
              </div>
              {bookings.length === 0 ? (
                <>
                  <p className="text-sm text-gray-500 mb-1">{t('corporate.dashboard.noBookingsTitle')}</p>
                  <p className="text-xs text-gray-400">{t('corporate.dashboard.noBookingsSub')}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">{t('corporate.dashboard.noBookingsInFilter')}</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-5 py-3">{t('corporate.dashboard.colCottage')}</th>
                    <th className="px-5 py-3">{t('corporate.dashboard.colClient')}</th>
                    <th className="px-5 py-3">{t('corporate.dashboard.colStay')}</th>
                    <th className="px-5 py-3 text-right">{t('corporate.dashboard.colRent')}</th>
                    <th className="px-5 py-3 text-right">{t('corporate.dashboard.colCommission')}</th>
                    <th className="px-5 py-3">{t('corporate.dashboard.colStatus')}</th>
                    <th className="px-5 py-3 text-right">{t('corporate.dashboard.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visibleBookings.map((b) => {
                    const commissionPaid = (b.status === 'confirmed' || b.payment_status === 'paid')
                      ? ((Number(b.total_price) || 0) * Number(account.commission_pct)) / 100
                      : 0;
                    return (
                      <tr key={b.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-gray-900">{b.property_title}</div>
                          {b.property_location && <div className="text-xs text-gray-400">{b.property_location}</div>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-gray-700">{b.user_name ?? '—'}</div>
                          <div className="text-xs text-gray-400">{b.user_email}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-gray-700">{formatDate(b.check_in)} → {formatDate(b.check_out)}</div>
                          <div className="text-xs text-gray-400">{plural('searchBar.guest', b.guests)}</div>
                        </td>
                        <td className="px-5 py-4 text-right text-gray-900 font-semibold">
                          ₾{Number(b.total_price ?? 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right text-emerald-700 font-semibold">
                          ₾{commissionPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(b.status)}`}>
                            {statusLabel(b.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {b.date_change_status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 whitespace-nowrap">
                              <i className="ri-time-line"></i>
                              {t('corporate.dashboard.dateChangePending')}
                            </span>
                          ) : canChangeDates(b) ? (
                            <button
                              type="button"
                              onClick={() => setDatesBooking(b)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <i className="ri-calendar-event-line"></i>
                              {t('corporate.dashboard.changeDates')}
                            </button>
                          ) : null}
                          {canCancel(b) && (
                            <button
                              type="button"
                              onClick={() => { setCancelTarget(b); setCancelError(''); }}
                              className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-red-500 hover:text-red-600 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <i className="ri-close-circle-line"></i>
                              {t('corporate.dashboard.cancelBooking')}
                            </button>
                          )}
                          {!canChangeDates(b) && b.date_change_status !== 'pending' && !canCancel(b) && (
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

      {/* Cancel confirmation — an in-page dialog, never window.confirm(). */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">{t('corporate.dashboard.cancelConfirmTitle')}</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {t('corporate.dashboard.cancelConfirmBody', {
                property: cancelTarget.property_title,
                dates: `${formatDate(cancelTarget.check_in)} → ${formatDate(cancelTarget.check_out)}`,
              })}
            </p>
            {cancelTarget.payment_status === 'paid' && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 mb-4">
                {t('corporate.dashboard.cancelRefundNote')}
              </div>
            )}
            {cancelError && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700 mb-4">{cancelError}</div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors disabled:opacity-50"
              >
                {t('corporate.dashboard.cancelKeep')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-lg cursor-pointer transition-colors disabled:opacity-60"
              >
                {cancelling ? t('corporate.dashboard.cancellingEllipsis') : t('corporate.dashboard.cancelConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date-change request — the same flow guests use; the host still approves. */}
      {datesBooking && (
        <ChangeDatesModal
          booking={datesBooking}
          onClose={() => setDatesBooking(null)}
          onSuccess={() => { if (account) loadBookings(account.id); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, highlight = false }: { label: string; value: string; icon: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold uppercase tracking-wide ${highlight ? 'text-emerald-50' : 'text-gray-500'}`}>{label}</span>
        <i className={`${icon} text-lg ${highlight ? 'text-emerald-100' : 'text-gray-400'}`}></i>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-white' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
