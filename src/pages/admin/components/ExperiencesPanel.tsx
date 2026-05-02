import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

export interface Experience {
  id: string;
  title: string;
  description: string;
  price_per_person: number;
  currency_symbol: string;
  image_url: string | null;
  status: 'active' | 'coming_soon' | 'archived';
  display_order: number;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'experience-photos';

function statusBadge(status: Experience['status']) {
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'coming_soon') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-500';
}

function formatStatus(status: Experience['status']) {
  if (status === 'coming_soon') return 'Coming Soon';
  if (status === 'archived') return 'Archived';
  return 'Active';
}

interface FormState {
  title: string;
  description: string;
  price: string;
  status: Experience['status'];
  display_order: string;
  image_url: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  price: '',
  status: 'active',
  display_order: '0',
  image_url: '',
};

interface EditorProps {
  initial: Experience | null;
  onClose: () => void;
  onSaved: () => void;
}

function ExperienceEditor({ initial, onClose, onSaved }: EditorProps) {
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          title: initial.title,
          description: initial.description,
          price: String(initial.price_per_person),
          status: initial.status,
          display_order: String(initial.display_order),
          image_url: initial.image_url ?? '',
        }
      : EMPTY_FORM,
  );
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(initial?.image_url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const uploadIfNeeded = async (): Promise<string> => {
    if (!file) return form.image_url;
    const safe = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
    const path = `${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required.');
      return;
    }
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError('Price must be a non-negative number.');
      return;
    }
    const orderNum = Number.parseInt(form.display_order, 10);

    setSaving(true);
    try {
      const imageUrl = await uploadIfNeeded();
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        price_per_person: priceNum,
        status: form.status,
        display_order: Number.isFinite(orderNum) ? orderNum : 0,
        image_url: imageUrl || null,
      };
      const { error: dbErr } = initial
        ? await supabase.from('experiences').update(payload).eq('id', initial.id)
        : await supabase.from('experiences').insert(payload);
      if (dbErr) throw dbErr;
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save.';
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
            {initial ? 'Edit Experience' : 'Add Experience'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Traditional Cooking Class"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={4}
              placeholder="What guests will experience…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price per person (₾)
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value as Experience['status'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <option value="active">Active</option>
                <option value="coming_soon">Coming Soon</option>
                <option value="archived">Archived (hidden)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display order
              <span className="text-xs font-normal text-gray-400 ml-1">(lower = shown first)</span>
            </label>
            <input
              type="number"
              value={form.display_order}
              onChange={(e) => update('display_order', e.target.value)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
            <div className="flex items-start gap-4">
              <div className="w-32 h-24 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center text-gray-400">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <i className="ri-image-line text-2xl"></i>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block text-sm text-gray-600"
                />
                <input
                  type="text"
                  value={form.image_url}
                  onChange={(e) => {
                    update('image_url', e.target.value);
                    if (!file) setPreviewUrl(e.target.value);
                  }}
                  placeholder="…or paste an image URL"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <p className="text-xs text-gray-400">
                  Upload a photo or paste a URL. JPG/PNG, up to a few MB.
                </p>
              </div>
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
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add experience'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExperiencesPanel() {
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
    if (!confirm(`Delete "${exp.title}"? This cannot be undone.`)) return;
    setDeleting(exp.id);
    const { error: dbErr } = await supabase.from('experiences').delete().eq('id', exp.id);
    setDeleting(null);
    if (dbErr) {
      alert(`Failed to delete: ${dbErr.message}`);
      return;
    }
    void load();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <i className="ri-goblet-line text-purple-600 text-sm"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Experiences</h2>
            <p className="text-xs text-gray-400">Manage homepage experience cards</p>
          </div>
        </div>
        <button
          onClick={() => setEditorFor('new')}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          Add experience
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400 gap-3">
          <i className="ri-loader-4-line animate-spin"></i> Loading experiences…
        </div>
      ) : error ? (
        <div className="px-6 py-8 text-sm text-red-600 bg-red-50">{error}</div>
      ) : items.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-gray-400">
          No experiences yet. Click <b>Add experience</b> to create one.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-6 py-3 font-medium">Order</th>
              <th className="text-left px-6 py-3 font-medium">Image</th>
              <th className="text-left px-6 py-3 font-medium">Title</th>
              <th className="text-left px-6 py-3 font-medium">Price</th>
              <th className="text-left px-6 py-3 font-medium">Status</th>
              <th className="text-right px-6 py-3 font-medium">Actions</th>
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
                  <span className="text-xs font-normal text-gray-400"> / person</span>
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(exp.status)}`}
                  >
                    {formatStatus(exp.status)}
                  </span>
                </td>
                <td className="px-6 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setEditorFor(exp)}
                    className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(exp)}
                    disabled={deleting === exp.id}
                    className="px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 rounded-md cursor-pointer disabled:opacity-50"
                  >
                    {deleting === exp.id ? 'Deleting…' : 'Delete'}
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
