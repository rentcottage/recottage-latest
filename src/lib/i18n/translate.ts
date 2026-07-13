import type { Lang, PluralForms, TranslationTree, TranslationVars } from './types';
import { FALLBACK_LANG } from './config';
import { selectPlural } from './plural';
import { dictionaries } from './locales';

/** Dev-only: remember which missing keys we've already warned about. */
const warned = new Set<string>();

function devWarnMissing(lang: Lang, key: string): void {
  if (!import.meta.env.DEV) return;
  const id = `${lang}:${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  console.warn(`[i18n] missing key "${key}" for locale "${lang}" (using fallback)`);
}

/** Walk a dot-separated key path into a dictionary tree. */
function lookup(tree: TranslationTree, key: string): string | PluralForms | undefined {
  let node: string | PluralForms | TranslationTree | undefined = tree;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string' || isPluralForms(node)) return undefined;
    node = (node as TranslationTree)[part];
  }
  if (typeof node === 'string' || isPluralForms(node)) return node;
  return undefined;
}

function isPluralForms(value: unknown): value is PluralForms {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PluralForms).other === 'string'
  );
}

/** Replace `{name}` tokens with the matching variable; leave unknown tokens as-is. */
function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Resolve a translation key for a locale.
 *
 * 1. Look the key up in the active locale; on miss, warn (dev) and fall back to
 *    English so nothing renders blank.
 * 2. If the leaf is a `PluralForms` object and a numeric `count` is supplied,
 *    pick the right form via the locale's plural selector (with `other` as the
 *    final fallback).
 * 3. Interpolate `{var}` tokens.
 *
 * If the key is missing everywhere, the key itself is returned so the gap is
 * visible rather than empty.
 */
export function translate(lang: Lang, key: string, vars?: TranslationVars): string {
  let entry = lookup(dictionaries[lang] as TranslationTree, key);
  if (entry === undefined) {
    devWarnMissing(lang, key);
    if (lang !== FALLBACK_LANG) {
      entry = lookup(dictionaries[FALLBACK_LANG] as TranslationTree, key);
    }
  }
  if (entry === undefined) return key;

  let text: string;
  if (isPluralForms(entry)) {
    const count = typeof vars?.count === 'number' ? vars.count : 0;
    const form = selectPlural(lang, count);
    text = entry[form] ?? entry.other;
  } else {
    text = entry;
  }
  return interpolate(text, vars);
}
