import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_LANG, STORAGE_KEY, isLang, type Lang } from './config';
import { messages, type Messages } from './messages';

type Vars = Record<string, string | number>;

export interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a dotted key with optional `{token}` interpolation. */
  t: (key: string, vars?: Vars) => string;
  /**
   * Pluralize using Intl.PluralRules for the active language. `forms` maps
   * CLDR categories (one/few/many/other…) to strings; `{count}` is interpolated.
   */
  plural: (key: string, count: number, vars?: Vars) => string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    /* ignore (SSR / privacy mode) */
  }
  return DEFAULT_LANG;
}

/** Resolve a dotted path (`a.b.c`) against a messages object. */
function lookup(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  // Keep <html lang> in sync so screen readers, hyphenation and the browser
  // reflect the active language. `translate="no"` on <html> (set in index.html)
  // keeps native/GT auto-translate off regardless.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars): string => {
      // Active language → English fallback → the key itself (never blank).
      const active = lookup(messages[lang], key);
      const value =
        typeof active === 'string'
          ? active
          : (() => {
              const en = lookup(messages.en as Messages, key);
              return typeof en === 'string' ? en : key;
            })();
      return interpolate(value, vars);
    },
    [lang],
  );

  const plural = useCallback(
    (key: string, count: number, vars?: Vars): string => {
      const rules = new Intl.PluralRules(lang);
      const category = rules.select(count); // one | few | many | other …
      // Try `key.<category>`, then `key.other`, then the base key.
      const active =
        lookup(messages[lang], `${key}.${category}`) ??
        lookup(messages[lang], `${key}.other`) ??
        lookup(messages.en as Messages, `${key}.${category}`) ??
        lookup(messages.en as Messages, `${key}.other`) ??
        key;
      const value = typeof active === 'string' ? active : key;
      return interpolate(value, { count, ...vars });
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t, plural }),
    [lang, setLang, t, plural],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
