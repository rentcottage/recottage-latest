import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';
import Home from '../pages/home/page';
import { useT } from '../i18n';

// Route-level code splitting: every page except Home loads its own chunk on
// demand. Before this, all 22 pages (admin panel, host dashboard, corporate,
// booking flows…) shipped in ONE 1.3 MB bundle that every visitor had to
// download and parse before the homepage could render.
//
// lazyPage wraps React.lazy with a one-shot recovery: a deploy replaces the
// hashed chunk files, so a tab opened before the deploy 404s when it first
// navigates to a not-yet-loaded page. Reload once to pick up fresh HTML;
// if the import fails again (real outage), rethrow so it isn't an endless
// reload loop.
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  const RETRY_KEY = 'rc_chunk_reloaded';
  return lazy(() =>
    load()
      .then((mod) => {
        sessionStorage.removeItem(RETRY_KEY);
        return mod;
      })
      .catch((err) => {
        if (!sessionStorage.getItem(RETRY_KEY)) {
          sessionStorage.setItem(RETRY_KEY, '1');
          window.location.reload();
          return new Promise<never>(() => {}); // hold Suspense while reloading
        }
        throw err;
      }),
  );
}

const SearchResults = lazyPage(() => import('../pages/search/page'));
const PropertyDetail = lazyPage(() => import('../pages/property/page'));
const Profile = lazyPage(() => import('../pages/profile/page'));
const BecomeHost = lazyPage(() => import('../pages/become-host/page'));
const NotFound = lazyPage(() => import('../pages/NotFound'));
const Privacy = lazyPage(() => import('../pages/privacy/page'));
const Terms = lazyPage(() => import('../pages/terms/page'));
const HostResources = lazyPage(() => import('../pages/host-resources/page'));
const HowItWorks = lazyPage(() => import('../pages/how-it-works/page'));
const AboutGeorgia = lazyPage(() => import('../pages/about-georgia/page'));
const SiteMap = lazyPage(() => import('../pages/sitemap/page'));
const BookExperience = lazyPage(() => import('../pages/book-experience/page'));
const Login = lazyPage(() => import('../pages/login/page'));
const Register = lazyPage(() => import('../pages/register/page'));
const AuthCallback = lazyPage(() => import('../pages/auth-callback/page'));
const ResetPassword = lazyPage(() => import('../pages/auth-reset-password/page'));
const AdminBookings = lazyPage(() => import('../pages/admin/page'));
const HostDashboard = lazyPage(() => import('../pages/host-dashboard/page'));
const PaymentSuccess = lazyPage(() => import('../pages/payment-success/page'));
const PaymentFailed = lazyPage(() => import('../pages/payment-failed/page'));
const CorporatePage = lazyPage(() => import('../pages/corporate/page'));
const CorporateDashboard = lazyPage(() => import('../pages/corporate/dashboard/page'));

// Minimal centered spinner shown only during a lazy chunk fetch (~50-200 ms).
function RouteFallback() {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 flex items-center justify-center animate-spin">
          <i className="ri-loader-4-line text-xl"></i>
        </div>
        <span className="text-sm">{t('common.loading')}</span>
      </div>
    </div>
  );
}

function page(Component: ComponentType) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Home />
  },
  {
    path: '/search',
    element: page(SearchResults)
  },
  {
    path: '/property/:id',
    element: page(PropertyDetail)
  },
  {
    path: '/profile',
    element: page(Profile)
  },
  {
    path: '/become-host',
    element: page(BecomeHost)
  },
  {
    path: '/privacy',
    element: page(Privacy)
  },
  {
    path: '/terms',
    element: page(Terms)
  },
  {
    path: '/host-resources',
    element: page(HostResources)
  },
  {
    path: '/how-it-works',
    element: page(HowItWorks)
  },
  {
    path: '/about-georgia',
    element: page(AboutGeorgia)
  },
  {
    path: '/sitemap',
    element: page(SiteMap)
  },
  {
    path: '/book-experience',
    element: page(BookExperience)
  },
  {
    path: '/login',
    element: page(Login)
  },
  {
    path: '/register',
    element: page(Register)
  },
  {
    path: '/auth/callback',
    element: page(AuthCallback)
  },
  {
    path: '/auth/reset-password',
    element: page(ResetPassword)
  },
  {
    path: '/admin',
    element: page(AdminBookings)
  },
  {
    path: '/host-dashboard',
    element: page(HostDashboard)
  },
  {
    path: '/corporate',
    element: page(CorporatePage)
  },
  {
    path: '/corporate/dashboard',
    element: page(CorporateDashboard)
  },
  {
    path: '/payment/success',
    element: page(PaymentSuccess)
  },
  {
    path: '/payment/failed',
    element: page(PaymentFailed)
  },
  {
    path: '*',
    element: page(NotFound)
  }
];

export default routes;
