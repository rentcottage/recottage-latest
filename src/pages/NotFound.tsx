import { Link } from 'react-router-dom';
import Header from '../components/feature/Header';
import Footer from '../components/feature/Footer';
import SEO from '../components/feature/SEO';
import { useTranslation } from '../lib/i18n';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO
        title="Page not found — RentCottage.Ge"
        description="The page you were looking for does not exist or has been moved."
        noIndex
      />
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 md:py-28">
        {/* 4🏚4 — tilted cottage between the digits (mockup) */}
        <p className="font-extrabold text-red-500 leading-none tracking-tight" style={{ fontSize: 'clamp(80px,14vw,130px)' }}>
          4<span className="inline-block rotate-12" translate="no">🏚</span>4
        </p>
        <h1 className="mt-4 text-2xl md:text-3xl font-extrabold text-ink">{t('notFound.title')}</h1>
        <p className="mt-3 max-w-md text-base md:text-lg text-soft">
          {t('notFound.description')}
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-home-5-line"></i>
          {t('notFound.backHome')}
        </Link>

        {/* Alternative destinations */}
        <div className="flex flex-wrap justify-center gap-3 mt-7">
          {[
            { to: '/search', label: t('notFound.searchCottages') },
            { to: '/about-georgia', label: t('notFound.whereToStay') },
            { to: '/book-experience', label: t('notFound.experiences') },
          ].map((alt) => (
            <Link
              key={alt.to}
              to={alt.to}
              className="border-[1.5px] border-line rounded-full px-4 py-2 text-[13.5px] font-bold text-gray-600 hover:border-red-500 hover:text-red-500 transition-colors cursor-pointer whitespace-nowrap"
            >
              {alt.label}
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
