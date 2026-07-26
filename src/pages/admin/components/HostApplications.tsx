import { useState, useEffect, useCallback } from 'react';
import { useT } from '../../../i18n';

type TFunc = (key: string, vars?: Record<string, string | number>) => string;

interface HostApplication {
  id: string;
  host_first_name: string;
  host_last_name: string;
  host_email: string;
  host_phone: string | null;
  property_type: string;
  location: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  amenities: string[];
  photo_urls: string[];
  title: string;
  description: string;
  price_per_night: number;
  status: string;
  created_at: string;
  google_maps_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  rejection_note?: string | null;
  agreement_reminder_sent_at?: string | null;
  agreement_status?: string | null;
  agreement_received_at?: string | null;
}

type AgreementStatus = 'not_sent' | 'pending' | 'received';

const ADMIN_HOST_ACTIONS_URL =
  `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-host-actions`;

const RESEND_APPROVAL_EMAIL_URL =
  `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/resend-approval-email`;

const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

type FilterTab = 'pending' | 'all' | 'approved' | 'hidden' | 'rejected';

const HOST_APP_STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'admin.hostApplications.statusPending',
  approved: 'admin.hostApplications.statusApproved',
  hidden: 'admin.hostApplications.statusHidden',
  rejected: 'admin.hostApplications.statusRejected',
};

