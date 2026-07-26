import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useT } from '../../../i18n';

type TFunc = (key: string, vars?: Record<string, string | number>) => string;

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const ICAL_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ical-sync`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Property {
  id: string;
  title: string;
  status: string;
}

interface ExternalCalendar {
  id: string;
  property_id: string;
  platform: 'airbnb' | 'booking_com' | 'other';
  label: string | null;
  ical_url: string;
  last_synced: string | null;
  sync_status: 'pending' | 'synced' | 'error';
  sync_error: string | null;
  created_at: string;
}

interface ICalBlock {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  summary: string | null;
  platform: string;
  calendar_id: string | null;
}

interface Props {
  properties: Property[];
  loading: boolean;
  onRefresh: () => void;
}

// ─── Platform config ──────────────────────────────────────────────────────────
function getPlatforms(t: TFunc) {
  return [
    {
      value: 'airbnb',
      label: t('host.ical.platformAirbnb'),
      color: 'orange',
      icon: 'ri-home-smile-line',
      placeholder: 'https://www.airbnb.com/calendar/ical/XXXXX.ics?s=...',
      importSteps: [
        t('host.ical.airbnbImport1'),
        t('host.ical.airbnbImport2'),
        t('host.ical.airbnbImport3'),
        t('host.ical.airbnbImport4'),
      ],
      exportSteps: [
        t('host.ical.airbnbExport1'),
        t('host.ical.airbnbExport2'),
        t('host.ical.airbnbExport3'),
        t('host.ical.airbnbExport4'),
      ],
    },
    {
      value: 'booking_com',
      label: t('host.ical.platformBookingCom'),
      color: 'blue',
      icon: 'ri-building-line',
      placeholder: 'https://admin.booking.com/hotel/hoteladmin/ical.html?...',
      importSteps: [
        t('host.ical.bookingImport1'),
        t('host.ical.bookingImport2'),
        t('host.ical.bookingImport3'),
        t('host.ical.bookingImport4'),
      ],
      exportSteps: [
        t('host.ical.bookingExport1'),
        t('host.ical.bookingExport2'),
        t('host.ical.bookingExport3'),
        t('host.ical.bookingExport4'),
      ],
    },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPlatformConfig(platform: string, platforms: ReturnType<typeof getPlatforms>) {
  return platforms.find((p) => p.value === platform) ?? platforms[0];
}

function getPlatformBadgeClass(platform: string) {
  if (platform === 'airbnb') return 'bg-orange-50 text-orange-700';
  if (platform === 'booking_com') return 'bg-sky-50 text-sky-700';
  return 'bg-gray-100 text-gray-600';
}

// ─── Add Calendar Modal ───────────────────────────────────────────────────────
function AddCalendarModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (platform: string, label: string, url: string) => Promise<void>;
}) {
  const { t } = useT();
  const platforms = getPlatforms(t);
  const [platform, setPlatform] = useState('airbnb');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const cfg = getPlatformConfig(platform, platforms);

  const handleSubmit = async () => {
    if (!url.trim()) { setError(t('host.ical.urlRequiredError')); return; }
    if (!url.trim().startsWith('http')) { setError(t('host.ical.urlProtocolError')); return; }
    setError('');
    setAdding(true);
    try {
      await onAdd(platform, label, url.trim());
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{t('host.ical.addModalTitle')}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Platform selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{t('host.ical.platformLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              {platforms.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    platform === p.value
                      ? p.value === 'airbnb'
                        ? 'border-orange-400 bg-orange-50 text-orange-700'
                        : 'border-sky-400 bg-sky-50 text-sky-700'
                      : 'border-line text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={p.icon}></i>
                  </div>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* How to get the link */}
          <div className={`rounded-xl p-4 ${platform === 'airbnb' ? 'bg-orange-50 border border-orange-100' : 'bg-sky-50 border border-sky-100'}`}>
            <p className={`text-xs font-semibold mb-2 ${platform === 'airbnb' ? 'text-orange-800' : 'text-sky-800'}`}>
              {t('host.ical.howToGetLink', { platform: cfg.label })}
            </p>
            <ol className="space-y-1">
              {cfg.importSteps.map((step, i) => (
                <li key={i} className={`flex items-start gap-2 text-xs ${platform === 'airbnb' ? 'text-orange-700' : 'text-sky-700'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${platform === 'airbnb' ? 'bg-orange-200' : 'bg-sky-200'}`}>
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Label (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {t('host.ical.labelField')} <span className="text-gray-300">{t('host.ical.optional')}</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('host.ical.labelPlaceholder', { platform: cfg.label })}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {t('host.ical.exportUrlField', { platform: cfg.label })} <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              placeholder={cfg.placeholder}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono placeholder:font-sans"
            />
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-line text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t('host.ical.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={adding}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {adding ? (
              <>
                <div className="w-3 h-3 flex items-center justify-center animate-spin">
                  <i className="ri-loader-4-line"></i>
                </div>
                {t('host.ical.adding')}
              </>
            ) : (
              <>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-add-line"></i>
                </div>
                {t('host.ical.addCalendar')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Card ────────────────────────────────────────────────────────────
function CalendarCard({
  cal,
  onSync,
  onRemove,
  syncing,
}: {
  cal: ExternalCalendar;
  onSync: (id: string) => void;
  onRemove: (id: string) => void;
  syncing: boolean;
}) {
  const { t } = useT();
  const platforms = getPlatforms(t);
  const cfg = getPlatformConfig(cal.platform, platforms);
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-4 md:p-5">
      <div className="flex items-start gap-3">
        {/* Platform icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          cal.platform === 'airbnb' ? 'bg-orange-100' : 'bg-sky-100'
        }`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${cfg.icon} ${cal.platform === 'airbnb' ? 'text-orange-600' : 'text-sky-600'} text-base`}></i>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900">{cfg.label}</span>
            {cal.label && (
              <span className="text-xs text-gray-400 truncate">{cal.label}</span>
            )}
            {/* Status badge */}
            {cal.sync_status === 'synced' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                {t('host.ical.synced')}
              </span>
            )}
            {cal.sync_status === 'error' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                {t('host.ical.error')}
              </span>
            )}
            {cal.sync_status === 'pending' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                {t('host.ical.notSynced')}
              </span>
            )}
          </div>

          {/* URL */}
          <p className="text-xs text-gray-400 mt-1 font-mono truncate max-w-xs md:max-w-sm">{cal.ical_url}</p>

          {/* Error message */}
          {cal.sync_status === 'error' && cal.sync_error && (
            <p className="text-xs text-red-500 mt-1">{cal.sync_error}</p>
          )}

          {/* Last synced */}
          {cal.last_synced && (
            <p className="text-xs text-gray-400 mt-1">
              {t('host.ical.lastSynced', { date: fmtDateTime(cal.last_synced) })}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onSync(cal.id)}
            disabled={syncing}
            title={t('host.ical.refreshSync')}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-line hover:bg-gray-50 disabled:opacity-40 text-gray-500 cursor-pointer transition-colors"
          >
            <i className={`ri-refresh-line text-sm ${syncing ? 'animate-spin' : ''}`}></i>
          </button>
          {!confirmRemove ? (
            <button
              onClick={() => setConfirmRemove(true)}
              title={t('host.ical.removeCalendar')}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-line hover:bg-red-50 hover:border-red-200 text-gray-400 hover:text-red-500 cursor-pointer transition-colors"
            >
              <i className="ri-delete-bin-line text-sm"></i>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRemove(cal.id)}
                className="text-xs px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
              >
                {t('host.ical.remove')}
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="text-xs px-2.5 py-1.5 border border-line text-gray-500 font-semibold rounded-lg cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-colors"
              >
                {t('host.ical.cancel')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HostICalSection({ properties, loading: propsLoading, onRefresh }: Props) {
  const { t, plural } = useT();
  const platforms = getPlatforms(t);
  const { user } = useAuth();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [calendars, setCalendars] = useState<ExternalCalendar[]>([]);
  const [icalBlocks, setIcalBlocks] = useState<ICalBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'blocked'>('import');

  const showToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Initialize selected property
  useEffect(() => {
    if (!selectedPropertyId && properties.length > 0) {
      const approved = properties.find((p) => p.status === 'approved') || properties[0];
      setSelectedPropertyId(approved.id);
    }
  }, [properties, selectedPropertyId]);

  // Fetch external calendars for selected property
  const fetchCalendars = useCallback(async () => {
    if (!selectedPropertyId || !user?.email) return;
    setLoading(true);
    const { data } = await supabase
      .from('external_calendars')
      .select('*')
      .eq('property_id', selectedPropertyId)
      .eq('host_email', user.email)
      .order('created_at', { ascending: true });
    setCalendars((data ?? []) as ExternalCalendar[]);
    setLoading(false);
  }, [selectedPropertyId, user?.email]);

  useEffect(() => { fetchCalendars(); }, [fetchCalendars]);

  // Fetch iCal blocked dates for selected property
  const fetchICalBlocks = useCallback(async () => {
    if (!selectedPropertyId) return;
    setBlocksLoading(true);
    const { data } = await supabase
      .from('ical_blocked_dates')
      .select('id, property_id, start_date, end_date, summary, platform, calendar_id')
      .eq('property_id', selectedPropertyId)
      .order('start_date', { ascending: true });
    setIcalBlocks((data ?? []) as ICalBlock[]);
    setBlocksLoading(false);
  }, [selectedPropertyId]);

  useEffect(() => { fetchICalBlocks(); }, [fetchICalBlocks]);

  // Add calendar
  const handleAddCalendar = async (platform: string, label: string, icalUrl: string) => {
    if (!selectedPropertyId || !user?.email) return;
    const res = await fetch(ICAL_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add-calendar',
        property_id: selectedPropertyId,
        host_email: user.email,
        platform,
        label: label || null,
        ical_url: icalUrl,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || t('host.ical.error'));
    showToast(t('host.ical.calendarAddedToast'), 'success');
    await fetchCalendars();
    onRefresh();
  };

  // Sync single calendar
  const handleSyncCalendar = async (calendarId: string) => {
    if (!user?.email) return;
    setSyncingId(calendarId);
    try {
      const res = await fetch(ICAL_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync-calendar',
          property_id: selectedPropertyId,
          host_email: user.email,
          calendar_id: calendarId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || t('host.ical.syncFailedToast', { error: '' }));
      showToast(data.message || t('host.ical.syncedEventsToast', { count: data.imported }), 'success');
      await Promise.all([fetchCalendars(), fetchICalBlocks()]);
    } catch (err) {
      showToast(t('host.ical.syncFailedToast', { error: String(err) }), 'error');
      await fetchCalendars();
    } finally {
      setSyncingId(null);
    }
  };

  // Sync all calendars
  const handleSyncAll = async () => {
    if (!user?.email || calendars.length === 0) return;
    setSyncingAll(true);
    try {
      const res = await fetch(ICAL_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync-all',
          property_id: selectedPropertyId,
          host_email: user.email,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || t('host.ical.syncFailedToast', { error: '' }));
      showToast(t('host.ical.syncedCalendarsToast', { synced: data.synced, imported: data.total_imported }), 'success');
      await Promise.all([fetchCalendars(), fetchICalBlocks()]);
    } catch (err) {
      showToast(t('host.ical.syncFailedToast', { error: String(err) }), 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  // Remove calendar
  const handleRemoveCalendar = async (calendarId: string) => {
    if (!user?.email) return;
    try {
      const res = await fetch(ICAL_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-calendar',
          property_id: selectedPropertyId,
          host_email: user.email,
          calendar_id: calendarId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || t('host.ical.removeFailedToast', { error: '' }));
      showToast(t('host.ical.calendarRemovedToast'), 'info');
      await Promise.all([fetchCalendars(), fetchICalBlocks()]);
    } catch (err) {
      showToast(t('host.ical.removeFailedToast', { error: String(err) }), 'error');
    }
  };

  const exportUrl = selectedPropertyId
    ? `${ICAL_FUNCTION_URL}?action=export&property_id=${selectedPropertyId}`
    : '';

  const handleCopyExportUrl = async () => {
    if (!exportUrl) return;
    await navigator.clipboard.writeText(exportUrl);
    setCopied(true);
    showToast(t('host.ical.exportLinkCopiedToast'), 'info');
    setTimeout(() => setCopied(false), 2500);
  };

  if (propsLoading) {
    return (
      <div className="bg-white rounded-card border border-line shadow-card flex items-center justify-center py-16">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 flex items-center justify-center animate-spin">
            <i className="ri-loader-4-line"></i>
          </div>
          <span className="text-sm">{t('host.ical.loading')}</span>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="bg-white rounded-card border border-line shadow-card flex flex-col items-center py-16 text-gray-400">
        <div className="w-10 h-10 flex items-center justify-center mb-2">
          <i className="ri-home-smile-line text-3xl"></i>
        </div>
        <p className="text-sm">{t('host.ical.noPropertiesYet')}</p>
        <p className="text-xs mt-1">{t('host.ical.noPropertiesSub')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Property selector + Sync All */}
      <div className="bg-white rounded-card border border-line shadow-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              {t('host.ical.selectProperty')}
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white cursor-pointer"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          {calendars.length > 0 && (
            <div className="sm:mt-6">
              <button
                onClick={handleSyncAll}
                disabled={syncingAll}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {syncingAll ? (
                  <>
                    <div className="w-3 h-3 flex items-center justify-center animate-spin">
                      <i className="ri-loader-4-line"></i>
                    </div>
                    {t('host.ical.syncingAll')}
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-refresh-line"></i>
                    </div>
                    {t('host.ical.syncAllCalendars')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { key: 'import', label: t('host.ical.tabImport'), icon: 'ri-import-line' },
          { key: 'export', label: t('host.ical.tabExport'), icon: 'ri-export-line' },
          { key: 'blocked', label: t('host.ical.tabBlocked'), icon: 'ri-calendar-close-line' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className={tab.icon}></i>
            </div>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── IMPORT TAB ── */}
      {activeTab === 'import' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{t('host.ical.connectedCalendarsTitle')}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('host.ical.connectedCalendarsSub')}
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-add-line"></i>
              </div>
              {t('host.ical.addCalendar')}
            </button>
          </div>

          {/* Platform info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {platforms.map((p) => {
              const count = calendars.filter((c) => c.platform === p.value).length;
              return (
                <div
                  key={p.value}
                  className={`rounded-xl border p-4 flex items-center gap-3 ${
                    p.value === 'airbnb'
                      ? 'bg-orange-50 border-orange-100'
                      : 'bg-sky-50 border-sky-100'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    p.value === 'airbnb' ? 'bg-orange-100' : 'bg-sky-100'
                  }`}>
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className={`${p.icon} ${p.value === 'airbnb' ? 'text-orange-600' : 'text-sky-600'} text-base`}></i>
                    </div>
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${p.value === 'airbnb' ? 'text-orange-800' : 'text-sky-800'}`}>
                      {p.label}
                    </p>
                    <p className={`text-xs ${p.value === 'airbnb' ? 'text-orange-600' : 'text-sky-600'}`}>
                      {count === 0 ? t('host.ical.notConnected') : plural('host.ical.calendarsConnectedCount', count)}
                    </p>
                  </div>
                  {count > 0 && (
                    <div className="ml-auto">
                      <span className={`w-2 h-2 rounded-full block ${p.value === 'airbnb' ? 'bg-orange-500' : 'bg-sky-500'}`}></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Calendar list */}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-4 h-4 flex items-center justify-center animate-spin">
                  <i className="ri-loader-4-line"></i>
                </div>
                <span className="text-sm">{t('host.ical.loadingCalendars')}</span>
              </div>
            </div>
          ) : calendars.length === 0 ? (
            <div className="bg-white rounded-card border border-dashed border-line flex flex-col items-center py-14 text-gray-400">
              <div className="w-12 h-12 flex items-center justify-center mb-3">
                <i className="ri-calendar-2-line text-3xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-500">{t('host.ical.noExternalCalendars')}</p>
              <p className="text-xs mt-1 text-center px-8 text-gray-400">
                {t('host.ical.noExternalCalendarsSub')}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-add-line"></i>
                </div>
                {t('host.ical.addFirstCalendar')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {calendars.map((cal) => (
                <CalendarCard
                  key={cal.id}
                  cal={cal}
                  onSync={handleSyncCalendar}
                  onRemove={handleRemoveCalendar}
                  syncing={syncingId === cal.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EXPORT TAB ── */}
      {activeTab === 'export' && (
        <div className="bg-white rounded-card border border-line shadow-card p-5 md:p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-export-line text-emerald-600 text-base"></i>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{t('host.ical.exportTitle')}</h3>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {t('host.ical.exportSub')}
              </p>
            </div>
          </div>

          {/* Export URL */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">{t('host.ical.exportUrlLabel')}</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={exportUrl}
                className="flex-1 min-w-0 text-xs border border-line rounded-lg px-3 py-2.5 bg-gray-50 font-mono text-gray-600 truncate"
              />
              <button
                onClick={handleCopyExportUrl}
                disabled={!exportUrl}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 border border-line hover:bg-gray-50 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={copied ? 'ri-check-line text-emerald-600' : 'ri-clipboard-line'}></i>
                </div>
                {copied ? t('host.ical.copied') : t('host.ical.copy')}
              </button>
            </div>
          </div>

          {/* Instructions for each platform */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {platforms.map((p) => (
              <div
                key={p.value}
                className={`rounded-xl p-4 border ${
                  p.value === 'airbnb'
                    ? 'bg-orange-50 border-orange-100'
                    : 'bg-sky-50 border-sky-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className={`${p.icon} ${p.value === 'airbnb' ? 'text-orange-600' : 'text-sky-600'} text-sm`}></i>
                  </div>
                  <p className={`text-xs font-bold ${p.value === 'airbnb' ? 'text-orange-800' : 'text-sky-800'}`}>
                    {t('host.ical.importInto', { platform: p.label })}
                  </p>
                </div>
                <ol className="space-y-1">
                  {p.exportSteps.map((step, i) => (
                    <li key={i} className={`flex items-start gap-2 text-xs ${p.value === 'airbnb' ? 'text-orange-700' : 'text-sky-700'}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${p.value === 'airbnb' ? 'bg-orange-200' : 'bg-sky-200'}`}>
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg px-3.5 py-3 flex items-start gap-2">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-information-line text-gray-400 text-xs"></i>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {t('host.ical.publicLinkNote')}
            </p>
          </div>
        </div>
      )}

      {/* ── BLOCKED DATES TAB ── */}
      {activeTab === 'blocked' && (
        <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{t('host.ical.externallyBlockedTitle')}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('host.ical.externallyBlockedSub')}
              </p>
            </div>
            <button
              onClick={() => { fetchICalBlocks(); fetchCalendars(); }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer whitespace-nowrap"
            >
              <div className="w-3 h-3 flex items-center justify-center">
                <i className="ri-refresh-line"></i>
              </div>
              {t('host.ical.refresh')}
            </button>
          </div>

          {blocksLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-4 h-4 flex items-center justify-center animate-spin">
                  <i className="ri-loader-4-line"></i>
                </div>
                <span className="text-sm">{t('host.ical.loading')}</span>
              </div>
            </div>
          ) : icalBlocks.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <div className="w-10 h-10 flex items-center justify-center mb-2">
                <i className="ri-calendar-2-line text-2xl"></i>
              </div>
              <p className="text-sm">{t('host.ical.noExternalBlocks')}</p>
              <p className="text-xs mt-1 text-center px-8">
                {calendars.length > 0
                  ? t('host.ical.clickSyncAllHint')
                  : t('host.ical.connectCalendarFirstHint')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">{t('host.ical.colFrom')}</th>
                    <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">{t('host.ical.colTo')}</th>
                    <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">{t('host.ical.colSummary')}</th>
                    <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">{t('host.ical.colSource')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {icalBlocks.map((block) => (
                    <tr key={block.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">{fmt(block.start_date)}</td>
                      <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">{fmt(block.end_date)}</td>
                      <td className="px-5 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {block.summary || <span className="text-gray-300 italic">{t('host.ical.noSummary')}</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${getPlatformBadgeClass(block.platform)}`}>
                          {block.platform === 'airbnb' && <i className="ri-home-smile-line text-[10px]"></i>}
                          {block.platform === 'booking_com' && <i className="ri-building-line text-[10px]"></i>}
                          {block.platform === 'airbnb' ? t('host.ical.platformAirbnb') : block.platform === 'booking_com' ? t('host.ical.platformBookingCom') : block.platform}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Calendar Modal */}
      {showAddModal && (
        <AddCalendarModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddCalendar}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium text-white transition-all ${
            toast.type === 'success'
              ? 'bg-gray-900'
              : toast.type === 'error'
              ? 'bg-red-500'
              : 'bg-emerald-600'
          }`}
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i
              className={
                toast.type === 'success'
                  ? 'ri-check-line'
                  : toast.type === 'error'
                  ? 'ri-error-warning-line'
                  : 'ri-clipboard-line'
              }
            ></i>
          </div>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
