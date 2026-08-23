import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useT } from '../../../i18n';
import { offerLabel, formatPercent, todayInGeorgia, type HostOffer, type OfferType } from '../../../lib/hostOffers';

interface Property {
  id: string;
  title: string;
  status: string;
}

interface Props {
  properties: Property[];
  loading: boolean;
}

type OfferStatus = 'active' | 'paused' | 'scheduled' | 'expired';

/** What the host sees on the badge — derived, never stored. */
function offerStatus(o: HostOffer, today: string): OfferStatus {
  if (!o.active) return 'paused';
  if (o.ends_at && o.ends_at < today) return 'expired';
  if (o.starts_at && o.starts_at > today) return 'scheduled';
  return 'active';
}

const STATUS_STYLES: Record<OfferStatus, string> = {
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused:    'bg-gray-100 text-gray-500 border-gray-200',
  scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  expired:   'bg-red-50 text-red-600 border-red-200',
};

/**
 * Parse a draft field, clamped into range. An empty or half-typed box (e.g.
 * "" or ".") falls back, so the preview and the saved row always hold a legal
 * value even mid-edit.
 */
function parseClamped(draft: string, min: number, max: number, fallback: number): number {
  const n = Number(draft);
  if (!isFinite(n) || draft.trim() === '') return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Keep only what can build a number, so letters never reach the state. */
function numericDraft(raw: string, allowDecimal: boolean): string {
  const cleaned = raw.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
  if (!allowDecimal) return cleaned;
  const [head, ...rest] = cleaned.split('.');
  return rest.length ? `${head}.${rest.join('')}` : head;
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface FormState {
  id: string | null;
  property_id: string;
  title: string;
  offer_type: OfferType;
  /** Kept populated for BOTH types so switching the tab doesn't lose input. */
  // Held as strings while the modal is open: a number-typed state clamped on
  // every keystroke makes the field impossible to clear and retype — it snaps
  // back to the minimum as soon as it is emptied. These are parsed and clamped
  // on blur and again on save.
  buy_nights: string;
  free_nights: string;
  discount_percent: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  id: null, property_id: '', title: '', offer_type: 'free_nights',
  buy_nights: '2', free_nights: '1', discount_percent: '10',
  starts_at: '', ends_at: '', active: true,
};

/**
 * "My Offers" — the host's own free-night stay deals ("1+1", "2+1", …).
 *
 * Writes go straight through the supabase client under the host_offers RLS
 * policies (host_email = the host's JWT email), the same pattern as blocked
 * dates. There is no admin approval step: an active offer on an approved
 * property reaches the homepage on the guest's next page load.
 */
export default function HostOffersSection({ properties, loading: propsLoading }: Props) {
  const { t } = useT();
  const { user } = useAuth();
  const [offers, setOffers] = useState<HostOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [filterPropertyId, setFilterPropertyId] = useState('all');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const today = todayInGeorgia();

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchOffers = useCallback(async () => {
    if (!user?.email || propsLoading) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('host_offers')
      .select('*')
      .eq('host_email', user.email)
      .order('created_at', { ascending: false });
    // A missing table is the expected state until db/host-offers-create.sql is
    // run — say so plainly instead of showing an empty list that looks broken.
    if (error) setTableMissing(true);
    else { setTableMissing(false); setOffers((data ?? []) as HostOffer[]); }
    setLoading(false);
  }, [user?.email, propsLoading]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const propertyTitle = useCallback(
    (id: string) => properties.find((p) => p.id === id)?.title ?? '—',
    [properties],
  );

  const visibleOffers = useMemo(
    () => (filterPropertyId === 'all' ? offers : offers.filter((o) => o.property_id === filterPropertyId)),
    [offers, filterPropertyId],
  );

  const openNew = () => {
    const first = properties.find((p) => p.status === 'approved') ?? properties[0];
    setFormError('');
    setForm({ ...EMPTY_FORM, property_id: first?.id ?? '' });
  };

  const openEdit = (o: HostOffer) => {
    setFormError('');
    setForm({
      id: o.id,
      property_id: o.property_id,
      title: o.title ?? '',
      offer_type: o.offer_type,
      // The other type's fields fall back to the defaults, so a host who
      // switches tabs mid-edit still sees a sensible starting point.
      buy_nights: o.buy_nights === null ? EMPTY_FORM.buy_nights : String(o.buy_nights),
      free_nights: o.free_nights === null ? EMPTY_FORM.free_nights : String(o.free_nights),
      discount_percent: o.discount_percent === null ? EMPTY_FORM.discount_percent : formatPercent(o.discount_percent),
      starts_at: o.starts_at ?? '',
      ends_at: o.ends_at ?? '',
      active: o.active,
    });
  };

  const handleSave = async () => {
    if (!form || !user?.email) return;
    const buyN  = parseClamped(form.buy_nights, 1, 30, 1);
    const freeN = parseClamped(form.free_nights, 1, 30, 1);
    const pct   = parseClamped(form.discount_percent, 1, 90, 10);
    if (form.offer_type === 'free_nights' && freeN > buyN) {
      setFormError(t('host.offers.validationNights')); return;
    }
    if (form.offer_type === 'discount' && (pct <= 0 || pct > 90)) {
      setFormError(t('host.offers.validationPercent')); return;
    }
    if (form.starts_at && form.ends_at && form.ends_at < form.starts_at) {
      setFormError(t('host.offers.validationDates')); return;
    }
    if (!form.property_id) return;
    setSaving(true);
    setFormError('');

    // Only the chosen type's fields are written; the other type's columns go
    // NULL, matching the host_offers_shape CHECK constraint exactly.
    const isFree = form.offer_type === 'free_nights';
    const row = {
      property_id: form.property_id,
      host_email: user.email,
      title: form.title.trim() || null,
      offer_type: form.offer_type,
      buy_nights: isFree ? buyN : null,
      free_nights: isFree ? freeN : null,
      discount_percent: isFree ? null : pct,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      active: form.active,
    };

    const { error } = form.id
      ? await supabase.from('host_offers').update(row).eq('id', form.id)
      : await supabase.from('host_offers').insert(row);

    setSaving(false);
    if (error) { showToast(t('host.offers.errorToast'), 'error'); return; }
    setForm(null);
    showToast(t('host.offers.savedToast'), 'success');
    fetchOffers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('host.offers.deleteConfirm'))) return;
    const { error } = await supabase.from('host_offers').delete().eq('id', id);
    if (error) { showToast(t('host.offers.errorToast'), 'error'); return; }
    showToast(t('host.offers.deletedToast'), 'success');
    fetchOffers();
  };

  const toggleActive = async (o: HostOffer) => {
    const { error } = await supabase.from('host_offers').update({ active: !o.active }).eq('id', o.id);
    if (error) { showToast(t('host.offers.errorToast'), 'error'); return; }
    fetchOffers();
  };

  const dateRangeLabel = (o: HostOffer) => {
    if (o.starts_at && o.ends_at) return t('host.offers.dateRangeBetween', { from: fmt(o.starts_at), to: fmt(o.ends_at) });
    if (o.starts_at) return t('host.offers.dateRangeFrom', { date: fmt(o.starts_at) });
    if (o.ends_at)   return t('host.offers.dateRangeUntil', { date: fmt(o.ends_at) });
    return t('host.offers.dateRangeOpen');
  };

  if (propsLoading || loading) {
    return (
      <div className="flex items-center gap-3 text-gray-400 py-16 justify-center">
        <span className="w-5 h-5 flex items-center justify-center animate-spin"><i className="ri-loader-4-line text-xl"></i></span>
        <span className="text-sm">{t('host.offers.loading')}</span>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-home-2-line text-2xl text-gray-400"></i>
        </div>
        <h3 className="text-base font-semibold text-gray-800 mb-1">{t('host.offers.noProperties')}</h3>
        <p className="text-sm text-gray-400">{t('host.offers.noPropertiesSub')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('host.offers.title')}</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">{t('host.offers.sub')}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          {t('host.offers.addOffer')}
        </button>
      </div>

      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
          <i className="ri-database-2-line mt-0.5 flex-shrink-0"></i>
          <span>{t('host.offers.tableNotReady')}</span>
        </div>
      )}

      {/* Property filter */}
      {properties.length > 1 && (
        <select
          value={filterPropertyId}
          onChange={(e) => setFilterPropertyId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white cursor-pointer"
        >
          <option value="all">{t('host.offers.filterAll')}</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      )}

      {/* Offer list */}
      {visibleOffers.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-price-tag-3-line text-2xl text-red-400"></i>
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">{t('host.offers.empty')}</h3>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">{t('host.offers.emptySub')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleOffers.map((o) => {
            const status = offerStatus(o, today);
            return (
              <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  {/* The deal itself, as big as it deserves to be. */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex-shrink-0 text-white font-extrabold text-lg rounded-xl px-3 py-2 notranslate bg-gradient-to-br ${
                      o.offer_type === 'discount' ? 'from-emerald-600 to-teal-500' : 'from-red-500 to-amber-500'
                    }`} translate="no">
                      {offerLabel(o)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {o.title || (o.offer_type === 'discount'
                          ? t('host.offers.discountLabel', { percent: formatPercent(o.discount_percent) })
                          : t('host.offers.nightsLabel', { buy: Number(o.buy_nights), free: Number(o.free_nights) }))}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{propertyTitle(o.property_id)}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLES[status]}`}>
                    {t(`host.offers.status${status.charAt(0).toUpperCase()}${status.slice(1)}`)}
                  </span>
                </div>

                <p className="text-xs text-gray-500">
                  {o.offer_type === 'discount'
                    ? t('host.offers.previewDiscount', { percent: formatPercent(o.discount_percent) })
                    : t('host.offers.preview', {
                        total: Number(o.buy_nights) + Number(o.free_nights),
                        paid: Number(o.buy_nights),
                      })}
                </p>
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <i className="ri-calendar-line"></i>{dateRangeLabel(o)}
                </p>

                <div className="flex items-center gap-2 pt-1 mt-auto border-t border-gray-100">
                  <button
                    onClick={() => openEdit(o)}
                    className="flex-1 mt-2 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="ri-edit-line mr-1"></i>{t('host.offers.editOffer')}
                  </button>
                  <button
                    onClick={() => toggleActive(o)}
                    className="mt-2 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {o.active ? t('host.offers.pause') : t('host.offers.activate')}
                  </button>
                  <button
                    onClick={() => handleDelete(o.id)}
                    aria-label={t('host.offers.delete')}
                    className="mt-2 px-3 py-2 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      {form && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                {form.id ? t('host.offers.editOffer') : t('host.offers.newOffer')}
              </h3>
              <button onClick={() => setForm(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500 text-lg"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.offers.fieldProperty')}</label>
                <select
                  value={form.property_id}
                  onChange={(e) => setForm({ ...form, property_id: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm cursor-pointer"
                >
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.offers.fieldTitle')}</label>
                <input
                  type="text"
                  value={form.title}
                  placeholder={t('host.offers.fieldTitlePlaceholder')}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              {/* Which kind of deal. Two tabs rather than a dropdown: there
                  are only two, and the choice changes the fields below. */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.offers.fieldType')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'free_nights' as OfferType, icon: 'ri-gift-line', labelKey: 'host.offers.typeFreeNights', subKey: 'host.offers.typeFreeNightsSub' },
                    { key: 'discount' as OfferType, icon: 'ri-percent-line', labelKey: 'host.offers.typeDiscount', subKey: 'host.offers.typeDiscountSub' },
                  ]).map((opt) => {
                    const on = form.offer_type === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => { setForm({ ...form, offer_type: opt.key }); setFormError(''); }}
                        className={`flex flex-col items-start gap-0.5 p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                          on ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className={`flex items-center gap-1.5 text-sm font-semibold ${on ? 'text-red-600' : 'text-gray-700'}`}>
                          <i className={opt.icon}></i>{t(opt.labelKey)}
                        </span>
                        <span className={`text-[11px] leading-snug ${on ? 'text-red-400' : 'text-gray-400'}`}>{t(opt.subKey)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.offer_type === 'free_nights' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.offers.fieldBuyNights')}</label>
                    <input
                      type="text" inputMode="numeric"
                      value={form.buy_nights}
                      onChange={(e) => setForm({ ...form, buy_nights: numericDraft(e.target.value, false) })}
                      onBlur={() => setForm((f) => f && { ...f, buy_nights: String(parseClamped(f.buy_nights, 1, 30, 1)) })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.offers.fieldFreeNights')}</label>
                    <input
                      type="text" inputMode="numeric"
                      value={form.free_nights}
                      onChange={(e) => setForm({ ...form, free_nights: numericDraft(e.target.value, false) })}
                      onBlur={() => setForm((f) => f && { ...f, free_nights: String(parseClamped(f.free_nights, 1, 30, 1)) })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.offers.fieldPercent')}</label>
                  <div className="relative">
                    <input
                      type="text" inputMode="decimal"
                      value={form.discount_percent}
                      onChange={(e) => setForm({ ...form, discount_percent: numericDraft(e.target.value, true) })}
                      onBlur={() => setForm((f) => f && { ...f, discount_percent: formatPercent(parseClamped(f.discount_percent, 1, 90, 10)) })}
                      className="w-full px-3 py-2.5 pr-9 border border-gray-200 rounded-lg text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                  </div>
                </div>
              )}

              <div className={`bg-gradient-to-r border rounded-xl p-4 flex items-center gap-3 ${
                form.offer_type === 'discount'
                  ? 'from-emerald-50 to-teal-50 border-emerald-200'
                  : 'from-red-50 to-amber-50 border-amber-200'
              }`}>
                <span className={`flex-shrink-0 text-white font-extrabold text-lg rounded-xl px-3 py-2 notranslate bg-gradient-to-br ${
                  form.offer_type === 'discount' ? 'from-emerald-600 to-teal-500' : 'from-red-500 to-amber-500'
                }`} translate="no">
                  {form.offer_type === 'discount'
                    ? `−${formatPercent(parseClamped(form.discount_percent, 1, 90, 10))}%`
                    : `${parseClamped(form.buy_nights, 1, 30, 1)}+${parseClamped(form.free_nights, 1, 30, 1)}`}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {form.offer_type === 'discount'
                      ? t('host.offers.previewDiscount', { percent: formatPercent(parseClamped(form.discount_percent, 1, 90, 10)) })
                      : t('host.offers.preview', {
                          total: parseClamped(form.buy_nights, 1, 30, 1) + parseClamped(form.free_nights, 1, 30, 1),
                          paid: parseClamped(form.buy_nights, 1, 30, 1),
                        })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.offer_type === 'discount' ? t('host.offers.helpDiscount') : t('host.offers.helpNights')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.offers.fieldStarts')}</label>
                  <input
                    type="date" value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.offers.fieldEnds')}</label>
                  <input
                    type="date" value={form.ends_at} min={form.starts_at || undefined}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">{t('host.offers.datesNote')}</p>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox" checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 accent-red-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">{t('host.offers.fieldActive')}</span>
              </label>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setForm(null)}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                {t('host.offers.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {saving ? t('host.offers.saving') : t('host.offers.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
