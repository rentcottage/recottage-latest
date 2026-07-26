import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../../i18n';

type TFunc = (key: string, vars?: Record<string, string | number>) => string;

export interface Experience {
  id: string;
  title: string;
  description: string;
  price_per_person: number;
  currency_symbol: string;
  image_url: string | null;
  gallery_urls: string[] | null;
  status: 'active' | 'coming_soon' | 'archived';
  display_order: number;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'experience-photos';
const MAX_IMAGES = 10;
// experiences writes are RLS-locked; admins write through the password-gated function.
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

type ImageEntry = {
  // existing/pasted URL — empty string if entry is a pending file upload
  url: string;
  // pending upload (set when user picks a file from disk)
  file?: File;
  // what the <img> tag shows (object URL for files, the URL itself otherwise)
  preview: string;
  // stable key for React lists
  key: string;
};

function statusBadge(status: Experience['status']) {
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'coming_soon') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-500';
}

function formatStatus(status: Experience['status'], t: TFunc) {
  if (status === 'coming_soon') return t('admin.experiences.statusComingSoon');
  if (status === 'archived') return t('admin.experiences.statusArchivedHidden');
  return t('admin.experiences.statusActive');
}

interface FormState {
  title: string;
  description: string;
  price: string;
  status: Experience['status'];
  display_order: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  price: '',
  status: 'active',
  display_order: '0',
};

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildInitialImages = (initial: Experience | null): ImageEntry[] => {
  if (!initial) return [];
  const urls: string[] = [];
  if (initial.image_url) urls.push(initial.image_url);
  if (initial.gallery_urls?.length) urls.push(...initial.gallery_urls);
  return urls.map((url) => ({ url, preview: url, key: newKey() }));
};

interface EditorProps {
  initial: Experience | null;
  onClose: () => void;
  onSaved: () => void;
}

