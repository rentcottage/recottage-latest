import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, signOutUser } from '../../hooks/useAuth';
import LanguageSelector from './LanguageSelector';
import CancellationModal from './CancellationModal';

interface HeaderProps {
  onStaysClick?: () => void;
  onExperiencesClick?: () => void;
}

export default function Header({}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMobileHelpModal, setShowMobileHelpModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, loading } = useAuth();

  const handleLogout = () => {
    // Close menus and navigate immediately — no waiting on network
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    navigate('/');
    // Fire signout in background (non-blocking)
    signOutUser();
  };

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (!(e.target as Element).closest('.user-menu-container')) {
      setIsUserMenuOpen(false);
    }
  };

  // Close mobile menu on navigation
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  const mobileNavTo = (path: string) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  return (
    <div onClick={handleOutsideClick}>
      {/* Sticky blurred header — mockup "new look" */}
      <header className="sticky top-0 z-50 border-b border-line bg-[rgba(255,255,255,0.94)] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 md:h-[68px] gap-4">

            {/* Logo */}
            <h1
              translate="no"
              className="notranslate text-lg md:text-[21px] font-extrabold text-ink cursor-pointer whitespace-nowrap tracking-tight"
              style={{ fontFamily: '"Futura", "Arial", sans-serif', fontWeight: 800 }}
              onClick={() => navigate('/')}
            >
              Rent<span className="text-red-500">Cottage</span>.Ge
            </h1>

            {/* ── Desktop nav links ── */}
            <nav className="hidden md:flex items-center gap-6 ml-auto text-[14.5px] font-medium text-gray-700">
              <button
                onClick={() => navigate('/search')}
                className="hover:text-red-500 transition-colors cursor-pointer whitespace-nowrap"
              >
                Search
              </button>
              <button
                onClick={() => navigate('/how-it-works')}
                className="hover:text-red-500 transition-colors cursor-pointer whitespace-nowrap"
              >
                How It Works
              </button>
              <button
                onClick={() => navigate('/about-georgia')}
                className="hover:text-red-500 transition-colors cursor-pointer whitespace-nowrap"
              >
                About Georgia
              </button>
              <button
                onClick={() => navigate('/become-host')}
                className="hover:text-red-500 transition-colors cursor-pointer whitespace-nowrap"
              >
                Become a Host
              </button>
            </nav>

            {/* ── Desktop right cluster ── */}
            <div className="hidden md:flex items-center gap-2">
              {/* Pill language control */}
              <div className="flex items-center rounded-full border border-line px-1.5 py-0.5 hover:border-gray-300 transition-colors">
                <LanguageSelector variant="desktop" />
              </div>

              {/* Ghost "Log in" — logged out only (mockup CTA) */}
              {!loading && !isLoggedIn && (
                <button
                  onClick={() => navigate('/login')}
                  className="border-[1.5px] border-red-500 text-red-500 hover:bg-red-50 font-semibold rounded-xl px-4 py-2 text-sm cursor-pointer transition-colors whitespace-nowrap"
                >
                  Log in
                </button>
              )}

              {/* Account menu */}
              <div className="relative user-menu-container">
                <div
                  className="flex items-center border border-gray-300 rounded-full p-1 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setIsUserMenuOpen((o) => !o); }}
                >
                  <div className="w-8 h-8 flex items-center justify-center">
                    <i className="ri-menu-line text-gray-700"></i>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ml-1 ${isLoggedIn ? 'bg-red-500' : 'bg-gray-500'}`}>
                    <i className="ri-user-line text-white"></i>
                  </div>
                </div>

                {isUserMenuOpen && !loading && (
                  <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                    {isLoggedIn ? (
                      <>
                        <MenuItem icon="ri-user-line" label="My Profile" onClick={() => { navigate('/profile'); setIsUserMenuOpen(false); }} />
                        <MenuItem icon="ri-layout-line" label="Host Dashboard" onClick={() => { navigate('/host-dashboard'); setIsUserMenuOpen(false); }} />
                        <MenuItem icon="ri-home-heart-line" label="Become a Host" onClick={() => { navigate('/become-host'); setIsUserMenuOpen(false); }} />
                        <div className="border-t border-gray-100 my-2" />
                        <MenuItem icon="ri-logout-box-line" label="Log out" onClick={handleLogout} />
                        <div className="border-t border-gray-100 my-2" />
                        <MenuItem icon="ri-question-line" label="Help Center" onClick={() => { setShowHelpModal(true); setIsUserMenuOpen(false); }} />
                      </>
                    ) : (
                      <>
                        <MenuItem icon="ri-user-add-line" label="Sign up" onClick={() => { navigate('/register'); setIsUserMenuOpen(false); }} bold />
                        <MenuItem icon="ri-login-box-line" label="Log in" onClick={() => { navigate('/login'); setIsUserMenuOpen(false); }} />
                        <div className="border-t border-gray-100 my-2" />
                        <MenuItem icon="ri-home-heart-line" label="Become a Host" onClick={() => { navigate('/become-host'); setIsUserMenuOpen(false); }} />
                        <div className="border-t border-gray-100 my-2" />
                        <MenuItem icon="ri-question-line" label="Help Center" onClick={() => { setShowHelpModal(true); setIsUserMenuOpen(false); }} />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Mobile right side ── */}
            <div className="md:hidden flex items-center gap-2 ml-auto">
              {/* Quick login pill — only when logged out */}
              {!loading && !isLoggedIn && (
                <button
                  onClick={() => navigate('/login')}
                  className="text-xs font-semibold text-red-500 border border-red-500 hover:bg-red-50 px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition-colors"
                >
                  Log in
                </button>
              )}
              {/* User avatar dot — when logged in */}
              {!loading && isLoggedIn && (
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-user-line text-white text-sm"></i>
                </div>
              )}
              {/* Hamburger */}
              <button
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => setIsMenuOpen(true)}
                aria-label="Open menu"
              >
                <i className="ri-menu-3-line text-gray-700 text-xl"></i>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* ── Mobile full-screen menu overlay ── */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col bg-white">
          {/* Overlay header */}
          <div className="flex items-center justify-between px-5 h-14 border-b border-gray-100 flex-shrink-0">
            <h1
              translate="no"
              className="notranslate text-lg font-bold text-gray-900 cursor-pointer whitespace-nowrap"
              style={{ fontFamily: '"Futura", "Arial", sans-serif', fontWeight: '700' }}
              onClick={() => mobileNavTo('/')}
            >
              Rent<span className="text-red-500">Cottage</span>.Ge
            </h1>
            <button
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer transition-colors"
              onClick={() => setIsMenuOpen(false)}
              aria-label="Close menu"
            >
              <i className="ri-close-line text-gray-700 text-xl"></i>
            </button>
          </div>

          {/* Auth status banner */}
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-user-line text-white"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">My Account</p>
                  <p className="text-xs text-gray-500">Logged in</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setIsMenuOpen(false); navigate('/register'); }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                >
                  Sign up
                </button>
                <button
                  onClick={() => { setIsMenuOpen(false); navigate('/login'); }}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
                >
                  Log in
                </button>
              </div>
            )}
          </div>

          {/* Nav items */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {isLoggedIn && (
              <>
                <MobileMenuItem icon="ri-user-line" label="My Profile" onClick={() => mobileNavTo('/profile')} />
                <MobileMenuItem icon="ri-layout-line" label="Host Dashboard" onClick={() => mobileNavTo('/host-dashboard')} />
                <div className="border-t border-gray-100 my-2" />
              </>
            )}

            <MobileMenuItem icon="ri-home-heart-line" label="Become a Host" onClick={() => mobileNavTo('/become-host')} />
            <MobileMenuItem icon="ri-search-line" label="Search Cottages" onClick={() => mobileNavTo('/search')} />
            <MobileMenuItem icon="ri-map-pin-line" label="About Georgia" onClick={() => mobileNavTo('/about-georgia')} />
            <MobileMenuItem icon="ri-information-line" label="How It Works" onClick={() => mobileNavTo('/how-it-works')} />

            <div className="border-t border-gray-100 my-2" />

            <MobileMenuItem icon="ri-question-line" label="Help Center" onClick={() => { setIsMenuOpen(false); setShowMobileHelpModal(true); }} />

            <div className="border-t border-gray-100 my-2" />
            <LanguageSelector variant="mobile" onClose={() => setIsMenuOpen(false)} />

            {isLoggedIn && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <MobileMenuItem icon="ri-logout-box-line" label="Log out" onClick={handleLogout} danger />
              </>
            )}
          </div>
        </div>
      )}

      {/* Help Center Modal — Desktop only (unchanged) */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Help Center</h2>
                <button onClick={() => setShowHelpModal(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="ri-search-line text-gray-400"></i>
                </div>
                <input type="text" placeholder="Search for help..." className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm" />
              </div>
              <div className="mb-6">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Popular Topics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { icon: 'ri-home-line', title: 'Booking a Cottage', desc: 'How to search and book your perfect stay' },
                    { icon: 'ri-calendar-line', title: 'Cancellation Policy', desc: 'Understanding our cancellation terms' },
                    { icon: 'ri-shield-check-line', title: 'Safety & Security', desc: 'Your safety is our top priority' },
                    { icon: 'ri-money-dollar-circle-line', title: 'Payment & Pricing', desc: 'Payment methods and pricing info' },
                    { icon: 'ri-customer-service-line', title: 'Host Communication', desc: 'How to contact your host' },
                    { icon: 'ri-map-pin-line', title: 'Travel Guidelines', desc: 'Tips for traveling in Georgia' },
                  ].map((topic, index) => (
                    <div key={index} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className="flex items-start">
                        <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                          <i className={`${topic.icon} text-red-500 text-sm`}></i>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-0.5 text-sm">{topic.title}</h4>
                          <p className="text-xs text-gray-600">{topic.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-base font-semibold text-gray-900 mb-3">Still need help?</h3>
                <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => { setShowHelpModal(false); navigate('/'); }} className="flex items-center p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                    <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                      <i className="ri-mail-line text-red-500 text-sm"></i>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900 text-sm">Email Support</p>
                      <p className="text-xs text-gray-600">info.rentcottage@gmail.com</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Help Center Modal — Mobile only */}
      {showMobileHelpModal && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-[70] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">Help Center</h2>
              <button
                onClick={() => setShowMobileHelpModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <i className="ri-close-line text-gray-600 text-xl"></i>
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm text-gray-500 mb-5">What do you need help with?</p>

              {/* 4 help topics */}
              <div className="space-y-3">
                {/* Booking a Cottage */}
                <button
                  onClick={() => { setShowMobileHelpModal(false); navigate('/how-it-works'); }}
                  className="w-full flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                    <i className="ri-home-line text-red-500 text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Booking a Cottage</p>
                    <p className="text-xs text-gray-500 mt-0.5">How to search and book your perfect stay</p>
                  </div>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i className="ri-arrow-right-s-line text-gray-300 text-base"></i>
                  </div>
                </button>

                {/* Cancellation Policy */}
                <button
                  onClick={() => { setShowMobileHelpModal(false); setShowCancellationModal(true); }}
                  className="w-full flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                    <i className="ri-calendar-line text-red-500 text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Cancellation Policy</p>
                    <p className="text-xs text-gray-500 mt-0.5">Understanding our cancellation terms</p>
                  </div>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i className="ri-arrow-right-s-line text-gray-300 text-base"></i>
                  </div>
                </button>

                {/* Safety & Security */}
                <button
                  onClick={() => { setShowMobileHelpModal(false); navigate('/how-it-works'); }}
                  className="w-full flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                    <i className="ri-shield-check-line text-red-500 text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Safety &amp; Security</p>
                    <p className="text-xs text-gray-500 mt-0.5">Your safety is our top priority</p>
                  </div>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i className="ri-arrow-right-s-line text-gray-300 text-base"></i>
                  </div>
                </button>

                {/* Payment & Pricing */}
                <button
                  onClick={() => { setShowMobileHelpModal(false); navigate('/how-it-works'); }}
                  className="w-full flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                    <i className="ri-money-dollar-circle-line text-red-500 text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Payment &amp; Pricing</p>
                    <p className="text-xs text-gray-500 mt-0.5">Payment methods and pricing info</p>
                  </div>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i className="ri-arrow-right-s-line text-gray-300 text-base"></i>
                  </div>
                </button>
              </div>

              {/* Email support only (no phone) */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Still need help?</p>
                <a
                  href="mailto:info.rentcottage@gmail.com"
                  className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                    <i className="ri-mail-line text-red-500 text-lg"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Email Support</p>
                    <p className="text-xs text-gray-500 mt-0.5">info.rentcottage@gmail.com</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Policy Modal (triggered from mobile Help Center) */}
      <CancellationModal isOpen={showCancellationModal} onClose={() => setShowCancellationModal(false)} />
    </div>
  );
}

function MenuItem({ icon, label, onClick, bold = false }: { icon: string; label: string; onClick: () => void; bold?: boolean }) {
  return (
    <button onClick={onClick} className="w-full px-4 py-3 text-left hover:bg-gray-50 cursor-pointer">
      <div className="flex items-center">
        <div className="w-5 h-5 flex items-center justify-center mr-3">
          <i className={`${icon} text-gray-600`}></i>
        </div>
        <span className={`${bold ? 'font-semibold' : ''} text-gray-800`}>{label}</span>
      </div>
    </button>
  );
}

function MobileMenuItem({
  icon,
  label,
  onClick,
  bold = false,
  danger = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  bold?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center px-3 py-3.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${danger ? 'bg-red-50' : 'bg-gray-100'}`}>
        <i className={`${icon} text-sm ${danger ? 'text-red-500' : 'text-gray-600'}`}></i>
      </div>
      <span className={`text-sm ${bold ? 'font-semibold' : 'font-medium'} ${danger ? 'text-red-500' : 'text-gray-800'}`}>
        {label}
      </span>
      <div className="w-5 h-5 flex items-center justify-center ml-auto flex-shrink-0">
        <i className="ri-arrow-right-s-line text-gray-300 text-base"></i>
      </div>
    </button>
  );
}
