import { useState, useRef, useEffect, useCallback } from 'react';
import { useT } from '../../i18n';
import { LANGS, LANG_LABELS, type Lang } from '../../i18n/config';

interface LanguageSelectorProps {
  variant?: 'desktop' | 'mobile';
  onClose?: () => void;
  /** Recolor the desktop trigger for a dark/transparent header (e.g. the home hero overlay). */
  onDark?: boolean;
}

export default function LanguageSelector({ variant = 'desktop', onClose, onDark = false }: LanguageSelectorProps) {
  const { t, lang, setLang } = useT();
  const [open, setOpen] = useState(false);
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

  const selectLanguage = useCallback(
    (code: Lang) => {
      setLang(code);
      setOpen(false);
      onClose?.();
    },
    [setLang, onClose],
  );

  const currentLabel = LANG_LABELS[lang];

  if (variant === 'mobile') {
    return (
      <div className="px-3 py-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">
          {t('common.selectLanguage')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {LANGS.map((code) => (
            <button
              key={code}
              onClick={() => selectLanguage(code)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors whitespace-nowrap ${
                lang === code
                  ? 'bg-red-50 text-red-500 border border-red-200'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {lang === code ? (
                  <i className="ri-check-line text-red-500 text-xs"></i>
                ) : (
                  <i className="ri-global-line text-gray-400 text-xs"></i>
                )}
              </div>
              {LANG_LABELS[code]}
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
        className={`flex items-center gap-1 cursor-pointer transition-colors group ${
          onDark ? 'text-white/90 hover:text-white' : 'text-gray-700 hover:text-red-500'
        }`}
        aria-label={t('common.selectLanguage')}
      >
        <div className="w-8 h-8 flex items-center justify-center">
          <i className={`ri-global-line text-lg transition-colors ${onDark ? 'group-hover:text-white' : 'group-hover:text-red-500'}`}></i>
        </div>
        <span className="text-sm font-medium hidden lg:block whitespace-nowrap">{currentLabel}</span>
        <div className="w-4 h-4 flex items-center justify-center">
          <i className={`ri-arrow-down-s-line text-sm transition-transform duration-200 ${open ? 'rotate-180' : ''}`}></i>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-44 bg-white rounded-xl border border-gray-200 py-1 z-[60] shadow-lg">
          {LANGS.map((code) => (
            <button
              key={code}
              onClick={() => selectLanguage(code)}
              className={`w-full text-left px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 whitespace-nowrap ${
                lang === code ? 'text-red-500 font-semibold bg-red-50' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {lang === code ? (
                  <i className="ri-check-line text-red-500 text-xs"></i>
                ) : (
                  <span className="w-4" />
                )}
              </div>
              {LANG_LABELS[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
