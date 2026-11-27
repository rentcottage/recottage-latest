#!/usr/bin/env node
// One-time backfill: pre-generate WebP display variants for every photo in the
// property-photos bucket, because Supabase Image Transformations (the
// /render/image/ endpoint) is not enabled on our plan.
//
// For each original <name>.<ext> it writes, next to it:
//   <name>-1600.webp   longest edge ≤1600px, quality 78   (property gallery)
//   <name>-400.webp    longest edge ≤400px,  quality 70   (cards, search, thumbs)
// with cache-control "public, max-age=31536000". Originals are NEVER deleted
// or modified. Already-generated variants are skipped, so re-running is safe.
//
// Usage (from the repo root):
//   node --env-file=.env scripts/optimize-images.mjs            # DRY RUN (default): download,
//                                                           # encode in memory, report sizes,
//                                                           # upload nothing
//   SUPABASE_SERVICE_ROLE_KEY=… node --env-file=.env scripts/optimize-images.mjs --apply
//
// Options:
//   --apply           actually upload (requires SUPABASE_SERVICE_ROLE_KEY)
//   --limit=N         only process the first N originals (for a trial)
//   --concurrency=N   parallel downloads/encodes (default 4)
//   --report=FILE     write a per-file JSON report
//   --retry-failed=FILE  only process the paths that failed in an earlier --report
//
// Storage rate-limits bursts (HTTP 429); requests are retried with backoff.
// Zero-byte objects (broken uploads) are reported as "empty", not processed.

import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { PHOTO_BUCKET, PHOTO_VARIANTS, VARIANT_RE, variantPath } from './lib/variants.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const APPLY = args.apply === true;
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const CONCURRENCY = Number(args.concurrency ?? 4);
const CACHE_CONTROL = 'public, max-age=31536000';

