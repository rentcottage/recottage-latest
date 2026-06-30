import Header from '../components/feature/Header';
import SEO from '../components/feature/SEO';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO
        title="Page not found — RentCottage.Ge"
        description="The page you were looking for does not exist or has been moved."
        noIndex
      />
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
        <p className="text-7xl md:text-8xl font-extrabold text-red-500 leading-none">404</p>
        <h1 className="mt-6 text-2xl md:text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-3 max-w-md text-base md:text-lg text-gray-500">
          The page you were looking for does not exist or has been moved.
        </p>
        <a
          href="/"
          className="mt-8 inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-home-5-line"></i>
          Back to home
        </a>
      </main>
    </div>
  );
}
