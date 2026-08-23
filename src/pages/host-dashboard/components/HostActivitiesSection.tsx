import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useT } from '../../../i18n';
import { compressImage } from '../../../lib/imageCompression';
import {
  CATEGORIES, CATEGORY_EMOJI, formatDuration, formatGel,
  type ActivityCategory, type PriceUnit, type PropertyActivity,
} from '../../../lib/propertyActivities';

interface Property {
  id: string;
  title: string;
  status: string;
}

interface Props {
  properties: Property[];
  loading: boolean;
}

const PRICE_UNITS: PriceUnit[] = ['per_person', 'per_group', 'free', 'on_request'];

/** A price is only typed in for the two units that actually carry one. */
function unitHasPrice(unit: PriceUnit): boolean {
  return unit === 'per_person' || unit === 'per_group';
}

interface FormState {
  id: string | null;
  property_id: string;
  title: string;
  description: string;
  category: ActivityCategory;
  /** Drafts, so the boxes can be cleared and retyped (see host offers). */
  price: string;
  duration_minutes: string;
  price_unit: PriceUnit;
  image_url: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  id: null, property_id: '', title: '', description: '', category: 'cooking',
  price: '', duration_minutes: '', price_unit: 'per_person', image_url: '', active: true,
};

/** Parse a draft field; blank or half-typed yields null rather than 0. */
function parseNumber(draft: string): number | null {
  const t = draft.trim();
  if (!t) return null;
  const n = Number(t);
  return isFinite(n) && n >= 0 ? n : null;
}

