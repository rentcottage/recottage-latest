import { useState, useEffect, useCallback } from 'react';
import { todayInGeorgia, type Promo } from '../../../lib/promos';
import { useT } from '../../../i18n';

// promos writes are RLS-locked; admins read/write through the password-gated function.
const ADMIN_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-host-actions`;
const ANON = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;
const adminPost = (payload: Record<string, unknown>) =>
  fetch(ADMIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON,
      'Authorization': `Bearer ${ANON}`,
      'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
    },
    body: JSON.stringify(payload),
  });

type PromoLiveStatus = 'live' | 'scheduled' | 'expired' | 'inactive';

function getLiveStatus(promo: Promo): PromoLiveStatus {
  if (!promo.active) return 'inactive';
  const today = todayInGeorgia();
  if (promo.starts_at && promo.starts_at > today) return 'scheduled';
  if (promo.ends_at && promo.ends_at < today) return 'expired';
  return 'live';
}

const STATUS_STYLE_META: Record<PromoLiveStatus, { badge: string; labelKey: string; icon: string }> = {
  live:      { badge: 'bg-green-100 text-green-700', labelKey: 'admin.promos.statusLive',      icon: 'ri-checkbox-circle-line' },
  scheduled: { badge: 'bg-amber-100 text-amber-700', labelKey: 'admin.promos.statusScheduled', icon: 'ri-time-line' },
  expired:   { badge: 'bg-gray-100 text-gray-500',   labelKey: 'admin.promos.statusExpired',   icon: 'ri-calendar-close-line' },
  inactive:  { badge: 'bg-gray-100 text-gray-500',   labelKey: 'admin.promos.statusInactive',  icon: 'ri-pause-circle-line' },
};

function formatDateShort(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface FormState {
  title: string;
  description: string;
  discount_percent: string;
  location: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  discount_percent: '',
  location: '',
  starts_at: '',
  ends_at: '',
  active: true,
};

interface EditorProps {
  initial: Promo | null;
  onClose: () => void;
  onSaved: () => void;
}

function PromoEditor({ initial, onClose, onSaved }: EditorProps) {
  const { t } = useT();
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          title: initial.title,
          description: initial.description ?? '',
          discount_percent: String(initial.discount_percent),
          location: initial.location,
          starts_at: initial.starts_at ?? '',
          ends_at: initial.ends_at ?? '',
          active: initial.active,
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) {
      setError(t('admin.promos.titleRequiredError'));
      return;
    }
    if (!form.location.trim()) {
      setError(t('admin.promos.locationRequiredError'));
      return;
    }
    const pct = Number(form.discount_percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 90) {
      setError(t('admin.promos.discountRangeError'));
      return;
    }
    if (form.starts_at && form.ends_at && form.ends_at < form.starts_at) {
      setError(t('admin.promos.endBeforeStartError'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        discount_percent: pct,
        location: form.location.trim(),
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        active: form.active,
      };
      const res = await adminPost({ action: 'save-promo', promo: payload, promoId: initial?.id });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || t('admin.promos.failedToSaveError'));
      onSaved();
      onClose();
    } catch (e: unknown) {
      let msg = t('admin.promos.failedToSaveError');
      if (e instanceof Error) msg = e.message;
      else if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
        msg = (e as { message: string }).message;
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-gray-900">
            {initial ? t('admin.promos.editPromo') : t('admin.promos.addPromo')}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label={t('admin.promos.close')}
          >
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.promos.titleLabel')}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={t('admin.promos.titlePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.promos.descriptionLabel')}
              <span className="text-xs font-normal text-gray-400 ml-1">{t('admin.promos.descriptionHint')}</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
              placeholder={t('admin.promos.descriptionPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.promos.discountLabel')}</label>
              <input
                type="number"
                min="1"
                max="90"
                step="1"
                value={form.discount_percent}
                onChange={(e) => update('discount_percent', e.target.value)}
                placeholder="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.promos.locationLabel')}
                <span className="text-xs font-normal text-gray-400 ml-1">{t('admin.promos.locationHint')}</span>
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                placeholder={t('admin.promos.locationPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.promos.startDateLabel')}
                <span className="text-xs font-normal text-gray-400 ml-1">{t('admin.promos.startDateHint')}</span>
              </label>
              <input
                type="date"
                value={form.starts_at}
                onChange={(e) => update('starts_at', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.promos.endDateLabel')}
                <span className="text-xs font-normal text-gray-400 ml-1">{t('admin.promos.endDateHint')}</span>
              </label>
              <input
                type="date"
                value={form.ends_at}
                min={form.starts_at || undefined}
                onChange={(e) => update('ends_at', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update('active', e.target.checked)}
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-sm font-medium text-gray-700">{t('admin.promos.activeLabel')}</span>
            <span className="text-xs text-gray-400">{t('admin.promos.activeHint')}</span>
          </label>

          <div className="text-xs text-gray-500 bg-gray-50 border border-line rounded-lg px-3 py-2 leading-relaxed">
            <i className="ri-information-line mr-1"></i>
            {t('admin.promos.guestInfoNote')}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
          >
            {t('admin.promos.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? t('admin.promos.savingEllipsis') : initial ? t('admin.promos.saveChanges') : t('admin.promos.addPromoBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromosPanel() {
  const { t } = useT();
  const [items, setItems] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorFor, setEditorFor] = useState<Promo | null | 'new'>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminPost({ action: 'fetch-promos' });
      const data = (await res.json().catch(() => ({}))) as { promos?: Promo[]; error?: string };
      if (!res.ok) throw new Error(data.error || t('admin.promos.failedToLoadPromosError'));
      setItems(data.promos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.promos.failedToLoadPromosError'));
      setItems([]);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (promo: Promo) => {
    if (!confirm(t('admin.promos.deleteConfirm', { title: promo.title }))) return;
    setDeleting(promo.id);
    const res = await adminPost({ action: 'delete-promo', promoId: promo.id });
    setDeleting(null);
    if (!res.ok) {
      const msg = ((await res.json().catch(() => ({}))) as { error?: string }).error || t('admin.promos.unknownError');
      alert(t('admin.promos.deleteFailedAlert', { message: msg }));
      return;
    }
    void load();
  };

  return (
    <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
            <i className="ri-price-tag-3-line text-orange-600 text-sm"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{t('admin.promos.title')}</h2>
            <p className="text-xs text-gray-400">{t('admin.promos.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setEditorFor('new')}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          {t('admin.promos.addPromoBtn')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400 gap-3">
          <i className="ri-loader-4-line animate-spin"></i> {t('admin.promos.loadingPromos')}
        </div>
      ) : error ? (
        <div className="px-6 py-8 text-sm text-red-600 bg-red-50">{error}</div>
      ) : items.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-gray-400">
          {t('admin.promos.noPromosYet', { addPromo: t('admin.promos.addPromoBtn') })}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-6 py-3 font-medium">{t('admin.promos.colDiscount')}</th>
              <th className="text-left px-6 py-3 font-medium">{t('admin.promos.colTitle')}</th>
              <th className="text-left px-6 py-3 font-medium">{t('admin.promos.colLocation')}</th>
              <th className="text-left px-6 py-3 font-medium">{t('admin.promos.colDates')}</th>
              <th className="text-left px-6 py-3 font-medium">{t('admin.promos.colStatus')}</th>
              <th className="text-right px-6 py-3 font-medium">{t('admin.promos.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((promo) => {
              const status = getLiveStatus(promo);
              const style = STATUS_STYLE_META[status];
              return (
                <tr key={promo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center bg-red-50 text-red-600 font-bold px-2.5 py-1 rounded-lg whitespace-nowrap">
                      −{Number(promo.discount_percent)}%
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-medium text-gray-900 line-clamp-1 max-w-xs">{promo.title}</div>
                    {promo.description && (
                      <div className="text-xs text-gray-500 line-clamp-1 max-w-xs">{promo.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center gap-1 text-gray-700 whitespace-nowrap">
                      <i className="ri-map-pin-line text-gray-400"></i>
                      {promo.location}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDateShort(promo.starts_at)} — {formatDateShort(promo.ends_at)}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${style.badge}`}>
                      <i className={`${style.icon} text-xs`}></i>
                      {t(style.labelKey)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditorFor(promo)}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
                    >
                      {t('admin.promos.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(promo)}
                      disabled={deleting === promo.id}
                      className="px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded-md cursor-pointer disabled:opacity-50"
                    >
                      {deleting === promo.id ? t('admin.promos.deletingEllipsis') : t('admin.promos.delete')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editorFor !== null && (
        <PromoEditor
          initial={editorFor === 'new' ? null : editorFor}
          onClose={() => setEditorFor(null)}
          onSaved={() => {
            void load();
          }}
        />
      )}
    </div>
  );
}
