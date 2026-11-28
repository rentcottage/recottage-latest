// Listing queries must only ask public_properties for columns that exist.
// Production (2026-11-28) has no title_en/title_ru/…: asking for them made
// every listing load start with a 400 (PostgREST 42703) before the retry.
//
// Run: node --test tests/frontend/listingColumns.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LISTING_TRANSLATIONS_LIVE, translationColumns, listingText } from '../../src/lib/listingText.ts';

test('no translation columns are requested while the view lacks them', () => {
  assert.equal(LISTING_TRANSLATIONS_LIVE, false, 'flip only together with the DB migration + view update');
  assert.equal(translationColumns('title_en', 'title_ru', 'source_lang'), '');
});

test('titles fall back to the original when no translation is stored', () => {
  const row = { title: 'კოტეჯი "სამეგობრო"', description: 'აღწერა' };
  for (const lang of ['ka', 'en', 'ru'] as const) {
    assert.equal(listingText(row, 'title', lang), 'კოტეჯი "სამეგობრო"');
    assert.equal(listingText(row, 'description', lang), 'აღწერა');
  }
});
