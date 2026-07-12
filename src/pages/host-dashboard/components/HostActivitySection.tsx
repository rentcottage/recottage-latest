import { useMemo } from 'react';

interface Booking {
  id: string;
  user_name: string | null;
  user_email: string;
  property_title: string;
  status: string;
  created_at: string;
  date_change_status: string | null;
  date_change_requested_at: string | null;
  check_in: string;
  check_out: string;
  total_price: number | null;
}

interface ActivityItem {
  id: string;
  type: 'new_booking' | 'confirmed' | 'cancelled' | 'date_change' | 'completed';
  label: string;
  sub: string;
  time: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}

interface Props {
  bookings: Booking[];
  loading: boolean;
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function HostActivitySection({ bookings, loading }: Props) {
  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    bookings.forEach((b) => {
      const guestName = b.user_name || b.user_email.split('@')[0];

      // New booking request
      items.push({
        id: `booking-${b.id}`,
        type: 'new_booking',
        label: `New booking request from ${guestName}`,
        sub: `${b.property_title} · ${b.total_price ? `₾${b.total_price}` : ''}`,
        time: b.created_at,
        icon: 'ri-calendar-add-line',
        iconBg: 'bg-sky-50',
        iconColor: 'text-sky-600',
      });

      // Status changes
      if (b.status === 'confirmed') {
        items.push({
          id: `confirmed-${b.id}`,
          type: 'confirmed',
          label: `Booking confirmed for ${guestName}`,
          sub: b.property_title,
          time: b.created_at,
          icon: 'ri-checkbox-circle-line',
          iconBg: 'bg-green-50',
          iconColor: 'text-green-600',
        });
      }

      if (b.status === 'cancelled') {
        items.push({
          id: `cancelled-${b.id}`,
          type: 'cancelled',
          label: `Booking cancelled by ${guestName}`,
          sub: b.property_title,
          time: b.created_at,
          icon: 'ri-close-circle-line',
          iconBg: 'bg-red-50',
          iconColor: 'text-red-500',
        });
      }

      if (b.status === 'completed') {
        items.push({
          id: `completed-${b.id}`,
          type: 'completed',
          label: `Stay completed — ${guestName} checked out`,
          sub: b.property_title,
          time: b.created_at,
          icon: 'ri-star-line',
          iconBg: 'bg-gray-100',
          iconColor: 'text-gray-600',
        });
      }

      // Date change requests
      if (b.date_change_status && b.date_change_requested_at) {
        items.push({
          id: `datechange-${b.id}`,
          type: 'date_change',
          label: `Date change request from ${guestName}`,
          sub: `${b.property_title} · ${b.date_change_status === 'pending' ? 'Awaiting your response' : b.date_change_status}`,
          time: b.date_change_requested_at,
          icon: 'ri-calendar-2-line',
          iconBg: 'bg-amber-50',
          iconColor: 'text-amber-600',
        });
      }
    });

    // Sort by time, newest first
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [bookings]);

  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const dateChangeCount = bookings.filter((b) => b.date_change_status === 'pending').length;

  return (
    <div>
      <div className="mb-5 md:mb-6">
        <h2 className="text-base md:text-xl font-bold text-gray-900">Notifications &amp; Activity</h2>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5">Recent booking activity and requests across your properties</p>
      </div>

      {/* Alert banners */}
      <div className="space-y-2 md:space-y-3 mb-5 md:mb-6">
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 md:gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 md:px-5 py-3 md:py-3.5">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-time-line text-amber-600 text-xs md:text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm font-semibold text-amber-800">
                {pendingCount} pending booking {pendingCount === 1 ? 'request' : 'requests'}
              </p>
              <p className="text-xs text-amber-600 hidden sm:block">Admin will review and confirm or reject on your behalf</p>
            </div>
          </div>
        )}
        {dateChangeCount > 0 && (
          <div className="flex items-center gap-2 md:gap-3 bg-sky-50 border border-sky-200 rounded-xl px-3 md:px-5 py-3 md:py-3.5">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-calendar-2-line text-sky-600 text-xs md:text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm font-semibold text-sky-800">
                {dateChangeCount} date change {dateChangeCount === 1 ? 'request' : 'requests'} pending
              </p>
              <p className="text-xs text-sky-600 hidden sm:block">Guests are requesting date modifications for their bookings</p>
            </div>
          </div>
        )}
      </div>

      {/* Activity feed */}
      <div className="bg-white rounded-card border border-line shadow-card">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Activity Feed</h3>
          <span className="text-xs text-gray-400">{activities.length} events</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 flex items-center justify-center animate-spin">
                <i className="ri-loader-4-line"></i>
              </div>
              <span className="text-sm">Loading activity…</span>
            </div>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <div className="w-10 h-10 flex items-center justify-center mb-2">
              <i className="ri-notification-off-line text-3xl"></i>
            </div>
            <p className="text-sm">No activity yet</p>
            <p className="text-xs mt-1">Activity from bookings will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50/60 transition-colors">
                <div className={`w-8 h-8 md:w-9 md:h-9 ${a.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <i className={`${a.icon} ${a.iconColor} text-xs md:text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium text-gray-900">{a.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{a.sub}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(a.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
