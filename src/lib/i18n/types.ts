/**
 * Core i18n types shared across the engine and the locale dictionaries.
 *
 * The dictionaries are authored as nested objects namespaced by area
 * (`common`, `header`, `footer`, …). A leaf is either a plain string (which may
 * contain `{var}` interpolation tokens) or a `PluralForms` object selected by a
 * `count` variable at call time.
 */

/** Supported UI languages. `en` is the source-of-truth key set. */
export type Lang = 'en' | 'ka' | 'ru' | 'de' | 'fr';

/** CLDR-style plural categories used by the per-locale selectors. */
export type PluralForm = 'one' | 'few' | 'many' | 'other';

/**
 * A pluralizable leaf. `other` is mandatory (the universal fallback); the
 * remaining forms are optional so 2-form locales (en/ka/de/fr) can omit
 * `few`/`many` while Russian supplies all three.
 */
export interface PluralForms {
  one?: string;
  few?: string;
  many?: string;
  other: string;
}

/** Values passed to `t()` for `{var}` interpolation and plural selection. */
export type TranslationVars = Record<string, string | number>;

/** Recursive shape every locale dictionary conforms to. */
export type TranslationTree = {
  [key: string]: string | PluralForms | TranslationTree;
};

/**
 * Identity helper that pins a leaf's type to `PluralForms` (rather than the
 * narrow `{ one, other }` literal). Authoring plural entries via `plural({...})`
 * in `en.ts` keeps the derived `TranslationSchema` flexible enough for Russian's
 * extra `few`/`many` forms.
 */
export const plural = (forms: PluralForms): PluralForms => forms;
