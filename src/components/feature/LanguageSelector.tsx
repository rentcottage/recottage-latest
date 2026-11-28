import { useState, useRef, useEffect, useCallback } from 'react';
import { useT } from '../../i18n';
import { LANGS, LANG_LABELS, type Lang } from '../../i18n/config';

interface LanguageSelectorProps {
  /**
   * 'icon'   — round globe button + small dropdown (header, desktop and phone).
   * 'mobile' — the language grid inside the full-screen mobile menu.
   * 'desktop' — legacy pill with label + chevron (no longer used in the header).
   */
  variant?: 'desktop' | 'mobile' | 'icon';
  /** 'icon' variant: draw the round border (desktop header) or not (phone header). */
  bordered?: boolean;
  onClose?: () => void;
  /** Recolor the desktop trigger for a dark/transparent header (e.g. the home hero overlay). */
  onDark?: boolean;
}

export default function LanguageSelector({ variant = 'desktop', bordered = false, onClose, onDark = false }: LanguageSelectorProps) {
  const { t, lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Icon variant: keyboard — focus the current language on open, arrows move,
  // Escape closes and returns focus to the globe, Tab closes.
  useEffect(() => {
    if (!open || variant !== 'icon') return;
    const start = Math.max(0, LANGS.indexOf(lang));
    itemRefs.current[start]?.focus();
    const onKey = (e: KeyboardEvent) => {
      const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); buttonRef.current?.focus(); }
      else if (e.key === 'Tab') setOpen(false);
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, variant, lang]);

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

  if (variant === 'icon') {
    const label = t('common.changeLanguage');
    return (
      <div ref={ref} className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={label}
          title={label}
          className={`w-10 h-10 max-[376px]:w-9 max-[376px]:h-9 md:w-[42px] md:h-[42px] rounded-full flex items-center justify-center cursor-pointer transition-colors ${
            bordered ? (onDark ? 'border border-white/40 hover:border-white/70' : 'border border-gray-300 hover:shadow-md') : ''
          } ${onDark ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          <i className="ri-global-line text-xl leading-none" aria-hidden="true" />
        </button>

        {open && (
          <div
            role="menu"
            aria-label={label}
            className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-gray-200 py-1 z-[60] shadow-lg"
          >
            {LANGS.map((code, i) => (
              <button
                key={code}
                ref={(el) => { itemRefs.current[i] = el; }}
                type="button"
                role="menuitemradio"
                aria-checked={lang === code}
                onClick={() => { selectLanguage(code); buttonRef.current?.focus(); }}
                className={`w-full min-h-[44px] text-left px-4 text-sm cursor-pointer transition-colors flex items-center gap-2.5 whitespace-nowrap outline-none focus-visible:bg-gray-100 ${
                  lang === code ? 'text-red-500 font-semibold bg-red-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  {lang === code ? <i className="ri-check-line text-red-500 text-sm"></i> : null}
                </span>
                <span lang={code}>{LANG_LABELS[code]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

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
