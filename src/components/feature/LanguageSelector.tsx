import { useState, useRef, useEffect, useCallback } from 'react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ka', label: 'Georgian' },
  { code: 'ru', label: 'Russian' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
];

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  ka: 'Georgian',
  ru: 'Russian',
  de: 'German',
  fr: 'French',
};

function detectCurrentLang(): string {
  try {
    const cookies = document.cookie.split('; ');
    const gt = cookies.find((c) => c.startsWith('googtrans='));
    if (gt) {
      const parts = gt.split('=')[1].split('/');
      const code = parts[parts.length - 1];
      if (code && LANG_LABELS[code]) return code;
    }
  } catch {
    // ignore
  }
  return 'en';
}

function triggerGoogleTranslate(targetCode: string) {
  // Try to use the injected combo select
  const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
  if (combo) {
    combo.value = targetCode;
    combo.dispatchEvent(new Event('change'));
    return;
  }

  // Fallback: set cookie + reload
  const hostname = window.location.hostname;
  const cookieVal = targetCode === 'en' ? '/en/en' : `/en/${targetCode}`;
  document.cookie = `googtrans=${cookieVal};path=/;domain=.${hostname}`;
  document.cookie = `googtrans=${cookieVal};path=/`;
  window.location.reload();
}

interface LanguageSelectorProps {
  variant?: 'desktop' | 'mobile';
  onClose?: () => void;
}

export default function LanguageSelector({ variant = 'desktop', onClose }: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>(detectCurrentLang);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectLanguage = useCallback((code: string) => {
    setCurrent(code);
    setOpen(false);
    onClose?.();
    triggerGoogleTranslate(code);
  }, [onClose]);

  const currentLabel = LANG_LABELS[current] ?? 'Language';

  if (variant === 'mobile') {
    return (
      <div className="px-3 py-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">Language</p>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => selectLanguage(lang.code)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors whitespace-nowrap ${
                current === lang.code
                  ? 'bg-red-50 text-red-500 border border-red-200'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {current === lang.code ? (
                  <i className="ri-check-line text-red-500 text-xs"></i>
                ) : (
                  <i className="ri-global-line text-gray-400 text-xs"></i>
                )}
              </div>
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-gray-700 hover:text-red-500 cursor-pointer transition-colors group"
        aria-label="Select language"
      >
        <div className="w-8 h-8 flex items-center justify-center">
          <i className="ri-global-line text-lg group-hover:text-red-500 transition-colors"></i>
        </div>
        <span className="text-sm font-medium hidden lg:block whitespace-nowrap">{currentLabel}</span>
        <div className="w-4 h-4 flex items-center justify-center">
          <i className={`ri-arrow-down-s-line text-sm transition-transform duration-200 ${open ? 'rotate-180' : ''}`}></i>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-44 bg-white rounded-xl border border-gray-200 py-1 z-[60]">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => selectLanguage(lang.code)}
              className={`w-full text-left px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 whitespace-nowrap ${
                current === lang.code
                  ? 'text-red-500 font-semibold bg-red-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {current === lang.code ? (
                  <i className="ri-check-line text-red-500 text-xs"></i>
                ) : (
                  <span className="w-4" />
                )}
              </div>
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
