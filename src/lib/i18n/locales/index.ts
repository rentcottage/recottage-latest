import type { Lang, PluralForms, TranslationTree } from '../types';
import en, { type TranslationSchema } from './en';
import ka from './ka';
import ru from './ru';
import de from './de';
import fr from './fr';

export type { TranslationSchema };

/** All locale dictionaries, keyed by language code. */
export const dictionaries: Record<Lang, TranslationSchema> = { en, ka, ru, de, fr };

/** Flatten a dictionary tree to dotted key paths (plural leaves count as one key). */
function flattenKeys(tree: TranslationTree, prefix = '', out: string[] = []): string[] {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === 'object' &&
      typeof (value as PluralForms).other !== 'string'
    ) {
      flattenKeys(value as TranslationTree, path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}

let audited = false;

/**
 * Dev-only sanity check: compares every non-English locale against the English
 * key set and logs any gaps. TypeScript already enforces the shape at build
 * time (each locale is typed `TranslationSchema`); this catches drift at runtime
 * and gives a fast, readable report during development. Runs at most once.
 */
export function auditLocales(): void {
  if (audited || !import.meta.env.DEV) return;
  audited = true;

  const enKeys = new Set(flattenKeys(en as unknown as TranslationTree));

  (['ka', 'ru', 'de', 'fr'] as const).forEach((lang) => {
    const localeKeys = new Set(flattenKeys(dictionaries[lang] as unknown as TranslationTree));
    const missing = [...enKeys].filter((k) => !localeKeys.has(k));
    const extra = [...localeKeys].filter((k) => !enKeys.has(k));
    if (missing.length) {
      console.warn(`[i18n] "${lang}" is missing ${missing.length} key(s):`, missing);
    }
    if (extra.length) {
      console.warn(`[i18n] "${lang}" has ${extra.length} unknown key(s):`, extra);
    }
  });
}
