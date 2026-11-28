import type { Lang } from '../i18n/config';

/**
 * Picks listing text in the reader's language.
 *
 * Host-written text (title, description) lives in one language — nearly always
 * Georgian. Translated copies are generated once and stored alongside the
 * original (see db/listing-translations.sql); this chooses between them.
 *
 * Always falls back to the original. A listing with no translation yet, a
 * translation that failed, or a language we don't store still renders the
 * host's own words rather than an empty block.
 */
export interface TranslatableListing {
  title?: string | null;
  description?: string | null;
  title_en?: string | null;
  title_ru?: string | null;
  description_en?: string | null;
  description_ru?: string | null;
  source_lang?: string | null;
}

/**
 * Whether the live `public_properties` view has the translation columns.
 *
 * It does NOT yet (checked against production 2026-11-28: requesting
 * `title_en` returns 400 "column public_properties.title_en does not exist").
 * db/listing-translations.sql adds them to property_applications, but the view
 * must also be recreated to expose them, and neither step has been applied.
 *
 * While false, queries ask only for columns that exist, so there is no failing
 * request on every page load; listingText() falls back to the original title
 * and description. Flip to true in the same deploy as (or after) the database
 * change. The 42703 retry in the callers stays as a safety net either way.
 */
export const LISTING_TRANSLATIONS_LIVE = false;

/** Translation columns to add to a public_properties select, or '' while they don't exist. */
export function translationColumns(...cols: string[]): string {
  return LISTING_TRANSLATIONS_LIVE ? `, ${cols.join(', ')}` : '';
}

type Field = 'title' | 'description';

export function listingText(
  listing: TranslatableListing | null | undefined,
  field: Field,
  lang: Lang,
): string {
  if (!listing) return '';
  const original = (listing[field] ?? '').trim();

  // Already in the reader's language — the translated copy would be a round
  // trip through a machine for no gain.
  if (listing.source_lang && listing.source_lang === lang) return original;
  if (lang === 'ka') return original || '';

  const translated = (listing[`${field}_${lang}` as keyof TranslatableListing] as string | null | undefined)?.trim();
  return translated || original;
}
