import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import HostGate from './components/HostGate';
import HostOverview from './components/HostOverview';
import HostBookingsSection from './components/HostBookingsSection';
import HostPropertiesSection from './components/HostPropertiesSection';
import HostEarningsSection from './components/HostEarningsSection';
import HostActivitySection from './components/HostActivitySection';
import HostDateChangeSection from './components/HostDateChangeSection';
import HostReviewsSection from './components/HostReviewsSection';
import HostBlockedDatesSection from './components/HostBlockedDatesSection';
import HostCalendarSection from './components/HostCalendarSection';
import HostICalSection from './components/HostICalSection';
import { signOutUser } from '../../hooks/useAuth';
import { useT } from '../../i18n';

type NavSection = 'overview' | 'calendar' | 'bookings' | 'cancelled' | 'properties' | 'dates' | 'earnings' | 'activity' | 'reviews' | 'blocked' | 'ical';

interface HostBooking {
  id: string;
  user_name: string | null;
  user_email: string;
  property_id: string | null;
  property_title: string;
  property_location: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  price_per_night: number | null;
  total_price: number | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  created_at: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  requested_total_price: number | null;
  date_change_status: string | null;
  date_change_requested_at: string | null;
  approval_deadline?: string | null;
  rejection_note?: string | null;
}

interface HostProperty {
  id: string;
  title: string;
  location: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  price_per_night: number;
  status: 'pending' | 'approved' | 'rejected';
  amenities: string[];
  photo_urls: string[];
  description: string;
  created_at: string;
  google_maps_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  booking_approval_mode?: string | null;
}

function useNavItems(t: (key: string) => string): { key: NavSection; label: string; icon: string }[] {
  return [
    { key: 'overview', label: t('host.dashboard.navOverview'), icon: 'ri-dashboard-line' },
    { key: 'calendar', label: t('host.dashboard.navCalendar'), icon: 'ri-calendar-event-line' },
    { key: 'bookings', label: t('host.dashboard.navBookings'), icon: 'ri-calendar-check-line' },
    { key: 'cancelled', label: t('host.dashboard.navCancelled'), icon: 'ri-close-circle-line' },
    { key: 'properties', label: t('host.dashboard.navProperties'), icon: 'ri-home-smile-line' },
    { key: 'dates', label: t('host.dashboard.navDates'), icon: 'ri-calendar-2-line' },
    { key: 'earnings', label: t('host.dashboard.navEarnings'), icon: 'ri-money-cny-circle-line' },
    { key: 'reviews', label: t('host.dashboard.navReviews'), icon: 'ri-star-line' },
    { key: 'blocked', label: t('host.dashboard.navBlocked'), icon: 'ri-calendar-close-line' },
    { key: 'ical', label: t('host.dashboard.navIcal'), icon: 'ri-calendar-2-line' },
    { key: 'activity', label: t('host.dashboard.navActivity'), icon: 'ri-notification-3-line' },
  ];
}