interface Props {
  onPendingCountChange?: (count: number) => void;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
    hidden: 'bg-gray-200 text-gray-500',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function statusIcon(status: string) {
  if (status === 'approved') return 'ri-checkbox-circle-line';
  if (status === 'rejected') return 'ri-close-circle-line';
  if (status === 'hidden') return 'ri-eye-off-line';
  return 'ri-time-line';
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatCreated(str: string) {
  return new Date(str).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Agreement Status Badge ──────────────────────────────────────────────────
function agreementStatusConfig(status: string | null | undefined, t: TFunc) {
  const s = status ?? 'not_sent';
  if (s === 'received') return {
    label: t('admin.hostApplications.agreementReceived'),
    shortLabel: t('admin.hostApplications.shortReceived'),
    icon: 'ri-file-check-line',
    badge: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
  };
  if (s === 'pending') return {
    label: t('admin.hostApplications.agreementSentByHost'),
    shortLabel: t('admin.hostApplications.shortSentByHost'),
    icon: 'ri-file-transfer-line',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  };
  return {
    label: t('admin.hostApplications.agreementNotSent'),
    shortLabel: t('admin.hostApplications.shortNotSent'),
    icon: 'ri-file-unknow-line',
    badge: 'bg-gray-100 text-gray-500',
    dot: 'bg-gray-400',
  };
}

// ─── Agreement Status Dropdown ───────────────────────────────────────────────
interface AgreementStatusDropdownProps {
  app: HostApplication;
  onUpdate: (id: string, status: AgreementStatus) => void;
  loading: boolean;
}

function AgreementStatusDropdown({ app, onUpdate, loading }: AgreementStatusDropdownProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const current = agreementStatusConfig(app.agreement_status, t);

  const options: { value: AgreementStatus; label: string; icon: string; color: string }[] = [
    { value: 'not_sent', label: t('admin.hostApplications.agreementNotSent'), icon: 'ri-file-unknow-line', color: 'text-gray-600' },
    { value: 'pending', label: t('admin.hostApplications.agreementSentByHost'), icon: 'ri-file-transfer-line', color: 'text-amber-600' },
    { value: 'received', label: t('admin.hostApplications.agreementReceived'), icon: 'ri-file-check-line', color: 'text-green-600' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-all ${current.badge} hover:opacity-80`}
        title={t('admin.hostApplications.clickToChangeAgreement')}
      >
        <div className="w-3 h-3 flex items-center justify-center">
          <i className={current.icon}></i>
        </div>
        {current.shortLabel}
        <div className="w-3 h-3 flex items-center justify-center">
          <i className="ri-arrow-down-s-line"></i>
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-[56] bg-white border border-line rounded-xl shadow-lg w-52 py-1 overflow-hidden">
            {options.map((opt) => {
              const isActive = (app.agreement_status ?? 'not_sent') === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setOpen(false);
                    if (!isActive) onUpdate(app.id, opt.value);
                  }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm cursor-pointer whitespace-nowrap transition-colors text-left ${
                    isActive ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-4 h-4 flex items-center justify-center ${opt.color}`}>
                    <i className={opt.icon}></i>
                  </div>
                  <span className={opt.color}>{opt.label}</span>
                  {isActive && (
                    <div className="ml-auto w-3 h-3 flex items-center justify-center text-green-500">
                      <i className="ri-check-line"></i>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Reject Note Modal ───────────────────────────────────────────────────────
interface RejectNoteModalProps {
  app: HostApplication;
  onConfirm: (note: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function getQuickReasons(t: TFunc): string[] {
  return [
    t('admin.hostApplications.quickReason1'),
    t('admin.hostApplications.quickReason2'),
    t('admin.hostApplications.quickReason3'),
    t('admin.hostApplications.quickReason4'),
    t('admin.hostApplications.quickReason5'),
  ];
}

function RejectNoteModal({ app, onConfirm, onCancel, loading }: RejectNoteModalProps) {
  const { t } = useT();
  const [note, setNote] = useState('');
  const quickReasons = getQuickReasons(t);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[520px] max-w-[90vw] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-full flex-shrink-0">
            <i className="ri-close-circle-line text-red-500 text-lg"></i>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">{t('admin.hostApplications.rejectApplicationTitle')}</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[340px] notranslate" translate="no">&ldquo;{app.title}&rdquo;</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('admin.hostApplications.quickReasons')}</p>
          <div className="flex flex-wrap gap-2">
            {quickReasons.map((r) => (
              <button
                key={r}
                onClick={() => setNote(r)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer whitespace-nowrap ${
                  note === r
                    ? 'bg-red-50 border-red-300 text-red-700 font-semibold'
                    : 'border-line text-gray-600 hover:border-red-200 hover:text-red-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
            {t('admin.hostApplications.rejectionNoteLabel')} <span className="text-gray-400 font-normal normal-case">{t('admin.hostApplications.rejectionNoteOptional')}</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('admin.hostApplications.rejectionNotePlaceholder')}
            rows={4}
            maxLength={500}
            className="w-full text-sm border border-line rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none text-gray-700 placeholder-gray-400"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{note.length}/500</p>
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-5">
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="ri-information-line text-amber-500 text-sm"></i>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed">
            {t('admin.hostApplications.rejectionNoteInfo')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 border border-line hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
          >
            {t('admin.hostApplications.cancel')}
          </button>
          <button
            onClick={() => onConfirm(note.trim())}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
          >
            {loading ? (
              <div className="w-4 h-4 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line"></i>
              </div>
            ) : (
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-close-circle-line"></i>
              </div>
            )}
            {t('admin.hostApplications.confirmRejection')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ────────────────────────────────────────────────────
interface ConfirmDeleteModalProps {
  app: HostApplication;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmDeleteModal({ app, onConfirm, onCancel, loading }: ConfirmDeleteModalProps) {
  const { t } = useT();
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[440px] max-w-[90vw] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-full flex-shrink-0">
            <i className="ri-delete-bin-line text-red-500 text-lg"></i>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">{t('admin.hostApplications.removePermanentlyTitle')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{t('admin.hostApplications.actionCannotBeUndone')}</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
          <p className="text-sm text-gray-700 leading-relaxed">
            {t('admin.hostApplications.deleteConfirmBody', { title: app.title })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 border border-line hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
          >
            {t('admin.hostApplications.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
          >
            {loading ? (
              <div className="w-4 h-4 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line"></i>
              </div>
            ) : (
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-delete-bin-line"></i>
              </div>
            )}
            {t('admin.hostApplications.yesDeletePermanently')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
interface DetailModalProps {
  app: HostApplication;
  onClose: () => void;
  onApprove: (id: string) => void;
  onRejectRequest: (app: HostApplication) => void;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onDeleteRequest: (app: HostApplication) => void;
  onSendAgreementReminder: (id: string) => void;
  onUpdateAgreementStatus: (id: string, status: AgreementStatus) => void;
  onResendApprovalEmail: (id: string) => void;
  actionLoading: string | null;
}

function DetailModal({
  app, onClose, onApprove, onRejectRequest, onHide, onUnhide, onDeleteRequest,
  onSendAgreementReminder, onUpdateAgreementStatus, onResendApprovalEmail, actionLoading,
}: DetailModalProps) {
  const { t } = useT();
  const [activePhoto, setActivePhoto] = useState<string | null>(
    app.photo_urls.length > 0 ? app.photo_urls[0] : null
  );
  const hostName = `${app.host_first_name} ${app.host_last_name}`;
  const agConfig = agreementStatusConfig(app.agreement_status, t);

  const hasLocation = app.google_maps_url || app.latitude != null || app.longitude != null || app.address;
  const mapViewUrl = app.google_maps_url || (app.latitude != null && app.longitude != null ? `https://www.google.com/maps?q=${app.latitude},${app.longitude}` : null);
  const mapEmbedSrc = (app.latitude != null && app.longitude != null) ? `https://maps.google.com/maps?q=${app.latitude},${app.longitude}&z=15&output=embed` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[680px] max-w-full h-screen bg-white overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 notranslate" translate="no">{app.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('admin.hostApplications.idPrefix', { id: app.id.slice(0, 8) })}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge(app.status)}`}>
              <i className={`${statusIcon(app.status)} text-xs`}></i>
              {t(HOST_APP_STATUS_LABEL_KEY[app.status] ?? app.status)}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Application ID */}
          <div className="bg-gray-50 rounded-lg px-4 py-2.5">
            <p className="text-xs text-gray-500">
              <span className="font-semibold">{t('admin.hostApplications.applicationIdLabel')}</span>{' '}
              <span className="font-mono text-gray-700">{app.id}</span>
            </p>
          </div>

          {/* Agreement Status Panel — shown for approved/hidden */}
          {(app.status === 'approved' || app.status === 'hidden') && (
            <div className="border border-line rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-file-text-line text-gray-500 text-sm"></i>
                  </div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('admin.hostApplications.agreementStatusTitle')}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${agConfig.badge}`}>
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className={agConfig.icon}></i>
                  </div>
                  {agConfig.label}
                </span>
              </div>
              <div className="px-4 py-4 space-y-3">
                {app.agreement_received_at && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-calendar-check-line"></i>
                    </div>
                    {t('admin.hostApplications.agreementReceivedOn', { date: formatCreated(app.agreement_received_at) })}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-gray-500 font-medium">{t('admin.hostApplications.updateStatusLabel')}</p>
                  {(['not_sent', 'pending', 'received'] as AgreementStatus[]).map((s) => {
                    const cfg = agreementStatusConfig(s, t);
                    const isActive = (app.agreement_status ?? 'not_sent') === s;
                    return (
                      <button
                        key={s}
                        onClick={() => !isActive && onUpdateAgreementStatus(app.id, s)}
                        disabled={isActive || !!actionLoading}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all border ${
                          isActive
                            ? `${cfg.badge} border-transparent opacity-100 cursor-default`
                            : 'border-line text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50'
                        }`}
                      >
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className={cfg.icon}></i>
                        </div>
                        {cfg.shortLabel}
                        {isActive && (
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className="ri-check-line"></i>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Rejection note */}
          {app.status === 'rejected' && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-4">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-close-circle-line text-red-500"></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-700 mb-1">{t('admin.hostApplications.rejectionNoteTitle')}</p>
                {app.rejection_note ? (
                  <p className="text-sm text-red-600 leading-relaxed">{app.rejection_note}</p>
                ) : (
                  <p className="text-sm text-red-400 italic">{t('admin.hostApplications.noRejectionNoteProvided')}</p>
                )}
              </div>
            </div>
          )}

          {/* Hidden notice */}
          {app.status === 'hidden' && (
            <div className="flex items-center gap-3 bg-gray-100 border border-line rounded-xl px-4 py-3">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <i className="ri-eye-off-line text-gray-500"></i>
              </div>
              <p className="text-sm text-gray-600">
                {t('admin.hostApplications.hiddenNotice')}
              </p>
            </div>
          )}

          {/* Photos */}
          {app.photo_urls.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {t('admin.hostApplications.photosCount', { count: app.photo_urls.length })}
              </p>
              {activePhoto && (
                <div className="w-full h-56 rounded-xl overflow-hidden bg-gray-100 mb-3">
                  <img src={activePhoto} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {app.photo_urls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhoto(url)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      activePhoto === url ? 'border-red-400' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-lg px-4 py-3">
              <i className="ri-image-line"></i>
              {t('admin.hostApplications.noPhotosSubmitted')}
            </div>
          )}

          {/* Host Info */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('admin.hostApplications.hostInformation')}</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center">
                  <i className="ri-user-line text-red-500 text-sm"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{hostName}</p>
                  <p className="text-xs text-gray-500">{t('admin.hostApplications.hostApplicant')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <i className="ri-mail-line text-gray-400"></i>
                  <span className="truncate">{app.host_email}</span>
                </div>
                {app.host_phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <i className="ri-phone-line text-gray-400"></i>
                    <span>{app.host_phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('admin.hostApplications.propertyDetails')}</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t('admin.hostApplications.fieldType'), value: app.property_type, icon: 'ri-home-4-line' },
                { label: t('admin.hostApplications.fieldLocation'), value: app.location, icon: 'ri-map-pin-line' },
                { label: t('admin.hostApplications.fieldBedrooms'), value: String(app.bedrooms), icon: 'ri-hotel-bed-line' },
                { label: t('admin.hostApplications.fieldBathrooms'), value: String(app.bathrooms), icon: 'ri-drop-line' },
                { label: t('admin.hostApplications.fieldMaxGuests'), value: String(app.max_guests), icon: 'ri-group-line' },
                { label: t('admin.hostApplications.fieldPricePerNight'), value: `₾${app.price_per_night}`, icon: 'ri-price-tag-3-line' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className={`${icon} text-gray-400 text-sm`}></i>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-medium text-gray-900">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('admin.hostApplications.description')}</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-4 leading-relaxed">{app.description}</p>
          </div>

          {/* Location */}
          {hasLocation && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('admin.hostApplications.location')}</p>
              <div className="space-y-3">
                {app.address && (
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                      <i className="ri-map-pin-2-line text-gray-400 text-sm"></i>
                    </div>
                    <p className="text-sm text-gray-700">{app.address}</p>
                  </div>
                )}
                {(app.latitude != null && app.longitude != null) && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <i className="ri-crosshair-line text-gray-400"></i>
                    <span>{app.latitude}, {app.longitude}</span>
                  </div>
                )}
                {mapEmbedSrc && (
                  <div className="w-full h-52 rounded-xl overflow-hidden border border-line">
                    <iframe
                      title={t('admin.hostApplications.propertyMapTitle')}
                      src={mapEmbedSrc}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                )}
                {mapViewUrl && (
                  <a
                    href={mapViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 border border-line hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-map-2-line text-red-500"></i>
                    </div>
                    {t('admin.hostApplications.viewOnGoogleMaps')}
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-external-link-line text-gray-400"></i>
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Amenities */}
          {app.amenities && app.amenities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('admin.hostApplications.amenities')}</p>
              <div className="flex flex-wrap gap-2">
                {app.amenities.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                    <i className="ri-checkbox-circle-line text-green-500 text-xs"></i>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Submitted */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <i className="ri-calendar-line"></i>
            {t('admin.hostApplications.submittedOn', { date: formatCreated(app.created_at) })}
          </div>
        </div>

        {/* Action footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-3">
          {app.status === 'pending' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onApprove(app.id)}
                disabled={!!actionLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
              >
                {actionLoading === app.id + 'approve' ? (
                  <div className="w-4 h-4 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                ) : (
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-checkbox-circle-line"></i></div>
                )}
                {t('admin.hostApplications.approveApplication')}
              </button>
              <button
                onClick={() => onRejectRequest(app)}
                disabled={!!actionLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-close-circle-line"></i></div>
                {t('admin.hostApplications.rejectApplication')}
              </button>
            </div>
          )}

          {app.status === 'approved' && (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onResendApprovalEmail(app.id)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
                  title={t('admin.hostApplications.resendApprovalEmailTitle')}
                >
                  {actionLoading === app.id + 'resend-approval' ? (
                    <div className="w-4 h-4 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-check-line"></i></div>
                  )}
                  {t('admin.hostApplications.resendApprovalEmail')}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onSendAgreementReminder(app.id)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
                  title={app.agreement_reminder_sent_at ? t('admin.hostApplications.lastSentPrefix', { date: formatDate(app.agreement_reminder_sent_at) }) : t('admin.hostApplications.sendReminderEmailTitle')}
                >
                  {actionLoading === app.id + 'reminder' ? (
                    <div className="w-4 h-4 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-send-line"></i></div>
                  )}
                  {app.agreement_reminder_sent_at ? t('admin.hostApplications.resendAgreementReminder') : t('admin.hostApplications.sendAgreementReminder')}
                </button>
              </div>
              {app.agreement_reminder_sent_at && (
                <p className="text-xs text-gray-400 text-center">
                  {t('admin.hostApplications.lastReminderSent', { date: formatCreated(app.agreement_reminder_sent_at) })}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onHide(app.id)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
                >
                  {actionLoading === app.id + 'hide' ? (
                    <div className="w-4 h-4 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-eye-off-line"></i></div>
                  )}
                  {t('admin.hostApplications.hideFromWebsite')}
                </button>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={() => onDeleteRequest(app)}
                  disabled={!!actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 hover:bg-red-50 disabled:opacity-50 text-red-500 text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
                >
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-delete-bin-line"></i></div>
                  {t('admin.hostApplications.removePermanently')}
                </button>
              </div>
            </>
          )}

          {app.status === 'hidden' && (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onUnhide(app.id)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
                >
                  {actionLoading === app.id + 'unhide' ? (
                    <div className="w-4 h-4 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-eye-line"></i></div>
                  )}
                  {t('admin.hostApplications.publishAgain')}
                </button>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={() => onDeleteRequest(app)}
                  disabled={!!actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 hover:bg-red-50 disabled:opacity-50 text-red-500 text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
                >
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-delete-bin-line"></i></div>
                  {t('admin.hostApplications.removePermanently')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HostApplications({ onPendingCountChange }: Props) {
  const { t } = useT();
  const [applications, setApplications] = useState<HostApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<HostApplication | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HostApplication | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<HostApplication | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [fetchError, setFetchError] = useState('');

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch(ADMIN_HOST_ACTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
        },
        body: JSON.stringify({ action: 'fetch-all' }),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON */ }

      if (res.ok && data.success) {
        const apps = (data.applications as HostApplication[]) ?? [];
        setApplications(apps);
        if (onPendingCountChange) {
          onPendingCountChange(apps.filter((a) => a.status === 'pending').length);
        }
      } else {
        const errMsg = (data.error as string) ?? t('admin.hostApplications.requestFailedError', { status: res.status });
        setFetchError(errMsg);
      }
    } catch (err) {
      console.error('[fetchApplications] Network error:', err);
      setFetchError(t('admin.hostApplications.networkErrorLoadApplications'));
    }
    setLoading(false);
  }, [onPendingCountChange, t]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleAction = async (appId: string, action: 'approve' | 'hide' | 'unhide') => {
    setActionLoading(appId + action);
    try {
      const res = await fetch(ADMIN_HOST_ACTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
        },
        body: JSON.stringify({ action, applicationId: appId }),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON */ }

      if (res.ok && data.success) {
        const statusMap: Record<string, string> = {
          approve: 'approved',
          hide: 'hidden',
          unhide: 'approved',
        };
        const newStatus = statusMap[action];
        const updated = applications.map((a) =>
          a.id === appId ? { ...a, status: newStatus } : a
        );
        setApplications(updated);
        if (selectedApp?.id === appId) {
          setSelectedApp((prev) => prev ? { ...prev, status: newStatus } : prev);
        }
        if (onPendingCountChange) {
          onPendingCountChange(updated.filter((a) => a.status === 'pending').length);
        }
        const toastMessages: Record<string, string> = {
          approve: t('admin.hostApplications.applicationApprovedToast'),
          hide: t('admin.hostApplications.propertyHiddenToast'),
          unhide: t('admin.hostApplications.propertyUnhiddenToast'),
        };
        showToast(toastMessages[action], 'success');
      } else {
        const errMsg = (data.error as string) ?? t('admin.hostApplications.requestFailedError', { status: res.status });
        showToast(errMsg, 'error');
      }
    } catch (err) {
      console.error('[handleAction] Network error:', err);
      showToast(t('admin.hostApplications.networkErrorGeneric'), 'error');
    }
    setActionLoading(null);
  };

  const handleRejectConfirm = async (note: string) => {
    if (!rejectTarget) return;
    setRejectLoading(true);
    try {
      const res = await fetch(ADMIN_HOST_ACTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
        },
        body: JSON.stringify({ action: 'reject', applicationId: rejectTarget.id, rejectionNote: note }),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON */ }

      if (res.ok && data.success) {
        const updated = applications.map((a) =>
          a.id === rejectTarget.id ? { ...a, status: 'rejected', rejection_note: note || null } : a
        );
        setApplications(updated);
        if (selectedApp?.id === rejectTarget.id) {
          setSelectedApp((prev) => prev ? { ...prev, status: 'rejected', rejection_note: note || null } : prev);
        }
        if (onPendingCountChange) {
          onPendingCountChange(updated.filter((a) => a.status === 'pending').length);
        }
        showToast(t('admin.hostApplications.applicationRejectedToast'), 'success');
        setRejectTarget(null);
      } else {
        const errMsg = (data.error as string) ?? t('admin.hostApplications.requestFailedError', { status: res.status });
        showToast(errMsg, 'error');
      }
    } catch (err) {
      console.error('[handleRejectConfirm] Network error:', err);
      showToast(t('admin.hostApplications.networkErrorGeneric'), 'error');
    }
    setRejectLoading(false);
  };

  const handleResendApprovalEmail = async (appId: string) => {
    setActionLoading(appId + 'resend-approval');
    try {
      const res = await fetch(RESEND_APPROVAL_EMAIL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
        },
        body: JSON.stringify({ applicationId: appId }),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON */ }

      if (res.ok && data.success) {
        showToast(t('admin.hostApplications.approvalEmailResentToast'), 'success');
      } else {
        const errMsg = (data.error as string) ?? t('admin.hostApplications.requestFailedError', { status: res.status });
        showToast(errMsg, 'error');
      }
    } catch (err) {
      console.error('[handleResendApprovalEmail] Network error:', err);
      showToast(t('admin.hostApplications.networkErrorGeneric'), 'error');
    }
    setActionLoading(null);
  };

  const handleSendAgreementReminder = async (appId: string) => {
    setActionLoading(appId + 'reminder');
    try {
      const res = await fetch(ADMIN_HOST_ACTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
        },
        body: JSON.stringify({ action: 'send-agreement-reminder', applicationId: appId }),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON */ }

      if (res.ok && data.success) {
        const now = new Date().toISOString();
        const updated = applications.map((a) =>
          a.id === appId ? { ...a, agreement_reminder_sent_at: now } : a
        );
        setApplications(updated);
        if (selectedApp?.id === appId) {
          setSelectedApp((prev) => prev ? { ...prev, agreement_reminder_sent_at: now } : prev);
        }
        showToast(t('admin.hostApplications.agreementReminderSentToast'), 'success');
      } else {
        const errMsg = (data.error as string) ?? t('admin.hostApplications.requestFailedError', { status: res.status });
        showToast(errMsg, 'error');
      }
    } catch (err) {
      console.error('[handleSendAgreementReminder] Network error:', err);
      showToast(t('admin.hostApplications.networkErrorGeneric'), 'error');
    }
    setActionLoading(null);
  };

  const handleUpdateAgreementStatus = async (appId: string, agreementStatus: AgreementStatus) => {
    setActionLoading(appId + 'agreement');
    try {
      const res = await fetch(ADMIN_HOST_ACTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
        },
        body: JSON.stringify({ action: 'update-agreement-status', applicationId: appId, agreementStatus }),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON */ }

      if (res.ok && data.success) {
        const receivedAt = agreementStatus === 'received' ? new Date().toISOString() : null;
        const updated = applications.map((a) =>
          a.id === appId
            ? { ...a, agreement_status: agreementStatus, agreement_received_at: receivedAt }
            : a
        );
        setApplications(updated);
        if (selectedApp?.id === appId) {
          setSelectedApp((prev) =>
            prev ? { ...prev, agreement_status: agreementStatus, agreement_received_at: receivedAt } : prev
          );
        }
        const labels: Record<string, string> = {
          not_sent: t('admin.hostApplications.agreementNotSentStatusToast'),
          pending: t('admin.hostApplications.agreementPendingStatusToast'),
          received: t('admin.hostApplications.agreementReceivedStatusToast'),
        };
        showToast(labels[agreementStatus] ?? t('admin.hostApplications.agreementStatusUpdatedToast'), 'success');
      } else {
        const errMsg = (data.error as string) ?? t('admin.hostApplications.requestFailedError', { status: res.status });
        showToast(errMsg, 'error');
      }
    } catch (err) {
      console.error('[handleUpdateAgreementStatus] Network error:', err);
      showToast(t('admin.hostApplications.networkErrorGeneric'), 'error');
    }
    setActionLoading(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(ADMIN_HOST_ACTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
        },
        body: JSON.stringify({ action: 'delete', applicationId: deleteTarget.id }),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON */ }

      if (res.ok && data.success) {
        const updated = applications.filter((a) => a.id !== deleteTarget.id);
        setApplications(updated);
        if (onPendingCountChange) {
          onPendingCountChange(updated.filter((a) => a.status === 'pending').length);
        }
        if (selectedApp?.id === deleteTarget.id) setSelectedApp(null);
        setDeleteTarget(null);
        showToast(t('admin.hostApplications.deletePermanentlyToast', { title: deleteTarget.title }), 'success');
      } else {
        const errMsg = (data.error as string) ?? t('admin.hostApplications.deleteFailedError', { status: res.status });
        showToast(errMsg, 'error');
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error('[handleDelete] Network error:', err);
      showToast(t('admin.hostApplications.networkErrorGeneric'), 'error');
      setDeleteTarget(null);
    }
    setDeleteLoading(false);
  };

  const counts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === 'pending').length,
    approved: applications.filter((a) => a.status === 'approved').length,
    hidden: applications.filter((a) => a.status === 'hidden').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const filtered = applications.filter((a) => {
    const matchesStatus = filter === 'all' || a.status === filter;
    const q = search.toLowerCase();
    const hostName = `${a.host_first_name} ${a.host_last_name}`.toLowerCase();
    const matchesSearch =
      !q ||
      hostName.includes(q) ||
      a.host_email.toLowerCase().includes(q) ||
      a.title.toLowerCase().includes(q) ||
      a.location.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const tabs: { key: FilterTab; label: string; color: string }[] = [
    { key: 'pending', label: t('admin.hostApplications.tabPending'), color: 'text-amber-600' },
    { key: 'all', label: t('admin.hostApplications.tabAll'), color: 'text-gray-600' },
    { key: 'approved', label: t('admin.hostApplications.tabApproved'), color: 'text-green-600' },
    { key: 'hidden', label: t('admin.hostApplications.tabHidden'), color: 'text-gray-500' },
    { key: 'rejected', label: t('admin.hostApplications.tabRejected'), color: 'text-red-500' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
            <i className="ri-home-smile-line text-orange-500 text-sm"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{t('admin.hostApplications.title')}</h2>
            <p className="text-xs text-gray-400">{t('admin.hostApplications.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={fetchApplications}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-refresh-line"></i>
          </div>
          {t('admin.hostApplications.refresh')}
        </button>
      </div>

      {/* Agreement Status Legend */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.hostApplications.agreementLegendLabel')}</p>
        {[
          { status: 'not_sent' as AgreementStatus, labelKey: 'admin.hostApplications.shortNotSent' },
          { status: 'pending' as AgreementStatus, labelKey: 'admin.hostApplications.shortSentByHost' },
          { status: 'received' as AgreementStatus, labelKey: 'admin.hostApplications.shortReceived' },
        ].map(({ status, labelKey }) => {
          const cfg = agreementStatusConfig(status, t);
          return (
            <span key={status} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
              <div className="w-3 h-3 flex items-center justify-center">
                <i className={cfg.icon}></i>
              </div>
              {t(labelKey)}
            </span>
          );
        })}
      </div>

      {fetchError && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <i className="ri-error-warning-line"></i>
          </div>
          {fetchError}
        </div>
      )}

      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        {/* Tabs + Search */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  filter === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span className={`text-xs font-semibold ${filter === tab.key ? tab.color : 'text-gray-400'}`}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <i className="ri-search-line text-gray-400 text-sm"></i>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.hostApplications.searchPlaceholder')}
              className="pl-9 pr-4 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 w-64"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-5 h-5 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line text-xl"></i>
              </div>
              <span className="text-sm">{t('admin.hostApplications.loadingApplications')}</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-12 h-12 flex items-center justify-center mb-3">
              <i className="ri-inbox-line text-4xl"></i>
            </div>
            <p className="text-sm font-medium">{t('admin.hostApplications.noApplicationsFound')}</p>
            <p className="text-xs mt-1">
              {filter === 'pending' ? t('admin.hostApplications.noPendingApplications') : t('admin.hostApplications.tryAdjustingFilters')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    t('admin.hostApplications.colAppId'),
                    t('admin.hostApplications.colApplicant'),
                    t('admin.hostApplications.colProperty'),
                    t('admin.hostApplications.colLocation'),
                    t('admin.hostApplications.colPriceNight'),
                    t('admin.hostApplications.colAgreement'),
                    t('admin.hostApplications.colSubmitted'),
                    t('admin.hostApplications.colStatus'),
                    t('admin.hostApplications.colActions'),
                  ].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((app) => {
                  const hostName = `${app.host_first_name} ${app.host_last_name}`;
                  const isApproved = app.status === 'approved';
                  const isHidden = app.status === 'hidden';
                  const isPending = app.status === 'pending';
                  const showAgreement = isApproved || isHidden;

                  return (
                    <tr
                      key={app.id}
                      className={`hover:bg-gray-50/60 transition-colors ${isHidden ? 'opacity-70' : ''}`}
                    >
                      {/* App ID */}
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono text-gray-400">{app.id.slice(0, 8)}&hellip;</span>
                      </td>
                      {/* Applicant */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{hostName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{app.host_email}</p>
                      </td>
                      {/* Property */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900 max-w-[150px] truncate notranslate" translate="no">{app.title}</p>
                        {app.status === 'rejected' && app.rejection_note && (
                          <p className="text-xs text-red-400 mt-0.5 max-w-[150px] truncate" title={app.rejection_note}>
                            <i className="ri-information-line mr-0.5"></i>{app.rejection_note}
                          </p>
                        )}
                      </td>
                      {/* Location */}
                      <td className="px-5 py-4">
                        <p className="text-sm text-gray-700 whitespace-nowrap">{app.location}</p>
                      </td>
                      {/* Price */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">₾{app.price_per_night}</span>
                      </td>
                      {/* Agreement Status */}
                      <td className="px-5 py-4">
                        {showAgreement ? (
                          <AgreementStatusDropdown
                            app={app}
                            onUpdate={handleUpdateAgreementStatus}
                            loading={actionLoading === app.id + 'agreement'}
                          />
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      {/* Submitted */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-400">{formatDate(app.created_at)}</span>
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge(app.status)}`}>
                          <i className={`${statusIcon(app.status)} text-xs`}></i>
                          {t(HOST_APP_STATUS_LABEL_KEY[app.status] ?? app.status)}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setSelectedApp(app)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                          >
                            <div className="w-3 h-3 flex items-center justify-center">
                              <i className="ri-eye-line"></i>
                            </div>
                            {t('admin.hostApplications.review')}
                          </button>

                          {isPending && (
                            <>
                              <button
                                onClick={() => handleAction(app.id, 'approve')}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                              >
                                {actionLoading === app.id + 'approve' ? (
                                  <div className="w-3 h-3 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                                ) : (
                                  <div className="w-3 h-3 flex items-center justify-center"><i className="ri-check-line"></i></div>
                                )}
                                {t('admin.hostApplications.approve')}
                              </button>
                              <button
                                onClick={() => setRejectTarget(app)}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-400 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                              >
                                <div className="w-3 h-3 flex items-center justify-center"><i className="ri-close-line"></i></div>
                                {t('admin.hostApplications.reject')}
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <>
                              <button
                                onClick={() => handleResendApprovalEmail(app.id)}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                                title={t('admin.hostApplications.resendApprovalEmailTitleShort')}
                              >
                                {actionLoading === app.id + 'resend-approval' ? (
                                  <div className="w-3 h-3 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                                ) : (
                                  <div className="w-3 h-3 flex items-center justify-center"><i className="ri-mail-check-line"></i></div>
                                )}
                                {t('admin.hostApplications.approvalEmailBtn')}
                              </button>
                              <button
                                onClick={() => handleSendAgreementReminder(app.id)}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                                title={app.agreement_reminder_sent_at ? t('admin.hostApplications.lastSentPrefix', { date: formatDate(app.agreement_reminder_sent_at) }) : t('admin.hostApplications.sendAgreementReminderTitle')}
                              >
                                {actionLoading === app.id + 'reminder' ? (
                                  <div className="w-3 h-3 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                                ) : (
                                  <div className="w-3 h-3 flex items-center justify-center"><i className="ri-mail-send-line"></i></div>
                                )}
                                {app.agreement_reminder_sent_at ? t('admin.hostApplications.resendReminderBtn') : t('admin.hostApplications.sendReminderBtn')}
                              </button>
                              <button
                                onClick={() => handleAction(app.id, 'hide')}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-400 hover:bg-gray-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                                title={t('admin.hostApplications.hideFromWebsiteTitle')}
                              >
                                {actionLoading === app.id + 'hide' ? (
                                  <div className="w-3 h-3 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                                ) : (
                                  <div className="w-3 h-3 flex items-center justify-center"><i className="ri-eye-off-line"></i></div>
                                )}
                                {t('admin.hostApplications.hide')}
                              </button>
                              <button
                                onClick={() => setDeleteTarget(app)}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 hover:bg-red-50 disabled:opacity-50 text-red-500 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                              >
                                <div className="w-3 h-3 flex items-center justify-center"><i className="ri-delete-bin-line"></i></div>
                                {t('admin.hostApplications.delete')}
                              </button>
                            </>
                          )}

                          {isHidden && (
                            <>
                              <button
                                onClick={() => handleAction(app.id, 'unhide')}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                              >
                                {actionLoading === app.id + 'unhide' ? (
                                  <div className="w-3 h-3 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
                                ) : (
                                  <div className="w-3 h-3 flex items-center justify-center"><i className="ri-eye-line"></i></div>
                                )}
                                {t('admin.hostApplications.publish')}
                              </button>
                              <button
                                onClick={() => setDeleteTarget(app)}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 hover:bg-red-50 disabled:opacity-50 text-red-500 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                              >
                                <div className="w-3 h-3 flex items-center justify-center"><i className="ri-delete-bin-line"></i></div>
                                {t('admin.hostApplications.delete')}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedApp && (
        <DetailModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onApprove={(id) => handleAction(id, 'approve')}
          onRejectRequest={(app) => { setSelectedApp(null); setRejectTarget(app); }}
          onHide={(id) => handleAction(id, 'hide')}
          onUnhide={(id) => handleAction(id, 'unhide')}
          onDeleteRequest={(app) => { setSelectedApp(null); setDeleteTarget(app); }}
          onSendAgreementReminder={handleSendAgreementReminder}
          onUpdateAgreementStatus={handleUpdateAgreementStatus}
          onResendApprovalEmail={handleResendApprovalEmail}
          actionLoading={actionLoading}
        />
      )}

      {rejectTarget && (
        <RejectNoteModal
          app={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          loading={rejectLoading}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          app={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium text-white transition-all ${
            toast.type === 'success' ? 'bg-gray-900' : 'bg-red-500'
          }`}
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'}></i>
          </div>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
