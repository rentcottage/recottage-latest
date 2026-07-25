import { useContext } from 'react';
import { I18nContext, type I18nContextValue } from './I18nProvider';

/** Access the full i18n context (t, plural, lang, setLang). */
export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useT must be used within <I18nProvider>');
  }
  return ctx;
}

/** Convenience hook for components that only need the active language + setter. */
export function useLang(): Pick<I18nContextValue, 'lang' | 'setLang'> {
  const { lang, setLang } = useT();
  return { lang, setLang };
}