function HostDashboardContent() {
  const { t, plural } = useT();
  const navItems = useNavItems(t);
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [properties, setProperties] = useState<HostProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);

    const { data: propData } = await supabase
      .from('property_applications')
      .select('*')
      .eq('host_email', user.email)
      .order('created_at', { ascending: false });

    const hostProperties = (propData ?? []) as HostProperty[];
    setProperties(hostProperties);

    if (hostProperties.length > 0) {
      const propertyIds = hostProperties.map((p) => p.id);
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('id, user_name, user_email, property_id, property_title, property_location, check_in, check_out, guests, price_per_night, total_price, status, payment_status, payment_method, created_at, requested_check_in, requested_check_out, requested_total_price, date_change_status, date_change_requested_at, approval_deadline, rejection_note')
        .in('property_id', propertyIds)
        .order('created_at', { ascending: false });
      setBookings((bookingData ?? []) as HostBooking[]);
    } else {
      setBookings([]);
    }

    setLoading(false);
  }, [user?.email]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Trigger contact-reveal emails once per day on dashboard load
  useEffect(() => {
    const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
    const ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;
    const lastRun = localStorage.getItem('rc_contact_reveal_last_run');
    const today = new Date().toISOString().split('T')[0];
    if (lastRun === today) return; // already ran today
    fetch(`${SUPABASE_URL}/functions/v1/booking-handler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ action: 'send-contact-reveal-emails' }),
    })
      .then(() => localStorage.setItem('rc_contact_reveal_last_run', today))
      .catch(() => {}); // non-fatal
  }, []);

  // Trigger pending booking reminder emails — runs at most once per hour
  useEffect(() => {
    const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
    const lastRun = localStorage.getItem('rc_booking_reminders_last_run');
    const nowMs = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    if (lastRun && nowMs - Number(lastRun) < ONE_HOUR_MS) return; // ran within last hour
    fetch(`${SUPABASE_URL}/functions/v1/booking-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(() => localStorage.setItem('rc_booking_reminders_last_run', String(nowMs)))
      .catch(() => {}); // non-fatal
  }, []);

  const pendingCount = bookings.filter((b) => b.status === 'pending' || b.status === 'pending_host_approval').length;
  const dateChangeCount = bookings.filter((b) => b.date_change_status === 'pending').length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled' || b.status === 'cancelled_by_host').length;

  const getBadge = (key: NavSection): number => {
    if (key === 'bookings') return pendingCount;
    if (key === 'dates') return dateChangeCount;
    if (key === 'cancelled') return cancelledCount;
    return 0;
  };

  const hostName =
    user?.user_metadata?.first_name ||
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    t('host.dashboard.hostFallback');

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <HostOverview bookings={bookings} properties={properties} loading={loading} />;
      case 'calendar':
        return <HostCalendarSection properties={properties} bookings={bookings} loading={loading} />;
      case 'bookings':
        return <HostBookingsSection bookings={bookings} loading={loading} hostEmail={user?.email ?? ''} onRefresh={fetchData} />;
      case 'cancelled':
        return <HostBookingsSection bookings={bookings} loading={loading} showCancelledOnly hostEmail={user?.email ?? ''} onRefresh={fetchData} />;
      case 'properties':
        return <HostPropertiesSection properties={properties} loading={loading} onRefresh={fetchData} />;
      case 'dates':
        return <HostDateChangeSection bookings={bookings} loading={loading} />;
      case 'earnings':
        return <HostEarningsSection bookings={bookings} loading={loading} />;
      case 'reviews':
        return <HostReviewsSection properties={properties} loading={loading} />;
      case 'blocked':
        return <HostBlockedDatesSection properties={properties} loading={loading} />;
      case 'ical':
        return <HostICalSection properties={properties} loading={loading} onRefresh={fetchData} />;
      case 'activity':
        return <HostActivitySection bookings={bookings} loading={loading} />;
      default:
        return null;
    }
  };

  const handleNavSelect = (key: NavSection) => {
    setActiveSection(key);
    setMobileSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static top-0 left-0 h-full lg:h-screen w-64 bg-white border-r border-gray-200 flex flex-col z-40
        transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:sticky lg:top-0
      `}>
        {/* Logo area */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center">
                <i className="ri-home-smile-line text-white text-base"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">{t('host.dashboard.title')}</p>
                <p className="text-xs text-gray-400">RentCottage.Ge</p>
              </div>
            </div>
            {/* Close button — mobile only */}
            <button
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label={t('host.dashboard.closeMenu')}
            >
              <i className="ri-close-line text-gray-500 text-lg"></i>
            </button>
          </div>
        </div>

        {/* Host info */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-50 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-red-500">
                {hostName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{hostName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const badge = getBadge(item.key);
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNavSelect(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-red-50 text-red-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className={`${item.icon} text-base`}></i>
                </div>
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      item.key === 'cancelled'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-100 space-y-2">
          <button
            onClick={fetchData}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-refresh-line"></i>
            </div>
            {t('host.dashboard.refreshData')}
          </button>
          <a
            href="/"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-left-line"></i>
            </div>
            {t('host.dashboard.backToWebsite')}
          </a>
          <button
            onClick={async () => {
              await signOutUser();
              window.location.href = '/';
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-logout-box-r-line"></i>
            </div>
            {t('host.dashboard.signOut')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 sticky top-0 z-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Hamburger — mobile only */}
              <button
                className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label={t('host.dashboard.openMenu')}
              >
                <i className="ri-menu-line text-gray-700 text-xl"></i>
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-gray-900 truncate">
                  {navItems.find((n) => n.key === activeSection)?.label}
                </h1>
                <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
                  {plural('host.dashboard.propertiesCount', properties.length)} · {t('host.dashboard.totalBookingsSuffix', { count: bookings.length })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!loading && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  {t('host.dashboard.liveData')}
                </div>
              )}
              {loading && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
                  <div className="w-3 h-3 flex items-center justify-center animate-spin">
                    <i className="ri-loader-4-line"></i>
                  </div>
                  {t('host.common.loading')}
                </div>
              )}
              <a
                href="/become-host"
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <div className="w-3 h-3 flex items-center justify-center">
                  <i className="ri-add-line"></i>
                </div>
                <span className="hidden sm:inline">{t('host.dashboard.addProperty')}</span>
                <span className="sm:hidden">{t('host.dashboard.add')}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Section content */}
        <div className="px-4 md:px-8 py-6 md:py-8">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}

export default function HostDashboard() {
  return (
    <HostGate>
      <HostDashboardContent />
    </HostGate>
  );
}
