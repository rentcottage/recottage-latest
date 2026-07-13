import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@lib/i18n';

const BROADCAST_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/host-broadcast`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

function adminFetchHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    // Server-side admin secret, held in sessionStorage by AdminGate after login.
    'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
  } as const;
}

interface Broadcast {
  id: string;
  subject: string;
  sent_at: string;
  recipient_count: number;
  sent_by_admin: string | null;
}

function formatDateTime(str: string, lang: string) {
  return new Date(str).toLocaleString(lang, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Compose Modal ────────────────────────────────────────────────────────────
interface ComposeModalProps {
  onClose: () => void;
  onSent: (count: number) => void;
}

function ComposeModal({ onClose, onSent }: ComposeModalProps) {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [step, setStep] = useState<'compose' | 'confirm' | 'sending' | 'done'>('compose');
  const [result, setResult] = useState<{ count: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!subject.trim() || !body.trim()) {
      setError(t('admin.news.fillBoth'));
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleSend = async () => {
    setStep('sending');
    setError('');
    try {
      const res = await fetch(BROADCAST_URL, {
        method: 'POST',
        headers: adminFetchHeaders(),
        body: JSON.stringify({
          action: 'send-broadcast',
          subject: subject.trim(),
          body: body.trim(),
          sentByAdmin: 'admin',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ count: data.recipientCount, total: data.totalRecipients });
        setStep('done');
        onSent(data.recipientCount);
      } else {
        setError(data.error ?? t('admin.news.sendFailed'));
        setStep('confirm');
      }
    } catch {
      setError(t('admin.news.networkError'));
      setStep('confirm');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <i className="ri-mail-send-line text-red-500 text-lg"></i>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{t('admin.news.composeTitle')}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {step === 'compose' && t('admin.news.stepCompose')}
                {step === 'confirm' && t('admin.news.stepConfirm')}
                {step === 'sending' && t('admin.news.sendingEmails')}
                {step === 'done' && t('admin.news.sentShort')}
              </p>
            </div>
          </div>
          {step !== 'sending' && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {/* ── Compose ── */}
          {step === 'compose' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-3">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-information-line text-amber-500 text-sm"></i>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {t('admin.news.audienceNotePrefix')}{' '}
                  <strong>{t('admin.news.audienceNoteStrong')}</strong>{' '}
                  {t('admin.news.audienceNoteSuffix')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t('admin.news.subject')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('admin.news.subjectPlaceholder')}
                  maxLength={200}
                  className="w-full text-sm border border-line rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-800 placeholder-gray-400"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{subject.length}/200</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t('admin.news.message')} <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('admin.news.messagePlaceholder')}
                  rows={8}
                  maxLength={5000}
                  className="w-full text-sm border border-line rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-800 placeholder-gray-400 leading-relaxed"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{body.length}/5000</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className="ri-error-warning-line"></i>
                  </div>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Confirm ── */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-4 flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-alert-line text-red-500"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-700 mb-1">{t('admin.news.readyToSend')}</p>
                  <p className="text-xs text-red-600 leading-relaxed">
                    {t('admin.news.confirmNotePrefix')}{' '}
                    <strong>{t('admin.news.confirmNoteStrong')}</strong>
                    {t('admin.news.confirmNoteSuffix')}
                  </p>
                </div>
              </div>

              <div className="border border-line rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.news.preview')}</p>
                </div>
                <div className="px-4 py-4 space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t('admin.news.subject')}</p>
                    <p className="text-sm font-semibold text-gray-900">{subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t('admin.news.message')}</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">{body}</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className="ri-error-warning-line"></i>
                  </div>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Sending ── */}
          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-14 h-14 flex items-center justify-center bg-red-50 rounded-full animate-pulse">
                <i className="ri-mail-send-line text-red-500 text-2xl"></i>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-gray-900">{t('admin.news.sendingEmails')}</p>
                <p className="text-sm text-gray-400 mt-1">{t('admin.news.pleaseWait')}</p>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-16 h-16 flex items-center justify-center bg-green-100 rounded-full">
                <i className="ri-checkbox-circle-line text-green-500 text-3xl"></i>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{t('admin.news.sentTitle')}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {t('admin.news.deliveredTo')}{' '}
                  <strong className="text-gray-900">{result.count}</strong>{' '}
                  {t('admin.news.hostsWord', { count: result.count })}
                  {result.total !== result.count && ` ${t('admin.news.outOf', { total: result.total })}`}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'sending' && step !== 'done' && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button
              onClick={step === 'confirm' ? () => setStep('compose') : onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer whitespace-nowrap transition-colors"
            >
              {step === 'confirm' ? t('common.back') : t('common.cancel')}
            </button>
            {step === 'compose' && (
              <button
                onClick={handleConfirm}
                className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-arrow-right-line"></i>
                </div>
                {t('admin.news.reviewAndSend')}
              </button>
            )}
            {step === 'confirm' && (
              <button
                onClick={handleSend}
                className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-mail-send-line"></i>
                </div>
                {t('admin.news.confirmAndSend')}
              </button>
            )}
          </div>
        )}
        {step === 'done' && (
          <div className="flex items-center justify-center px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function HostNewsPanel() {
  const { t, lang } = useTranslation();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch(BROADCAST_URL, {
        method: 'POST',
        headers: adminFetchHeaders(),
        body: JSON.stringify({ action: 'fetch-history' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBroadcasts(data.broadcasts ?? []);
      } else {
        setFetchError(data.error ?? t('admin.news.loadHistoryFailed'));
      }
    } catch {
      setFetchError(t('admin.news.networkErrorHistory'));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSent = (_count: number) => {
    // Refresh history after a short delay to let DB write settle
    setTimeout(() => {
      fetchHistory();
    }, 800);
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <i className="ri-megaphone-line text-red-500 text-sm"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{t('admin.news.title')}</h2>
            <p className="text-xs text-gray-400">{t('admin.news.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchHistory}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-refresh-line"></i>
            </div>
            {t('common.refresh')}
          </button>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-mail-send-line"></i>
            </div>
            {t('admin.news.sendAnnouncement')}
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <i className="ri-error-warning-line"></i>
          </div>
          {fetchError}
        </div>
      )}

      {/* History table */}
      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">{t('admin.news.sentAnnouncements')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('admin.news.historySubtitle')}</p>
          </div>
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
            {t('admin.news.totalCount', { count: broadcasts.length })}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-5 h-5 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line text-xl"></i>
              </div>
              <span className="text-sm">{t('admin.news.loadingHistory')}</span>
            </div>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="w-12 h-12 flex items-center justify-center mb-3">
              <i className="ri-mail-line text-4xl"></i>
            </div>
            <p className="text-sm font-medium">{t('admin.news.emptyTitle')}</p>
            <p className="text-xs mt-1">{t('admin.news.emptyHint')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['admin.news.subject', 'admin.news.sentAt', 'admin.news.recipients', 'admin.news.sentBy'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {broadcasts.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/60 transition-colors">
                  {/* Subject */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-red-50 rounded-lg flex-shrink-0">
                        <i className="ri-mail-line text-red-400 text-sm"></i>
                      </div>
                      <p className="text-sm font-medium text-gray-900 max-w-xs truncate">{b.subject}</p>
                    </div>
                  </td>
                  {/* Sent At */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <div className="w-3 h-3 flex items-center justify-center">
                        <i className="ri-time-line text-gray-400 text-xs"></i>
                      </div>
                      {formatDateTime(b.sent_at, lang)}
                    </div>
                  </td>
                  {/* Recipients */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full">
                      <div className="w-3 h-3 flex items-center justify-center">
                        <i className="ri-group-line"></i>
                      </div>
                      {t('admin.news.recipientsCount', { count: b.recipient_count })}
                    </span>
                  </td>
                  {/* Sent By */}
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-500 capitalize">{b.sent_by_admin ?? 'admin'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
