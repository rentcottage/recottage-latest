// One brand spelling, everywhere a reader can see it.
//
// The repo carried two display forms of the name — `RentCottage.Ge` (143 uses,
// including every static-route <title>) and `RentCottage.ge` (11, including
// index.html's own og:title). Search engines treat the title tag as the page's
// name, so publishing two spellings of it across one site is a small but real
// inconsistency, and the kind that creeps back one string at a time.
//
// This test is the ratchet. It walks the shipped source and fails if the
// mixed-case form reappears in anything a reader sees.
//
// WHAT IT DELIBERATELY DOES NOT COVER:
//   - the DOMAIN, which is lowercase `rentcottage.ge` inside every URL and is
//     not a display string at all;
//   - supabase/functions/**, which is transactional e-mail copy and one
//     iCalendar PRODID (a machine identifier read by Booking.com and Airbnb,
//     not a person) — changing those means redeploying those functions;
//   - this file and prerender.test.ts, which must name the old spelling in
//     order to assert its absence.
//
// Run: node --test tests/frontend/brandSpelling.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

/** The spelling that must not come back. */
const WRONG = 'RentCottage.Ge';
/** The one display spelling. */
const RIGHT = 'RentCottage.ge';

const SCAN_DIRS = ['src', 'scripts', 'public'];
const SCAN_FILES = ['index.html'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.vite', 'supabase']);
const SKIP_FILES = new Set([
  'tests/frontend/brandSpelling.test.ts',
  'tests/frontend/prerender.test.ts',
]);
const TEXT = /\.(ts|tsx|mjs|js|json|html|svg|css|md)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT.test(entry)) out.push(full);
  }
  return out;
}

function scannedFiles(): string[] {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
  files.push(...SCAN_FILES.map((f) => join(ROOT, f)));
  return files.filter((f) => !SKIP_FILES.has(relative(ROOT, f)));
}

test('BRAND no display string spells the name RentCottage.Ge', () => {
  const offenders: string[] = [];
  for (const file of scannedFiles()) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes(WRONG)) continue;
    text.split('\n').forEach((line, i) => {
      if (line.includes(WRONG)) offenders.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
    });
  }
  assert.deepEqual(
    offenders, [],
    `the mixed-case brand spelling came back in ${offenders.length} place(s):\n  ${offenders.join('\n  ')}`,
  );
});

test('BRAND the scan actually looks at the files that carry the name', () => {
  // A ratchet that scans nothing passes forever. This pins that the sweep
  // reaches the files where the name genuinely lives.
  const files = scannedFiles().map((f) => relative(ROOT, f));
  for (const expected of [
    'scripts/prerender.mjs',      // the 8 static-route titles
    'scripts/lib/seo.mjs',        // the listing title suffix
    'scripts/lib/landing.mjs',    // landing titles + BreadcrumbList name
    'src/components/feature/SEO.tsx', // og:site_name at runtime
    'src/pages/home/page.tsx',    // Organization / LocalBusiness JSON-LD
    'src/i18n/messages/content.ts',
    'src/i18n/messages/corporate.ts',
    'index.html',
  ]) {
    assert.ok(files.includes(expected), `the scan missed ${expected}`);
  }
  assert.ok(files.length > 50, `only ${files.length} files scanned`);

  // And that the right spelling is actually present, so the test cannot pass
  // simply because the brand was deleted everywhere.
  const withBrand = scannedFiles().filter((f) => readFileSync(f, 'utf8').includes(RIGHT));
  assert.ok(withBrand.length > 20, `only ${withBrand.length} files carry the brand at all`);
});

test('BRAND the domain inside URLs is untouched and still lowercase', () => {
  // The rule is about the NAME, not the address. Every link must still point
  // at rentcottage.ge exactly as before.
  const urls = new Set<string>();
  for (const file of scannedFiles()) {
    for (const m of readFileSync(file, 'utf8').matchAll(/https?:\/\/[A-Za-z0-9.-]*rentcottage\.[A-Za-z]{2,}/gi)) {
      urls.add(m[0]);
    }
  }
  assert.ok(urls.size > 0, 'no site URLs found — the scan is looking in the wrong place');
  for (const u of urls) {
    assert.equal(u, u.toLowerCase(), `a URL changed case: ${u}`);
    assert.ok(/rentcottage\.ge/.test(u), `unexpected domain: ${u}`);
  }
});
