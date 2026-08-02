import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/feature/Header';
import SEO from '../../../components/feature/SEO';
import { supabase } from '../../../lib/supabase';
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

interface CorporateBooking {
  id: string;
  user_name: string | null;
  user_email: string;
  property_title: string;
  property_location: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number | null;
  status: string;
  payment_status: string | null;
  created_at: string;
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
      .select('id, user_name, user_email, property_title, property_location, check_in, check_out, guests, total_price, status, payment_status, created_at')
      .eq('corporate_id', corporateId)
      .order('created_at', { ascending: false });
    setBookings((data as CorporateBooking[]) ?? []);
    setLoading(false);
  }, []);

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
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">{t('corporate.dashboard.bookingHistoryTitle')}</h2>
            <span className="text-xs text-gray-400">{t('corporate.dashboard.totalSuffix', { count: totalBookings })}</span>
          </div>
          {bookings.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-calendar-line text-gray-400 text-2xl"></i>
              </div>
              <p className="text-sm text-gray-500 mb-1">{t('corporate.dashboard.noBookingsTitle')}</p>
              <p className="text-xs text-gray-400">{t('corporate.dashboard.noBookingsSub')}</p>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bookings.map((b) => {
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
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
