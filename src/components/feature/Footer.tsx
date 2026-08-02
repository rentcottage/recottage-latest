import { useState } from 'react';
import { Link } from 'react-router-dom';
import ContactModal from './ContactModal';
import CancellationModal from './CancellationModal';
import { useT } from '../../i18n';

/**
 * Shared dark footer — the "new look" mockup design. Self-contained: it owns its
 * Contact + Cancellation modals so every page can drop in `<Footer />` and the
 * support links work without extra wiring. Internal links use React Router `Link`
 * (real <a href> for crawlers + client-side navigation).
 */
export default function Footer() {
  const { t } = useT();
  const [showContact, setShowContact] = useState(false);
  const [showCancellation, setShowCancellation] = useState(false);
  const year = new Date().getFullYear();

  const linkClass =
    'text-left opacity-85 hover:opacity-100 hover:text-white transition-opacity cursor-pointer';

  return (
    <>
      <footer className="bg-[#181818] text-gray-300 text-sm">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-14 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-x-6 gap-y-9 md:gap-8 mb-9">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <h2
                translate="no"
                className="notranslate text-xl font-extrabold text-white mb-2.5"
                style={{ fontFamily: '"Futura", "Arial", sans-serif', fontWeight: 800 }}
              >
                Rent<span className="text-red-500">Cottage</span>.Ge
              </h2>
              <p className="text-gray-400 max-w-[280px] leading-relaxed mb-4">
                {t('footer.tagline')}
              </p>
              <div className="flex flex-wrap gap-2">
                {['VISA', 'Mastercard', 'TBC', 'BOG'].map((p) => (
                  <span
                    key={p}
                    className="bg-white/10 rounded-md px-2.5 py-1 text-xs font-semibold text-gray-200"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Explore */}
            <div>
              <h4 className="text-white text-[14.5px] font-bold mb-3">{t('footer.explore')}</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/search" className={linkClass}>{t('footer.search')}</Link>
                <Link to="/how-it-works" className={linkClass}>{t('footer.howItWorks')}</Link>
                <Link to="/about-georgia" className={linkClass}>{t('footer.aboutGeorgia')}</Link>
                <Link to="/sitemap" className={linkClass}>{t('footer.siteMap')}</Link>
              </nav>
            </div>

            {/* For hosts */}
            <div>
              <h4 className="text-white text-[14.5px] font-bold mb-3">{t('footer.forHosts')}</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/become-host" className={linkClass}>{t('footer.becomeHost')}</Link>
                <Link to="/host-resources" className={linkClass}>{t('footer.hostResources')}</Link>
              </nav>
            </div>

            {/* Support & contact */}
            <div>
              <h4 className="text-white text-[14.5px] font-bold mb-3">{t('footer.support')}</h4>
              <nav className="flex flex-col gap-2">
                <button type="button" onClick={() => setShowContact(true)} className={linkClass}>
                  {t('footer.contactUs')}
                </button>
                <button type="button" onClick={() => setShowCancellation(true)} className={linkClass}>
                  {t('footer.cancellationOptions')}
                </button>
                <a href="mailto:info.rentcottage@gmail.com" className={linkClass}>
                  info.rentcottage@gmail.com
                </a>
              </nav>
              <div className="flex items-center gap-3 mt-4">
                <a
                  href="https://www.facebook.com/profile.php?id=61583084123461"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <i className="ri-facebook-fill text-gray-200"></i>
                </a>
                <a
                  href="https://www.instagram.com/rentcottage.ge/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <i className="ri-instagram-line text-gray-200"></i>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/15 pt-5 flex flex-col sm:flex-row justify-between items-center gap-2.5 text-xs text-gray-400">
            <span>{t('footer.rights', { year })}</span>
            <span className="flex items-center gap-2">
              <Link to="/privacy" className="hover:text-white transition-colors">{t('footer.privacy')}</Link>
              <span className="opacity-40">·</span>
              <Link to="/terms" className="hover:text-white transition-colors">{t('footer.terms')}</Link>
            </span>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
      <CancellationModal isOpen={showCancellation} onClose={() => setShowCancellation(false)} />
    </>
  );
}
