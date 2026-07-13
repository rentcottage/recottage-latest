import type { Lang } from './types';

export type { Lang };

/** Language option shown in the selector: native label + English name. */
export interface LanguageOption {
  code: Lang;
  /** Endonym — the language's own name, shown in the switcher. */
  label: string;
  /** English name, used for `aria-label`s and dev tooling. */
  englishLabel: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', englishLabel: 'English' },
  { code: 'ka', label: 'ქართული', englishLabel: 'Georgian' },
  { code: 'ru', label: 'Русский', englishLabel: 'Russian' },
  { code: 'de', label: 'Deutsch', englishLabel: 'German' },
  { code: 'fr', label: 'Français', englishLabel: 'French' },
];

export const LANG_CODES: Lang[] = LANGUAGES.map((l) => l.code);

/**
 * First-time visitors default to Georgian — this preserves the behaviour the
 * old Google-Translate `googtrans=/en/ka` cookie gave the live site.
 */
export const DEFAULT_LANG: Lang = 'ka';

/** Any key missing from the active locale falls back to English. */
export const FALLBACK_LANG: Lang = 'en';

/** localStorage key holding the visitor's explicit language choice. */
export const STORAGE_KEY = 'rc_lang';

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANG_CODES as string[]).includes(value);
}