function ExperienceEditor({ initial, onClose, onSaved }: EditorProps) {
  const { t, plural } = useT();
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          title: initial.title,
          description: initial.description,
          price: String(initial.price_per_person),
          status: initial.status,
          display_order: String(initial.display_order),
        }
      : EMPTY_FORM,
  );
  const [images, setImages] = useState<ImageEntry[]>(() => buildInitialImages(initial));
  const [pasteUrl, setPasteUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Revoke object URLs we created for pending file uploads when the entry leaves the list.
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.file && img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const remainingSlots = MAX_IMAGES - images.length;

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // When selecting a folder the browser includes every file in it, not just images,
    // so filter by MIME type (and accept the common image extensions as a fallback).
    const onlyImages = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(f.name),
    );
    const incoming = onlyImages.slice(0, remainingSlots);
    const next: ImageEntry[] = incoming.map((file) => ({
      url: '',
      file,
      preview: URL.createObjectURL(file),
      key: newKey(),
    }));
    setImages((prev) => [...prev, ...next]);
  };

  const addPastedUrl = () => {
    const url = pasteUrl.trim();
    if (!url) return;
    if (images.length >= MAX_IMAGES) return;
    setImages((prev) => [...prev, { url, preview: url, key: newKey() }]);
    setPasteUrl('');
  };

  const removeImage = (key: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target?.file && target.preview.startsWith('blob:')) URL.revokeObjectURL(target.preview);
      return prev.filter((i) => i.key !== key);
    });
  };

  const moveImage = (key: string, dir: -1 | 1) => {
    setImages((prev) => {
      const idx = prev.findIndex((i) => i.key === key);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const uploadEntry = async (entry: ImageEntry): Promise<string> => {
    if (!entry.file) return entry.url;
    const safe = entry.file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, entry.file, { contentType: entry.file.type, upsert: false });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) {
      setError(t('admin.experiences.titleRequiredError'));
      return;
    }
    if (!form.description.trim()) {
      setError(t('admin.experiences.descriptionRequiredError'));
      return;
    }
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError(t('admin.experiences.priceNonNegativeError'));
      return;
    }
    const orderNum = Number.parseInt(form.display_order, 10);

    setSaving(true);
    try {
      const uploaded = await Promise.all(images.map(uploadEntry));
      const [cover, ...rest] = uploaded;
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        price_per_person: priceNum,
        status: form.status,
        display_order: Number.isFinite(orderNum) ? orderNum : 0,
        image_url: cover ?? null,
        gallery_urls: rest,
      };
      const res = await adminPost({ action: 'save-experience', experience: payload, experienceId: initial?.id });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || t('admin.experiences.failedToSaveError'));
      onSaved();
      onClose();
    } catch (e: unknown) {
      // Supabase errors are plain objects, not Error instances, so handle both.
      let msg = t('admin.experiences.failedToSaveError');
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
            {initial ? t('admin.experiences.editExperience') : t('admin.experiences.addExperience')}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label={t('admin.experiences.close')}
          >
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.experiences.titleLabel')}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={t('admin.experiences.titlePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.experiences.descriptionLabel')}</label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={4}
              placeholder={t('admin.experiences.descriptionPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.experiences.pricePerPersonLabel')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="45"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.experiences.statusLabel')}</label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value as Experience['status'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <option value="active">{t('admin.experiences.statusActive')}</option>
                <option value="coming_soon">{t('admin.experiences.statusComingSoon')}</option>
                <option value="archived">{t('admin.experiences.statusArchivedHidden')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.experiences.displayOrderLabel')}
              <span className="text-xs font-normal text-gray-400 ml-1">{t('admin.experiences.displayOrderHint')}</span>
            </label>
            <input
              type="number"
              value={form.display_order}
              onChange={(e) => update('display_order', e.target.value)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                {t('admin.experiences.photosLabel')}
                <span className="text-xs font-normal text-gray-400 ml-1">
                  {t('admin.experiences.photosHint', { max: MAX_IMAGES })}
                </span>
              </label>
              <span className="text-xs text-gray-400">
                {t('admin.experiences.photosCount', { count: images.length, max: MAX_IMAGES })}
              </span>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
                {images.map((img, idx) => (
                  <div
                    key={img.key}
                    className="relative group rounded-lg overflow-hidden border border-line bg-gray-50 aspect-[4/3]"
                  >
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                        {t('admin.experiences.cover')}
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveImage(img.key, -1)}
                          disabled={idx === 0}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white/90 text-gray-700 text-xs disabled:opacity-30"
                          aria-label={t('admin.experiences.moveLeft')}
                        >
                          <i className="ri-arrow-left-s-line"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(img.key, 1)}
                          disabled={idx === images.length - 1}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white/90 text-gray-700 text-xs disabled:opacity-30"
                          aria-label={t('admin.experiences.moveRight')}
                        >
                          <i className="ri-arrow-right-s-line"></i>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(img.key)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-white/90 text-red-600 text-xs"
                        aria-label={t('admin.experiences.remove')}
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <label
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
                    remainingSlots <= 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  <i className="ri-image-add-line"></i>
                  {t('admin.experiences.chooseFiles')}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={remainingSlots <= 0}
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pasteUrl}
                  onChange={(e) => setPasteUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPastedUrl();
                    }
                  }}
                  placeholder={t('admin.experiences.pasteUrlPlaceholder')}
                  disabled={remainingSlots <= 0}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={addPastedUrl}
                  disabled={!pasteUrl.trim() || remainingSlots <= 0}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  {t('admin.experiences.addUrl')}
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {remainingSlots > 0
                  ? plural('admin.experiences.uploadMorePhotosHintCount', remainingSlots)
                  : t('admin.experiences.maxPhotosReachedHint', { max: MAX_IMAGES })}
              </p>
            </div>
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
            {t('admin.experiences.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? t('admin.experiences.savingEllipsis') : initial ? t('admin.experiences.saveChanges') : t('admin.experiences.addExperienceBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExperiencesPanel() {
  const { t } = useT();
  const [items, setItems] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorFor, setEditorFor] = useState<Experience | null | 'new'>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: dbErr } = await supabase
      .from('experiences')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (dbErr) {
      setError(dbErr.message);
      setItems([]);
    } else {
      setItems((data ?? []) as Experience[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (exp: Experience) => {
    if (!confirm(t('admin.experiences.deleteConfirm', { title: exp.title }))) return;
    setDeleting(exp.id);
    const res = await adminPost({ action: 'delete-experience', experienceId: exp.id });
    setDeleting(null);
    if (!res.ok) {
      const msg = ((await res.json().catch(() => ({}))) as { error?: string }).error || t('admin.experiences.unknownError');
      alert(t('admin.experiences.deleteFailedAlert', { message: msg }));
      return;
    }
    void load();
  };

  return (
    <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <i className="ri-goblet-line text-purple-600 text-sm"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{t('admin.experiences.title')}</h2>
            <p className="text-xs text-gray-400">{t('admin.experiences.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setEditorFor('new')}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          {t('admin.experiences.addExperienceBtn')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400 gap-3">
          <i className="ri-loader-4-line animate-spin"></i> {t('admin.experiences.loadingExperiences')}
        </div>
      ) : error ? (
        <div className="px-6 py-8 text-sm text-red-600 bg-red-50">{error}</div>
      ) : items.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-gray-400">
          {t('admin.experiences.noExperiencesYet', { addExperience: t('admin.experiences.addExperienceHeader') })}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-6 py-3 font-medium">{t('admin.experiences.colOrder')}</th>
              <th className="text-left px-6 py-3 font-medium">{t('admin.experiences.colImage')}</th>
              <th className="text-left px-6 py-3 font-medium">{t('admin.experiences.colTitle')}</th>
              <th className="text-left px-6 py-3 font-medium">{t('admin.experiences.colPrice')}</th>
              <th className="text-left px-6 py-3 font-medium">{t('admin.experiences.colStatus')}</th>
              <th className="text-right px-6 py-3 font-medium">{t('admin.experiences.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((exp) => (
              <tr key={exp.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-500 font-mono">{exp.display_order}</td>
                <td className="px-6 py-3">
                  {exp.image_url ? (
                    <img
                      src={exp.image_url}
                      alt={exp.title}
                      className="w-16 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                      <i className="ri-image-line"></i>
                    </div>
                  )}
                </td>
                <td className="px-6 py-3">
                  <div className="font-medium text-gray-900 line-clamp-1 max-w-xs">{exp.title}</div>
                  <div className="text-xs text-gray-500 line-clamp-1 max-w-xs">{exp.description}</div>
                </td>
                <td className="px-6 py-3 font-semibold text-gray-900">
                  {exp.currency_symbol || '₾'}
                  {Number(exp.price_per_person).toFixed(0)}
                  <span className="text-xs font-normal text-gray-400"> {t('admin.experiences.perPerson')}</span>
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(exp.status)}`}
                  >
                    {formatStatus(exp.status, t)}
                  </span>
                </td>
                <td className="px-6 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setEditorFor(exp)}
                    className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
                  >
                    {t('admin.experiences.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(exp)}
                    disabled={deleting === exp.id}
                    className="px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded-md cursor-pointer disabled:opacity-50"
                  >
                    {deleting === exp.id ? t('admin.experiences.deletingEllipsis') : t('admin.experiences.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editorFor !== null && (
        <ExperienceEditor
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
