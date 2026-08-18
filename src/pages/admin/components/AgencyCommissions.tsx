import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../../i18n';

const CORPORATE_FN_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/corporate-application-handler`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

interface Agency {
  id: string;
  agency_name: string;
  tax_id: string;
  email: string;
  phone: string | null;
  commission_pct: number;
}

interface AgencyBooking {
  id: string;
  corporate_id: string;
  property_title: string | null;
  user_name: string | null;
  check_in: string | null;
  check_out: string | null;
  total_price: number | null;
  status: string;
  payment_status: string | null;
  created_at: string;
}

interface AgencyRow {
  agency: Agency;
  bookings: AgencyBooking[];
  payableCount: number;
  revenue: number;
  owed: number;
}

/**
 * A booking only earns commission once the money is real — same rule the
 * agency's own dashboard uses, so both sides always show the same number.
 */
function isPayable(b: AgencyBooking): boolean {
  return b.status === 'confirmed' || b.payment_status === 'paid';
}

function commissionOf(b: AgencyBooking, pct: number): number {
  if (!isPayable(b)) return 0;
  return ((Number(b.total_price) || 0) * Number(pct)) / 100;
}

function money(n: number): string {
  return `₾${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status: string) {
  if (status === 'confirmed') return 'bg-green-100 text-green-700';
  if (status === 'pending' || status === 'pending_host_approval') return 'bg-amber-100 text-amber-700';
  if (status === 'cancelled' || status === 'cancelled_by_host' || status === 'rejected') return 'bg-red-100 text-red-600';
  return 'bg-gray-100 text-gray-600';
}

