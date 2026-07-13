import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '@lib/i18n';
import AuthModals from '../../../components/feature/AuthModals';

interface Props {
  children: React.ReactNode;
}

export default function HostGate({ children }: Props) {
  const { t } = useTranslation();
  const { isLoggedIn, loading, user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const openAuth = () => setShowLogin(true);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 flex items-center justify-center animate-spin">
            <i className="ri-loader-4-line text-xl"></i>
          </div>
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-home-smile-line text-emerald-600 text-3xl"></i>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('header.hostDashboard')}</h1>
          <p className="text-gray-500 text-sm mb-8">
            {t('host.gate.signInPrompt')}
          </p>
          <button
            onClick={openAuth}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-login-circle-line"></i>
            </div>
            {t('host.gate.signInToContinue')}
          </button>
          <p className="text-xs text-gray-400 mt-4">
            {t('host.gate.noAccount')}{' '}
            <button
              onClick={openAuth}
              className="text-emerald-600 hover:underline cursor-pointer whitespace-nowrap"
            >
              {t('host.gate.createOne')}
            </button>
          </p>
        </div>
        <AuthModals
          showLogin={showLogin}
          showSignup={showSignup}
          onCloseLogin={() => setShowLogin(false)}
          onCloseSignup={() => setShowSignup(false)}
          onSwitchToSignup={() => { setShowLogin(false); setShowSignup(true); }}
          onSwitchToLogin={() => { setShowSignup(false); setShowLogin(true); }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
