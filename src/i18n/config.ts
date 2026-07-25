// In-code i18n configuration. Replaces the former Google Translate integration.
// Three supported languages; Georgian is the default for first-time visitors,
// matching the pre-i18n behaviour (site defaulted to `googtrans=/en/ka`).

export const LANGS = ['ka', 'en', 'ru'] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'ka';

// Persisted across visits so a chosen language sticks without a cookie/reload.
export const STORAGE_KEY = 'rc_lang';

// Native display labels for the language switcher.
export const LANG_LABELS: Record<Lang, string> = {
  ka: 'ქართული',
  en: 'English',
  ru: 'Русский',
};

// Short codes shown in compact UI (e.g. the desktop pill).
export const LANG_SHORT: Record<Lang, string> = {
  ka: 'ქარ',
  en: 'ENG',
  ru: 'РУС',
};

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}
