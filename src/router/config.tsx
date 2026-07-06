import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';
import Home from '../pages/home/page';

// Route-level code splitting: every page except Home loads its own chunk on
// demand. Before this, all 22 pages (admin panel, host dashboard, corporate,
// booking flows…) shipped in ONE 1.3 MB bundle that every visitor had to
// download and parse before the homepage could render.
const SearchResults = lazy(() => import('../pages/search/page'));
const PropertyDetail = lazy(() => import('../pages/property/page'));
const Profile = lazy(() => import('../pages/profile/page'));
const BecomeHost = lazy(() => import('../pages/become-host/page'));
const NotFound = lazy(() => import('../pages/NotFound'));
const Privacy = lazy(() => import('../pages/privacy/page'));
const Terms = lazy(() => import('../pages/terms/page'));
const HostResources = lazy(() => import('../pages/host-resources/page'));
const HowItWorks = lazy(() => import('../pages/how-it-works/page'));
const AboutGeorgia = lazy(() => import('../pages/about-georgia/page'));
const SiteMap = lazy(() => import('../pages/sitemap/page'));
const BookExperience = lazy(() => import('../pages/book-experience/page'));
const AuthCallback = lazy(() => import('../pages/auth-callback/page'));
const ResetPassword = lazy(() => import('../pages/auth-reset-password/page'));
const AdminBookings = lazy(() => import('../pages/admin/page'));
const HostDashboard = lazy(() => import('../pages/host-dashboard/page'));
const PaymentSuccess = lazy(() => import('../pages/payment-success/page'));
const PaymentFailed = lazy(() => import('../pages/payment-failed/page'));
const CorporatePage = lazy(() => import('../pages/corporate/page'));
const CorporateDashboard = lazy(() => import('../pages/corporate/dashboard/page'));

// Minimal centered spinner shown only during a lazy chunk fetch (~50-200 ms).
function RouteFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 flex items-center justify-center animate-spin">
          <i className="ri-loader-4-line text-xl"></i>
        </div>
        <span className="text-sm">Loading…</span>
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