export default function AgencyCommissions() {
  const { t } = useT();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [bookings, setBookings] = useState<AgencyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [agencyId, setAgencyId] = useState<string>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [payableOnly, setPayableOnly] = useState(true);

  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(CORPORATE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
        },
        body: JSON.stringify({ action: 'admin-commissions' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.agencies)) {
        setAgencies(data.agencies as Agency[]);
        setBookings((data.bookings ?? []) as AgencyBooking[]);
      } else {
        setError((data.error as string) ?? t('admin.agencyCommissions.loadFailed'));
      }
    } catch (err) {
      console.error('[AgencyCommissions] load failed', err);
      setError(t('admin.agencyCommissions.loadFailed'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  // Date range is applied here rather than server-side so changing it is
  // instant and doesn't re-hit the function on every keystroke.
  const rows: AgencyRow[] = useMemo(() => {
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;

    const inRange = (b: AgencyBooking) => {
      const ts = new Date(b.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    };

    return agencies
      .filter((a) => agencyId === 'all' || a.id === agencyId)
      .map((agency) => {
        const mine = bookings
          .filter((b) => b.corporate_id === agency.id)
          .filter(inRange)
          .filter((b) => (payableOnly ? isPayable(b) : true));
        const payable = mine.filter(isPayable);
        return {
          agency,
          bookings: mine,
          payableCount: payable.length,
          revenue: payable.reduce((s, b) => s + (Number(b.total_price) || 0), 0),
          owed: payable.reduce((s, b) => s + commissionOf(b, agency.commission_pct), 0),
        };
      })
      .filter((r) => r.bookings.length > 0)
      .sort((a, b) => b.owed - a.owed);
  }, [agencies, bookings, agencyId, from, to, payableOnly]);

  const totals = useMemo(() => ({
    agencies: rows.length,
    bookings: rows.reduce((s, r) => s + r.payableCount, 0),
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    owed: rows.reduce((s, r) => s + r.owed, 0),
  }), [rows]);

  const exportCsv = () => {
    if (rows.length === 0) return;
    const head = ['Agency', 'Tax ID', 'Email', 'Rate %', 'Payable bookings', 'Payable revenue', 'You owe'];
    const lines = rows.map((r) => [
      r.agency.agency_name,
      r.agency.tax_id,
      r.agency.email,
      Number(r.agency.commission_pct).toFixed(2),
      String(r.payableCount),
      r.revenue.toFixed(2),
      r.owed.toFixed(2),
    ]);
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const csv = [head, ...lines].map((l) => l.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `agency-commissions${from ? `-${from}` : ''}${to ? `-${to}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setAgencyId('all');
    setFrom('');
    setTo('');
    setPayableOnly(true);
  };

  const fieldCls = 'px-3 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-700';

  return (
    <div className="bg-white rounded-2xl border border-line shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">{t('admin.agencyCommissions.title')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('admin.agencyCommissions.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            title={rows.length === 0 ? t('admin.agencyCommissions.exportNoData') : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
          >
            <i className="ri-download-2-line"></i>
            {t('admin.agencyCommissions.exportCsv')}
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
          >
            <i className="ri-refresh-line"></i>
            {t('admin.agencyCommissions.refresh')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{t('admin.agencyCommissions.filterAgency')}</span>
          <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className={fieldCls}>
            <option value="all">{t('admin.agencyCommissions.filterAllAgencies')}</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.agency_name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{t('admin.agencyCommissions.filterFrom')}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldCls} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{t('admin.agencyCommissions.filterTo')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldCls} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{t('admin.agencyCommissions.filterEarned')}</span>
          <select value={payableOnly ? 'payable' : 'all'} onChange={(e) => setPayableOnly(e.target.value === 'payable')} className={fieldCls}>
            <option value="payable">{t('admin.agencyCommissions.filterEarnedPayable')}</option>
            <option value="all">{t('admin.agencyCommissions.filterEarnedAll')}</option>
          </select>
        </label>

        <button
          onClick={clearFilters}
          className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
        >
          {t('admin.agencyCommissions.filterClear')}
        </button>

        <p className="text-[11px] text-gray-400 ml-auto max-w-xs">{t('admin.agencyCommissions.payableHint')}</p>
      </div>

      {/* Totals */}
      <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-gray-100">
        <Stat label={t('admin.agencyCommissions.statAgencies')} value={String(totals.agencies)} icon="ri-briefcase-line" />
        <Stat label={t('admin.agencyCommissions.statBookings')} value={String(totals.bookings)} icon="ri-calendar-check-line" />
        <Stat label={t('admin.agencyCommissions.statRevenue')} value={money(totals.revenue)} icon="ri-money-dollar-circle-line" />
        <Stat label={t('admin.agencyCommissions.statOwed')} value={money(totals.owed)} icon="ri-percent-line" highlight />
      </div>

      {loading ? (
        <div className="px-6 py-12 text-center text-sm text-gray-400">{t('admin.agencyCommissions.loadingEllipsis')}</div>
      ) : error ? (
        <div className="px-6 py-12 text-center text-sm text-red-500">{error}</div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-gray-500">{t('admin.agencyCommissions.noRows')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">{t('admin.agencyCommissions.colAgency')}</th>
                <th className="px-5 py-3">{t('admin.agencyCommissions.colContact')}</th>
                <th className="px-5 py-3 text-right">{t('admin.agencyCommissions.colRate')}</th>
                <th className="px-5 py-3 text-right">{t('admin.agencyCommissions.colBookings')}</th>
                <th className="px-5 py-3 text-right">{t('admin.agencyCommissions.colRevenue')}</th>
                <th className="px-5 py-3 text-right">{t('admin.agencyCommissions.colOwed')}</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <Fragment key={r.agency.id}>
                  <tr className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{r.agency.agency_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{r.agency.tax_id}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-gray-700 text-xs">{r.agency.email}</div>
                      {r.agency.phone && <div className="text-xs text-gray-400">{r.agency.phone}</div>}
                    </td>
                    <td className="px-5 py-4 text-right text-gray-700">{Number(r.agency.commission_pct).toFixed(0)}%</td>
                    <td className="px-5 py-4 text-right text-gray-700">{r.payableCount}</td>
                    <td className="px-5 py-4 text-right text-gray-700">{money(r.revenue)}</td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-700">{money(r.owed)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setExpanded(expanded === r.agency.id ? null : r.agency.id)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap"
                      >
                        {expanded === r.agency.id
                          ? t('admin.agencyCommissions.hideBookings')
                          : `${t('admin.agencyCommissions.viewBookings')} (${r.bookings.length})`}
                      </button>
                    </td>
                  </tr>

                  {expanded === r.agency.id && (
                    <tr>
                      <td colSpan={7} className="px-5 py-4 bg-gray-50/80">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                              <th className="px-3 py-2">{t('admin.agencyCommissions.bkGuest')}</th>
                              <th className="px-3 py-2">{t('admin.agencyCommissions.bkProperty')}</th>
                              <th className="px-3 py-2">{t('admin.agencyCommissions.bkStay')}</th>
                              <th className="px-3 py-2">{t('admin.agencyCommissions.bkBooked')}</th>
                              <th className="px-3 py-2">{t('admin.agencyCommissions.bkStatus')}</th>
                              <th className="px-3 py-2 text-right">{t('admin.agencyCommissions.bkTotal')}</th>
                              <th className="px-3 py-2 text-right">{t('admin.agencyCommissions.bkCommission')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {r.bookings.map((b) => {
                              const c = commissionOf(b, r.agency.commission_pct);
                              return (
                                <tr key={b.id}>
                                  <td className="px-3 py-2 text-gray-700">{b.user_name ?? '—'}</td>
                                  <td className="px-3 py-2 text-gray-700">{b.property_title ?? '—'}</td>
                                  <td className="px-3 py-2 text-gray-500">{formatDate(b.check_in)} → {formatDate(b.check_out)}</td>
                                  <td className="px-3 py-2 text-gray-500">{formatDate(b.created_at)}</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadge(b.status)}`}>
                                      {b.status.replaceAll('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">{money(Number(b.total_price) || 0)}</td>
                                  <td className="px-3 py-2 text-right">
                                    {isPayable(b)
                                      ? <span className="font-semibold text-emerald-700">{money(c)}</span>
                                      : <span className="text-gray-400 italic">{t('admin.agencyCommissions.bkNotPayable')}</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon, highlight }: { label: string; value: string; icon: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 border ${highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
        <i className={`${icon} ${highlight ? 'text-emerald-600' : 'text-gray-400'}`}></i>
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold ${highlight ? 'text-emerald-700' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
