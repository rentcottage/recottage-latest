import { RouteObject } from 'react-router-dom';
import Home from '../pages/home/page';
import SearchResults from '../pages/search/page';
import PropertyDetail from '../pages/property/page';
import Profile from '../pages/profile/page';
import BecomeHost from '../pages/become-host/page';
import NotFound from '../pages/NotFound';
import Privacy from '../pages/privacy/page';
import Terms from '../pages/terms/page';
import HostResources from '../pages/host-resources/page';
import HowItWorks from '../pages/how-it-works/page';
import AboutGeorgia from '../pages/about-georgia/page';
import SiteMap from '../pages/sitemap/page';
import BookExperience from '../pages/book-experience/page';
import AuthCallback from '../pages/auth-callback/page';
import ResetPassword from '../pages/auth-reset-password/page';
import AdminBookings from '../pages/admin/page';
import HostDashboard from '../pages/host-dashboard/page';
import PaymentSuccess from '../pages/payment-success/page';
import PaymentFailed from '../pages/payment-failed/page';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Home />
  },
  {
    path: '/search',
    element: <SearchResults />
  },
  {
    path: '/property/:id',
    element: <PropertyDetail />
  },
  {
    path: '/profile',
    element: <Profile />
  },
  {
    path: '/become-host',
    element: <BecomeHost />
  },
  {
    path: '/privacy',
    element: <Privacy />
  },
  {
    path: '/terms',
    element: <Terms />
  },
  {
    path: '/host-resources',
    element: <HostResources />
  },
  {
    path: '/how-it-works',
    element: <HowItWorks />
  },
  {
    path: '/about-georgia',
    element: <AboutGeorgia />
  },
  {
    path: '/sitemap',
    element: <SiteMap />
  },
  {
    path: '/book-experience',
    element: <BookExperience />
  },
  {
    path: '/auth/callback',
    element: <AuthCallback />
  },
  {
    path: '/auth/reset-password',
    element: <ResetPassword />
  },
  {
    path: '/admin',
    element: <AdminBookings />
  },
  {
    path: '/host-dashboard',
    element: <HostDashboard />
  },
  {
    path: '/payment/success',
    element: <PaymentSuccess />,
  },
  {
    path: '/payment/failed',
    element: <PaymentFailed />,
  },
  {
    path: '*',
    element: <NotFound />
  }
];

export default routes;
