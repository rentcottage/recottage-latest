import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Lang, TranslationVars } from './types';
import { DEFAULT_LANG, STORAGE_KEY, isLang } from './config';
import { translate } from './translate';
import { auditLocales } from './locales';

export type TranslateFn = (key: string, vars?: TranslationVars) => string;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Read the persisted choice, falling back to the Georgian default. */
function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode / SSR) — use the default.
  }
  return DEFAULT_LANG;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  // Keep <html lang> in sync for a11y + correct font/hyphenation behaviour.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Dev-only: report any keys that drift out of sync with the English source.
  useEffect(() => {
    if (import.meta.env.DEV) auditLocales();
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; the in-memory choice still applies.
    }
  }, []);

  const t = useCallback<TranslateFn>((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within an <I18nProvider>');
  }
  return ctx;
}

/**
 * Framework-free translate for code that can't use the hook — notably the
 * class-based ErrorBoundary, which sits *outside* the provider and must still
 * work after a crash tears the React tree down. Reads the persisted choice
 * directly (defaulting to Georgian) and resolves against the dictionaries.
 */
export function translateStatic(key: string, vars?: TranslationVars): string {
  return translate(getInitialLang(), key, vars);
}

export { LANGUAGES, DEFAULT_LANG } from './config';
export { translateVocab } from './vocab';
export type { VocabKind } from './vocab';
export type { Lang, LanguageOption } from './config';
export type { TranslationVars } from './types';
