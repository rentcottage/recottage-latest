import { useState } from 'react';
import { Link } from 'react-router-dom';
import ContactModal from './ContactModal';
import CancellationModal from './CancellationModal';

/**
 * Shared dark footer — the "new look" mockup design. Self-contained: it owns its
 * Contact + Cancellation modals so every page can drop in `<Footer />` and the
 * support links work without extra wiring. Internal links use React Router `Link`
 * (real <a href> for crawlers + client-side navigation).
 */
export default function Footer() {
  const [showContact, setShowContact] = useState(false);
  const [showCancellation, setShowCancellation] = useState(false);
  const year = new Date().getFullYear();

  const linkClass =
    'text-left opacity-85 hover:opacity-100 hover:text-white transition-opacity cursor-pointer';

  return (
    <>
      <footer className="bg-[#181818] text-gray-300 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-14 pb-8">
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
                Georgia&apos;s #1 platform for booking cottages — directly from hosts,
                with no hidden fees.
              </p>
              <div className="flex flex-wrap gap-2">
                {['VISA', 'Mastercard', 'TBC', 'BOG', 'Installment'].map((p) => (
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
              <h4 className="text-white text-[14.5px] font-bold mb-3">Explore</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/search" className={linkClass}>Search</Link>
                <Link to="/how-it-works" className={linkClass}>How It Works</Link>
                <Link to="/about-georgia" className={linkClass}>About Georgia</Link>
                <Link to="/sitemap" className={linkClass}>Site Map</Link>
              </nav>
            </div>

            {/* For hosts */}
            <div>
              <h4 className="text-white text-[14.5px] font-bold mb-3">For Hosts</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/become-host" className={linkClass}>Become a Host</Link>
                <Link to="/host-resources" className={linkClass}>Host Resources</Link>
              </nav>
            </div>

            {/* Support & contact */}
            <div>
              <h4 className="text-white text-[14.5px] font-bold mb-3">Support</h4>
              <nav className="flex flex-col gap-2">
                <button type="button" onClick={() => setShowContact(true)} className={linkClass}>
                  Contact Us
                </button>
                <button type="button" onClick={() => setShowCancellation(true)} className={linkClass}>
                  Cancellation Options
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
            <span>© {year} RentCottage.Ge · All rights reserved</span>
            <span className="flex items-center gap-2">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <span className="opacity-40">·</span>
              <Link to="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link>
            </span>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
      <CancellationModal isOpen={showCancellation} onClose={() => setShowCancellation(false)} />
    </>
  );
}
