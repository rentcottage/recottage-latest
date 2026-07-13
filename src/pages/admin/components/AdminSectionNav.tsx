import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@lib/i18n';

/**
 * Jump navigation for the admin page sections.
 *
 * The admin panel is a single long page of stacked section cards; this nav
 * makes each one reachable in a click. Sections stay mounted (badge counters
 * and lazy fetches keep working) — the nav only scrolls, never hides content.
 *
 * Variants:
 *  - `sidebar`: sticky vertical menu on the left (desktop, lg+)
 *  - `chips`:   horizontal scrollable pill row inside the sticky header (mobile)
 *
 * Each entry's `id` must match the `id` of a section wrapper in page.tsx
 * (which also needs `scroll-mt-*` so the sticky header doesn't cover it).
 */
export const ADMIN_SECTIONS = [
  { id: 'overview',            labelKey: 'admin.nav.overview',           icon: 'ri-dashboard-line' },
  { id: 'bookings',            labelKey: 'admin.nav.bookings',           icon: 'ri-calendar-check-line' },
  { id: 'date-changes',        labelKey: 'admin.nav.dateChanges',        icon: 'ri-calendar-2-line' },
  { id: 'host-applications',   labelKey: 'admin.nav.hostApplications',   icon: 'ri-home-smile-line' },
  { id: 'corporate',           labelKey: 'admin.nav.travelAgencies',     icon: 'ri-briefcase-line' },
  { id: 'experiences',         labelKey: 'admin.nav.experiences',        icon: 'ri-goblet-line' },
  { id: 'promos',              labelKey: 'admin.nav.promos',             icon: 'ri-price-tag-3-line' },
  { id: 'experience-bookings', labelKey: 'admin.nav.experienceBookings', icon: 'ri-ticket-2-line' },
  { id: 'completed-bookings',  labelKey: 'admin.nav.completedStays',     icon: 'ri-medal-line' },
  { id: 'users',               labelKey: 'admin.nav.users',              icon: 'ri-user-settings-line' },
  { id: 'host-news',           labelKey: 'admin.nav.hostNews',           icon: 'ri-megaphone-line' },
  { id: 'payment-logs',        labelKey: 'admin.nav.paymentLogs',        icon: 'ri-file-shield-2-line' },
] as const;

type SectionId = (typeof ADMIN_SECTIONS)[number]['id'];

interface AdminSectionNavProps {
  variant: 'sidebar' | 'chips';
  /** Pending counts shown as badges, keyed by section id. Zero/missing = no badge. */
  badges?: Partial<Record<SectionId, number>>;
}

/** Vertical gap between the sticky header and the pinned sidebar (px). */
const PIN_TOP = 96;

export default function AdminSectionNav({ variant, badges = {} }: AdminSectionNavProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<SectionId>(ADMIN_SECTIONS[0].id);
  // Sidebar pinning is done in JS with position:fixed instead of CSS sticky:
  // Google Translate (active for most Georgian admin sessions) injects
  // overflow-x:hidden on <html>/<body>, which silently disables
  // position:sticky in Chromium. The wrapper div stays in normal flow as the
  // position/width anchor; the <nav> pops out to fixed once it reaches the top.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState<{ left: number; width: number } | null>(null);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;

  // Scroll-spy + sidebar pinning share one rAF-throttled listener.
  // Active section = the last one whose top edge has passed the header line.
  useEffect(() => {
    let raf = 0;
    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let current: SectionId = ADMIN_SECTIONS[0].id;
        for (const s of ADMIN_SECTIONS) {
          const el = document.getElementById(s.id);
          if (el && el.getBoundingClientRect().top <= 150) current = s.id;
        }
        setActive(current);

        const wrap = wrapRef.current;
        if (wrap) {
          const r = wrap.getBoundingClientRect();
          const prev = pinnedRef.current;
          if (r.top <= PIN_TOP) {
            if (!prev || Math.abs(prev.left - r.left) > 0.5 || Math.abs(prev.width - r.width) > 0.5) {
              setPinned({ left: r.left, width: r.width });
            }
          } else if (prev) {
            setPinned(null);
          }
        }
      });
    };
    onScrollOrResize();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const jumpTo = (id: SectionId) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (variant === 'chips') {
    return (
      <nav aria-label={t('admin.nav.ariaLabel')} className="flex gap-1.5 overflow-x-auto pb-0.5">
        {ADMIN_SECTIONS.map((s) => {
          const badge = badges[s.id] ?? 0;
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => jumpTo(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors flex-shrink-0 ${
                isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <i className={`${s.icon} text-sm`}></i>
              {t(s.labelKey)}
              {badge > 0 && (
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  isActive ? 'bg-white text-gray-900' : 'bg-amber-400 text-amber-950'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <div ref={wrapRef}>
      <nav
        aria-label={t('admin.nav.ariaLabel')}
        className="bg-white rounded-card border border-line shadow-card p-2"
        style={pinned ? {
          position: 'fixed',
          top: PIN_TOP,
          left: pinned.left,
          width: pinned.width,
          zIndex: 30,
          maxHeight: `calc(100vh - ${PIN_TOP + 16}px)`,
          overflowY: 'auto',
        } : undefined}
      >
      {ADMIN_SECTIONS.map((s) => {
        const badge = badges[s.id] ?? 0;
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => jumpTo(s.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors ${
              isActive
                ? 'bg-red-50 text-red-600 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <i className={`${s.icon} text-base flex-shrink-0 ${isActive ? 'text-red-500' : 'text-gray-400'}`}></i>
            <span className="flex-1 truncate">{t(s.labelKey)}</span>
            {badge > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                {badge}
              </span>
            )}
          </button>
        );
      })}
      </nav>
    </div>
  );
}
