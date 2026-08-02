import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../i18n';
import { compressImage } from '../../../lib/imageCompression';

type CoverPosition = 'top' | 'center' | 'bottom';

interface Props {
  applicationId: string;
  /** Current stored state — the manager edits a local copy until Save. */
  photoUrls: string[];
  coverPhotoUrl?: string | null;
  coverPhotoPosition?: CoverPosition | null;
  /** POST helper supplied by the parent so the admin password stays in one place. */
  callAdmin: (body: Record<string, unknown>) => Promise<{ ok: boolean; data: Record<string, unknown> }>;
  /** Called after a successful save so the parent can refresh its row. */
  onSaved: (next: { photo_urls: string[]; cover_photo_url: string; cover_photo_position: CoverPosition }) => void;
  onToast: (msg: string, kind: 'success' | 'error') => void;
}

/**
 * Admin-side photo editor for one application.
 *
 * Uploads go straight to Storage through a single-use signed URL minted by the
 * edge function — the service-role key never reaches the browser. Files are put
 * through the same `compressImage` the public become-host form uses, so admin
 * uploads are byte-for-byte consistent with host uploads (WebP, 2560px, q0.85).
 *
 * Removing a photo drops it from the list only; the bucket object is left in
 * place. Deleting objects is a separate, deliberate cleanup job — an object may
 * still be referenced by another record.
 */
export default function PhotoManager({
  applicationId,
  photoUrls,
  coverPhotoUrl,
  coverPhotoPosition,
  callAdmin,
  onSaved,
  onToast,
}: Props) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [urls, setUrls] = useState<string[]>(photoUrls);
  const [cover, setCover] = useState<string>(coverPhotoUrl || photoUrls[0] || '');
  const [position, setPosition] = useState<CoverPosition>(coverPhotoPosition || 'center');
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-sync when the admin selects a different application.
  useEffect(() => {
    setUrls(photoUrls);
    setCover(coverPhotoUrl || photoUrls[0] || '');
    setPosition(coverPhotoPosition || 'center');
  }, [applicationId, photoUrls, coverPhotoUrl, coverPhotoPosition]);

  const dirty = useMemo(() => {
    const sameList =
      urls.length === photoUrls.length && urls.every((u, i) => u === photoUrls[i]);
    return !sameList
      || cover !== (coverPhotoUrl || photoUrls[0] || '')
      || position !== (coverPhotoPosition || 'center');
  }, [urls, cover, position, photoUrls, coverPhotoUrl, coverPhotoPosition]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= urls.length) return;
    const next = [...urls];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setUrls(next);
  };

  const remove = (url: string) => {
    const next = urls.filter((u) => u !== url);
    setUrls(next);
    if (cover === url) setCover(next[0] ?? '');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBusy(t('admin.hostApplications.photoUploading', { name: file.name, n: i + 1, total: files.length }));
      try {
        // Identical treatment to the public host form.
        const compressed = await compressImage(file);

        const slot = await callAdmin({
          action: 'create-photo-upload-url',
          applicationId,
          filename: compressed.name.replace(/\.[^.]+$/, '') + '.webp',
        });
        if (!slot.ok || !slot.data.signedUrl) throw new Error(String(slot.data.error ?? 'no upload URL'));

        const put = await fetch(slot.data.signedUrl as string, {
          method: 'PUT',
          headers: { 'Content-Type': compressed.type || 'image/webp' },
          body: compressed,
        });
        if (!put.ok) throw new Error(`storage ${put.status}`);

        added.push(slot.data.publicUrl as string);
      } catch (err) {
        // Surfaced, not silently skipped — the public form's silent `continue`
        // is how applications end up with an empty photo array.
        console.error('[PhotoManager] upload failed:', file.name, err);
        failed.push(file.name);
      }
    }

    setBusy(null);
    if (added.length) {
      setUrls((prev) => {
        const next = [...prev, ...added];
        if (!cover) setCover(next[0]);
        return next;
      });
    }
    if (failed.length) {
      onToast(t('admin.hostApplications.photoUploadFailed', { names: failed.join(', ') }), 'error');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    setSaving(true);
    const res = await callAdmin({
      action: 'update-photos',
      applicationId,
      photoUrls: urls,
      coverPhotoUrl: cover,
      coverPhotoPosition: position,
    });
    setSaving(false);
    if (res.ok && res.data.success) {
      onToast(t('admin.hostApplications.photosSavedToast'), 'success');
      onSaved({ photo_urls: urls, cover_photo_url: cover, cover_photo_position: position });
    } else {
      onToast(String(res.data.error ?? t('admin.hostApplications.photosSaveFailed')), 'error');
    }
  };

  const objectClass =
    position === 'top' ? 'object-top' : position === 'bottom' ? 'object-bottom' : 'object-center';

  return (
    <div className="border border-line rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {t('admin.hostApplications.managePhotos')} ({urls.length})
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="text-xs font-bold border-[1.5px] border-line rounded-lg px-3 py-1.5 hover:border-red-500 hover:text-red-500 disabled:opacity-50 cursor-pointer"
          >
            {t('admin.hostApplications.addPhotos')}
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving || !urls.length}
            className="text-xs font-bold bg-red-500 text-white rounded-lg px-3 py-1.5 hover:bg-red-600 disabled:opacity-40 cursor-pointer"
          >
            {saving ? t('admin.hostApplications.savingPhotos') : t('admin.hostApplications.savePhotos')}
          </button>
        </div>
      </div>

      {busy && <p className="text-xs text-gray-500 mb-2">{busy}</p>}

      {/* Cover crop preview — 16/11, the same ratio the listing card uses. */}
      {cover && (
        <div className="mb-3">
          <p className="text-[11px] text-gray-500 mb-1">{t('admin.hostApplications.cardPreview')}</p>
          <div className="w-72 rounded-xl overflow-hidden bg-gray-100" style={{ aspectRatio: '16/11' }}>
            <img src={cover} alt="" className={`w-full h-full object-cover ${objectClass}`} />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {(['top', 'center', 'bottom'] as CoverPosition[]).map((p) => (
              <button
                key={p}
                onClick={() => setPosition(p)}
                className={`text-[11px] font-bold rounded-md px-2 py-1 border cursor-pointer ${
                  position === p ? 'bg-ink text-white border-ink' : 'border-line text-gray-600 hover:border-gray-400'
                }`}
              >
                {t(`admin.hostApplications.crop_${p}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {urls.length === 0 ? (
        <p className="text-xs text-gray-400">{t('admin.hostApplications.noPhotosYet')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div key={url} className="relative w-24">
              <div
                className={`w-24 h-24 rounded-lg overflow-hidden border-2 ${
                  cover === url ? 'border-red-500' : 'border-transparent'
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => remove(url)}
                title={t('admin.hostApplications.removePhoto')}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-line text-gray-600 text-[11px] leading-none hover:text-red-500 cursor-pointer"
              >
                ✕
              </button>
              <div className="flex items-center justify-between mt-1">
                <button
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="text-[11px] px-1 disabled:opacity-30 cursor-pointer hover:text-red-500"
                >
                  ◀
                </button>
                <button
                  onClick={() => setCover(url)}
                  className={`text-[10px] font-bold cursor-pointer ${
                    cover === url ? 'text-red-500' : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {cover === url ? t('admin.hostApplications.isCover') : t('admin.hostApplications.setCover')}
                </button>
                <button
                  onClick={() => move(i, i + 1)}
                  disabled={i === urls.length - 1}
                  className="text-[11px] px-1 disabled:opacity-30 cursor-pointer hover:text-red-500"
                >
                  ▶
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
