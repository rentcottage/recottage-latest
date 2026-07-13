import type { Lang, PluralForm } from './types';

/**
 * Per-locale plural selectors following CLDR plural rules.
 *
 * - en / de: `one` for exactly 1, else `other`.
 * - fr: `one` for 0 and 1, else `other`.
 * - ka: Georgian has no count-driven noun agreement; treated as 2-form so a
 *   translator can supply identical `one`/`other` text when helpful.
 * - ru: 3-form — `one`/`few`/`many` per the Russian CLDR rule.
 */
const selectors: Record<Lang, (n: number) => PluralForm> = {
  en: (n) => (n === 1 ? 'one' : 'other'),
  de: (n) => (n === 1 ? 'one' : 'other'),
  fr: (n) => (n === 0 || n === 1 ? 'one' : 'other'),
  ka: (n) => (n === 1 ? 'one' : 'other'),
  ru: (n) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
    return 'many';
  },
};

export function selectPlural(lang: Lang, count: number): PluralForm {
  return selectors[lang](Math.abs(count));
}
