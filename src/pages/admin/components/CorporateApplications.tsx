import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@lib/i18n';
import type { TranslateFn } from '@lib/i18n';

const CORPORATE_FN_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/corporate-application-handler`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

interface CorporateApplication {
  id: string;
  agency_name: string;
  tax_id: string;
  rep_first_name: string;
  rep_last_name: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'approved' | 'rejected';
  commission_pct: number;
  rejection_note: string | null;
  created_at: string;
  approved_at: string | null;
}

type FilterTab = 'pending' | 'approved' | 'rejected' | 'all';

function statusBadge(status: string) {
  if (status === 'approved') return 'bg-green-100 text-green-700';
  if (status === 'rejected') return 'bg-red-100 text-red-600';
  return 'bg-amber-100 text-amber-700';
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'common.status.pending',
  approved: 'common.status.approved',
  rejected: 'common.status.rejected',
};

/** Localized label for an application status; unexpected values render as-is. */
function statusLabel(t: TranslateFn, status: string) {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
}

function formatDate(s: string, lang: string) {
  return new Date(s).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CorporateApplications() {
  const { t, lang } = useTranslation();
  const [apps, setApps] = useState<CorporateApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CorporateApplication | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(CORPORATE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
        },
        body: JSON.stringify({ action: 'admin-list' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.applications)) {
        setApps(data.applications as CorporateApplication[]);
      }
    } catch (err) {
      console.error('[CorporateApplications] load failed', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: 'admin-approve' | 'admin-reject', note?: string) => {
    setActionLoading(id + action);
    try {
      const res = await fetch(CORPORATE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
        },
        body: JSON.stringify({ action, applicationId: id, rejectionNote: note }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(action === 'admin-approve' ? t('admin.corporate.toasts.approved') : t('admin.corporate.toasts.rejected'), 'success');
        await load();
        setRejectTarget(null);
        setRejectNote('');
      } else {
        showToast((data.error as string) ?? t('common.requestFailed', { status: res.status }), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('common.networkError'), 'error');
    }
    setActionLoading(null);
  };

  const filtered = apps.filter((a) => filter === 'all' ? true : a.status === filter);
  const counts = {
    pending: apps.filter((a) => a.status === 'pending').length,
    approved: apps.filter((a) => a.status === 'approved').length,
    rejected: apps.filter((a) => a.status === 'rejected').length,
    all: apps.length,
  };

  return (
    <div className="bg-white rounded-2xl border border-line shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">{t('admin.corporate.title')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('admin.corporate.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                filter === tab
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'all' ? t('common.all') : statusLabel(t, tab)} ({counts[tab]})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="px-6 py-12 text-center text-sm text-gray-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-gray-500">
            {filter === 'all'
              ? t('admin.corporate.empty')
              : t('admin.corporate.emptyFiltered', { status: statusLabel(t, filter).toLowerCase() })}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">{t('admin.corporate.table.agency')}</th>
                <th className="px-5 py-3">{t('admin.corporate.table.taxId')}</th>
                <th className="px-5 py-3">{t('admin.corporate.table.representative')}</th>
                <th className="px-5 py-3">{t('admin.corporate.table.contact')}</th>
                <th className="px-5 py-3">{t('common.submitted')}</th>
                <th className="px-5 py-3">{t('common.statusLabel')}</th>
                <th className="px-5 py-3 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-gray-900">{a.agency_name}</div>
                    <div className="text-xs text-gray-400">{t('admin.corporate.commission', { pct: Number(a.commission_pct).toFixed(0) })}</div>
                  </td>
                  <td className="px-5 py-4 text-gray-700 font-mono text-xs">{a.tax_id}</td>
                  <td className="px-5 py-4 text-gray-700">{a.rep_first_name} {a.rep_last_name}</td>
                  <td className="px-5 py-4">
                    <div className="text-gray-700">{a.email}</div>
                    {a.phone && <div className="text-xs text-gray-400">{a.phone}</div>}
                  </td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{formatDate(a.created_at, lang)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(a.status)}`}>
                      {statusLabel(t, a.status)}
                    </span>
                    {a.status === 'rejected' && a.rejection_note && (
                      <div className="text-xs text-red-500 mt-1 max-w-xs truncate" title={a.rejection_note}>
                        {a.rejection_note}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {a.status === 'pending' ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleAction(a.id, 'admin-approve')}
                          disabled={actionLoading === a.id + 'admin-approve'}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                        >
                          <i className="ri-check-line"></i>
                          {t('common.approve')}
                        </button>
                        <button
                          onClick={() => { setRejectTarget(a); setRejectNote(''); }}
                          disabled={actionLoading === a.id + 'admin-reject'}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                        >
                          <i className="ri-close-line"></i>
                          {t('common.reject')}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{t('admin.corporate.reject.title')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('admin.corporate.reject.bodyBefore')} <strong>{rejectTarget.agency_name}</strong>. {t('admin.corporate.reject.bodyAfter')}
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder={t('admin.corporate.reject.placeholder')}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[100px]"
            />
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 bg-white border border-line hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg cursor-pointer transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleAction(rejectTarget.id, 'admin-reject', rejectNote)}
                disabled={actionLoading === rejectTarget.id + 'admin-reject'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors"
              >
                {t('admin.corporate.reject.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium text-white ${toast.type === 'success' ? 'bg-gray-900' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