function numericDraft(raw: string, allowDecimal: boolean): string {
  const cleaned = raw.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
  if (!allowDecimal) return cleaned;
  const [head, ...rest] = cleaned.split('.');
  return rest.length ? `${head}.${rest.join('')}` : head;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * "Activities & Experiences" — the extras a host offers alongside the stay.
 *
 * Writes go through the supabase client under the property_activities RLS
 * policies (host_email = the host's JWT email), the same pattern as offers and
 * blocked dates. Photos reuse the existing `property-photos` bucket under an
 * `activities/` prefix, so no new bucket or storage policy is needed.
 */
export default function HostActivitiesSection({ properties, loading: propsLoading }: Props) {
  const { t } = useT();
  const { user } = useAuth();
  const [activities, setActivities] = useState<PropertyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [filterPropertyId, setFilterPropertyId] = useState('all');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchActivities = useCallback(async () => {
    if (!user?.email || propsLoading) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('property_activities')
      .select('*')
      .eq('host_email', user.email)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    // A missing table is the expected state until the SQL is run — say so
    // plainly instead of showing an empty list that looks broken.
    if (error) setTableMissing(true);
    else { setTableMissing(false); setActivities((data ?? []) as PropertyActivity[]); }
    setLoading(false);
  }, [user?.email, propsLoading]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const propertyTitle = useCallback(
    (id: string) => properties.find((p) => p.id === id)?.title ?? '—',
    [properties],
  );

  const visible = useMemo(
    () => (filterPropertyId === 'all' ? activities : activities.filter((a) => a.property_id === filterPropertyId)),
    [activities, filterPropertyId],
  );

  const openNew = () => {
    const first = properties.find((p) => p.status === 'approved') ?? properties[0];
    setFormError('');
    setForm({ ...EMPTY_FORM, property_id: first?.id ?? '' });
  };

  const openEdit = (a: PropertyActivity) => {
    setFormError('');
    setForm({
      id: a.id,
      property_id: a.property_id,
      title: a.title,
      description: a.description ?? '',
      category: a.category,
      price: a.price === null ? '' : String(a.price),
      duration_minutes: a.duration_minutes === null ? '' : String(a.duration_minutes),
      price_unit: a.price_unit,
      image_url: a.image_url ?? '',
      active: a.active,
    });
  };

  const handleUpload = async (file: File) => {
    if (!form) return;
    if (file.size > MAX_IMAGE_BYTES) { setFormError(t('host.activities.imageTooLarge')); return; }
    setUploading(true);
    setFormError('');
    try {
      const uploadFile = await compressImage(file);
      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const path = `${form.property_id}/activities/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('property-photos')
        .upload(path, uploadFile, { contentType: uploadFile.type, upsert: false });
      if (upErr) { setFormError(t('host.activities.uploadFailed')); setUploading(false); return; }
      const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(path);
      setForm((f) => f && { ...f, image_url: urlData.publicUrl });
    } catch {
      setFormError(t('host.activities.uploadFailed'));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form || !user?.email) return;
    if (!form.title.trim()) { setFormError(t('host.activities.validationTitle')); return; }
    if (!form.property_id) return;

    const price = unitHasPrice(form.price_unit) ? parseNumber(form.price) : null;
    if (unitHasPrice(form.price_unit) && price === null) {
      setFormError(t('host.activities.validationPrice')); return;
    }

    setSaving(true);
    setFormError('');
    const row = {
      property_id: form.property_id,
      host_email: user.email,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      // 'free' stores 0 so the card can say "Free"; 'on_request' stores null.
      price: form.price_unit === 'free' ? 0 : price,
      price_unit: form.price_unit,
      duration_minutes: parseNumber(form.duration_minutes),
      image_url: form.image_url || null,
      active: form.active,
    };

    const { error } = form.id
      ? await supabase.from('property_activities').update(row).eq('id', form.id)
      : await supabase.from('property_activities').insert(row);

    setSaving(false);
    if (error) { showToast(t('host.activities.errorToast'), 'error'); return; }
    setForm(null);
    showToast(t('host.activities.savedToast'), 'success');
    fetchActivities();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('host.activities.deleteConfirm'))) return;
    const { error } = await supabase.from('property_activities').delete().eq('id', id);
    if (error) { showToast(t('host.activities.errorToast'), 'error'); return; }
    showToast(t('host.activities.deletedToast'), 'success');
    fetchActivities();
  };

  const toggleActive = async (a: PropertyActivity) => {
    const { error } = await supabase.from('property_activities').update({ active: !a.active }).eq('id', a.id);
    if (error) { showToast(t('host.activities.errorToast'), 'error'); return; }
    fetchActivities();
  };

  const priceLabel = (a: PropertyActivity): string => {
    if (a.price_unit === 'on_request') return t('host.activities.unitOnRequest');
    if (a.price_unit === 'free') return t('host.activities.unitFree');
    const amount = `₾${formatGel(Number(a.price ?? 0))}`;
    return a.price_unit === 'per_group'
      ? t('host.activities.pricePerGroup', { amount })
      : t('host.activities.pricePerPerson', { amount });
  };

  if (propsLoading || loading) {
    return (
      <div className="flex items-center gap-3 text-gray-400 py-16 justify-center">
        <span className="w-5 h-5 flex items-center justify-center animate-spin"><i className="ri-loader-4-line text-xl"></i></span>
        <span className="text-sm">{t('host.activities.loading')}</span>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-home-2-line text-2xl text-gray-400"></i>
        </div>
        <h3 className="text-base font-semibold text-gray-800 mb-1">{t('host.activities.noProperties')}</h3>
        <p className="text-sm text-gray-400">{t('host.activities.noPropertiesSub')}</p>
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

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('host.activities.title')}</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">{t('host.activities.sub')}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          {t('host.activities.addActivity')}
        </button>
      </div>

      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
          <i className="ri-database-2-line mt-0.5 flex-shrink-0"></i>
          <span>{t('host.activities.tableNotReady')}</span>
        </div>
      )}

      {/* Guests arrange these with the host — say so, so nobody expects a booking flow. */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
        <i className="ri-information-line mt-0.5 flex-shrink-0"></i>
        <span>{t('host.activities.notBookableNote')}</span>
      </div>

      {properties.length > 1 && (
        <select
          value={filterPropertyId}
          onChange={(e) => setFilterPropertyId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white cursor-pointer"
        >
          <option value="all">{t('host.activities.filterAll')}</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      )}

      {visible.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✨</div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">{t('host.activities.empty')}</h3>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">{t('host.activities.emptySub')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((a) => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
              {a.image_url && (
                <div
                  className="h-32 bg-gray-100"
                  style={{ backgroundImage: `url('${a.image_url}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
              )}
              <div className="p-5 flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl leading-none flex-shrink-0" aria-hidden="true">{CATEGORY_EMOJI[a.category]}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{a.title}</p>
                      <p className="text-xs text-gray-400 truncate">{propertyTitle(a.property_id)}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-1 rounded-full border ${
                    a.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    {a.active ? t('host.activities.statusActive') : t('host.activities.statusHidden')}
                  </span>
                </div>

                {a.description && <p className="text-xs text-gray-500 line-clamp-2">{a.description}</p>}

                <p className="text-xs text-gray-600 font-semibold flex items-center gap-2 flex-wrap">
                  <span>{priceLabel(a)}</span>
                  {formatDuration(a.duration_minutes) && (
                    <span className="text-gray-400 font-normal flex items-center gap-1">
                      <i className="ri-time-line"></i>{formatDuration(a.duration_minutes)}
                    </span>
                  )}
                </p>

                <div className="flex items-center gap-2 pt-1 mt-auto border-t border-gray-100">
                  <button
                    onClick={() => openEdit(a)}
                    className="flex-1 mt-2 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="ri-edit-line mr-1"></i>{t('host.activities.edit')}
                  </button>
                  <button
                    onClick={() => toggleActive(a)}
                    className="mt-2 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {a.active ? t('host.activities.hide') : t('host.activities.show')}
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    aria-label={t('host.activities.delete')}
                    className="mt-2 px-3 py-2 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      {form && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                {form.id ? t('host.activities.edit') : t('host.activities.addActivity')}
              </h3>
              <button onClick={() => setForm(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500 text-lg"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.activities.fieldProperty')}</label>
                <select
                  value={form.property_id}
                  onChange={(e) => setForm({ ...form, property_id: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm cursor-pointer"
                >
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.activities.fieldCategory')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map((c) => {
                    const on = form.category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, category: c })}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                          on ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xl leading-none" aria-hidden="true">{CATEGORY_EMOJI[c]}</span>
                        <span className={`text-[10.5px] font-semibold leading-tight text-center ${on ? 'text-red-600' : 'text-gray-500'}`}>
                          {t(`host.activities.cat_${c}`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.activities.fieldTitle')}</label>
                <input
                  type="text"
                  value={form.title}
                  placeholder={t('host.activities.fieldTitlePlaceholder')}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.activities.fieldDescription')}</label>
                <textarea
                  rows={3}
                  value={form.description}
                  placeholder={t('host.activities.fieldDescriptionPlaceholder')}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.activities.fieldPricing')}</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {PRICE_UNITS.map((u) => {
                    const on = form.price_unit === u;
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => { setForm({ ...form, price_unit: u }); setFormError(''); }}
                        className={`px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all cursor-pointer ${
                          on ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {t(`host.activities.unit_${u}`)}
                      </button>
                    );
                  })}
                </div>
                {unitHasPrice(form.price_unit) && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₾</span>
                    <input
                      type="text" inputMode="decimal"
                      value={form.price}
                      placeholder="0"
                      onChange={(e) => setForm({ ...form, price: numericDraft(e.target.value, true) })}
                      className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.activities.fieldDuration')}</label>
                <div className="relative">
                  <input
                    type="text" inputMode="numeric"
                    value={form.duration_minutes}
                    placeholder={t('host.activities.fieldDurationPlaceholder')}
                    onChange={(e) => setForm({ ...form, duration_minutes: numericDraft(e.target.value, false) })}
                    className="w-full px-3 py-2.5 pr-16 border border-gray-200 rounded-lg text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    {t('host.activities.minutes')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('host.activities.fieldPhoto')}</label>
                {form.image_url ? (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200">
                    <img src={form.image_url} alt="" className="w-full h-36 object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, image_url: '' })}
                      className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-white/90 hover:bg-white rounded-full cursor-pointer"
                      aria-label={t('host.activities.removePhoto')}
                    >
                      <i className="ri-delete-bin-line text-red-500"></i>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-red-400 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {uploading
                      ? <><i className="ri-loader-4-line animate-spin mr-1"></i>{t('host.activities.uploading')}</>
                      : <><i className="ri-image-add-line mr-1"></i>{t('host.activities.addPhoto')}</>}
                  </button>
                )}
                <input
                  ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox" checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 accent-red-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">{t('host.activities.fieldActive')}</span>
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
                {t('host.activities.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {saving ? t('host.activities.saving') : t('host.activities.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