const SUPABASE_URL = process.env.VITE_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !(ANON_KEY || SERVICE_KEY)) {
  console.error('Need VITE_PUBLIC_SUPABASE_URL and a key (run with --env-file=.env).');
  process.exit(1);
}
if (APPLY && !SERVICE_KEY) {
  console.error('--apply needs SUPABASE_SERVICE_ROLE_KEY in the environment (it writes to the bucket).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY, { auth: { persistSession: false } });
const bucket = supabase.storage.from(PHOTO_BUCKET);

/** Raster types sharp re-encodes well. GIF (animation), SVG, HEIC etc. are skipped. */
const ENCODABLE = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/tiff']);

// ── list every object, recursively ──────────────────────────────────────────
async function listAll(prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list "${prefix}" failed: ${error.message}`);
    for (const o of data) {
      const path = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id === null) out.push(...(await listAll(path))); // folder
      else out.push({ path, size: o.metadata?.size ?? 0, mimetype: o.metadata?.mimetype ?? '' });
    }
    if (data.length < 1000) break;
  }
  return out;
}

const publicUrl = (path) =>
  `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch, retrying 429 and 5xx with exponential backoff (honours Retry-After). */
async function fetchRetry(url, init, tries = 6) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if ((res.status !== 429 && res.status < 500) || attempt >= tries - 1) return res;
    const after = Number(res.headers.get('retry-after'));
    await sleep(after > 0 ? after * 1000 : 500 * 2 ** attempt + Math.random() * 250);
  }
}

async function encodeVariant(input, { edge, quality }) {
  return sharp(input, { failOn: 'none' })
    .rotate() // bake in EXIF orientation; metadata is stripped by default
    .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toBuffer();
}

async function upload(path, buf) {
  const res = await fetchRetry(`${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'image/webp',
      'cache-control': CACHE_CONTROL,
      'x-upsert': 'false',
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload ${path}: HTTP ${res.status} ${await res.text()}`);
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

// ── main ────────────────────────────────────────────────────────────────────
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — bucket ${PHOTO_BUCKET}\n`);
const all = await listAll();
const existing = new Set(all.map((o) => o.path));
const variantsInBucket = all.filter((o) => VARIANT_RE.test(o.path));
const originals = all.filter((o) => !VARIANT_RE.test(o.path));
// Trust the stored mimetype, falling back to the extension for octet-stream uploads.
const isPhoto = (o) => ENCODABLE.has(o.mimetype.toLowerCase()) || /\.(jpe?g|png|webp|avif|tiff?)$/i.test(o.path);
const skippedType = originals.filter((o) => !isPhoto(o));
const empty = originals.filter((o) => isPhoto(o) && o.size === 0);
let todo = originals.filter((o) => isPhoto(o) && o.size > 0);
if (args['retry-failed']) {
  const prev = JSON.parse(await readFile(args['retry-failed'], 'utf8'));
  const failed = new Set(prev.report.filter((r) => r.status === 'failed').map((r) => r.path));
  todo = todo.filter((o) => failed.has(o.path));
}
todo = todo.slice(0, LIMIT);

const report = [];
const totals = { originals: 0, thumb: 0, large: 0, done: 0, alreadyDone: 0, failed: 0, uploaded: 0 };
let n = 0;

await pool(todo, CONCURRENCY, async (o) => {
  const want = Object.entries(PHOTO_VARIANTS).map(([size, v]) => ({ size, ...v, path: variantPath(o.path, v.edge) }));
  const missing = want.filter((w) => !existing.has(w.path));
  const row = { path: o.path, original: o.size, mimetype: o.mimetype };
  try {
    if (missing.length === 0) {
      totals.alreadyDone++;
      row.status = 'already-done';
    } else {
      const res = await fetchRetry(publicUrl(o.path));
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);
      const input = Buffer.from(await res.arrayBuffer());
      if (input.length === 0) throw new Error('downloaded 0 bytes');
      row.original = input.length;
      for (const w of want) {
        if (existing.has(w.path)) continue;
        const buf = await encodeVariant(input, w);
        row[w.size] = buf.length;
        totals[w.size] += buf.length;
        if (APPLY) { await upload(w.path, buf); totals.uploaded++; }
      }
      totals.originals += input.length;
      totals.done++;
      row.status = APPLY ? 'uploaded' : 'would-upload';
    }
  } catch (err) {
    totals.failed++;
    row.status = 'failed';
    row.error = String(err?.message ?? err);
    console.warn(`  ✗ ${o.path}: ${row.error}`);
  }
  report.push(row);
  if (++n % 25 === 0) console.log(`  … ${n}/${todo.length}`);
});

const processed = report.filter((r) => r.status === 'would-upload' || r.status === 'uploaded');
const avg = (k) => (processed.length ? processed.reduce((s, r) => s + (r[k] ?? 0), 0) / processed.length : 0);

console.log(`
Objects in bucket            ${all.length}
  originals                  ${originals.length}  (${mb(originals.reduce((s, o) => s + o.size, 0))})
  existing variants          ${variantsInBucket.length}
  empty (0-byte, broken)     ${empty.length}
  skipped, not a photo type  ${skippedType.length}${skippedType.length ? '  [' + [...new Set(skippedType.map((o) => o.mimetype || '?'))].join(', ') + ']' : ''}
Processed                    ${totals.done}${totals.alreadyDone ? `  (+${totals.alreadyDone} already had both variants)` : ''}
Failed                       ${totals.failed}

Size of the processed originals   ${mb(totals.originals)}
New -1600.webp files              ${mb(totals.large)}   (${totals.originals ? ((1 - totals.large / totals.originals) * 100).toFixed(0) : 0}% smaller)
New -400.webp files               ${mb(totals.thumb)}   (${totals.originals ? ((1 - totals.thumb / totals.originals) * 100).toFixed(0) : 0}% smaller)
Added to storage (both)           ${mb(totals.large + totals.thumb)}   (originals kept)

Per photo, average: original ${(avg('original') / 1024).toFixed(0)} KB → 1600 ${(avg('large') / 1024).toFixed(0)} KB, 400 ${(avg('thumb') / 1024).toFixed(0)} KB
${APPLY ? `Uploaded ${totals.uploaded} files with cache-control "${CACHE_CONTROL}".` : 'Nothing was uploaded. Re-run with --apply to write the variants.'}`);

if (empty.length) console.log(`\n${empty.length} zero-byte originals can't be fixed by this script (re-upload needed); listed in the report as "empty".`);
if (args.report) {
  await writeFile(args.report, JSON.stringify({ totals, report, empty: empty.map((o) => o.path) }, null, 2));
  console.log(`Report: ${args.report}`);
}
process.exit(totals.failed ? 2 : 0);
