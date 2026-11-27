#!/usr/bin/env node
// Stage 2/3 of shrinking storage: compress the ORIGINAL property photos.
//
// Reads the local backup made by scripts/backup-originals.mjs (no egress),
// writes compressed copies to a separate folder with the same structure, and
// (only with --apply) uploads them over the originals at the SAME path, so no
// URL, database row or code path changes. -400/-1600 variants are never
// touched; the backup folder is never modified.
//
// Per file (content is detected from the bytes, not trusted from the name):
//   JPEG        → JPEG q80 (mozjpeg), long side ≤ 2000px
//   PNG + real transparency → PNG (max compression), long side ≤ 2000px
//   PNG, fully opaque       → JPEG q80 bytes at the SAME .png path, stored
//                             with content-type image/jpeg (browsers render
//                             by content type, the URL stays the same)
//   WebP        → WebP q80, long side ≤ 2000px (re-encoding these as JPEG under
//                 a .webp name would be pointless: they are already compressed)
// Always: EXIF orientation baked into the pixels, all metadata stripped.
// A file is only replaced if the result is smaller than the original.
//
// Usage (repo root):
//   node scripts/compress-originals.mjs                 # DRY RUN: compress to the out folder, report
//   SUPABASE_SERVICE_ROLE_KEY=… node --env-file=.env scripts/compress-originals.mjs --apply
// Options: --backup=DIR (default ~/rentcottage-photo-backup)
//          --out=DIR    (default ~/rentcottage-photo-compressed)
//          --samples=DIR  write before/after comparison images for 3 samples
//          --concurrency=N (encode, default 4; uploads always 3)

import sharp from 'sharp';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PHOTO_BUCKET, VARIANT_RE } from './lib/variants.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const home = (p) => resolve(String(p).replace(/^~/, homedir()));
const BACKUP = home(args.backup ?? '~/rentcottage-photo-backup');
const OUT = home(args.out ?? '~/rentcottage-photo-compressed');
const APPLY = args.apply === true;
const CONCURRENCY = Number(args.concurrency ?? 4);
const MAX_EDGE = 2000;
const QUALITY = 80;
const CACHE_CONTROL = 'public, max-age=31536000';

// ── encode ──────────────────────────────────────────────────────────────────
async function compress(input) {
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  const base = () => sharp(input, { failOn: 'none' })
    .rotate()                                   // apply EXIF orientation, then metadata is dropped
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });

  let kind;
  if (meta.format === 'png') {
    const transparent = meta.hasAlpha && !(await sharp(input).stats()).isOpaque;
    kind = transparent ? 'png' : 'png→jpeg';
  } else if (meta.format === 'webp') kind = 'webp';
  else kind = 'jpeg';

  let buf, contentType;
  if (kind === 'png') {
    buf = await base().png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 }).toBuffer();
    contentType = 'image/png';
  } else if (kind === 'webp') {
    buf = await base().webp({ quality: QUALITY, effort: 5 }).toBuffer();
    contentType = 'image/webp';
  } else {
    // JPEG has no alpha: flatten onto white (only matters for odd inputs).
    buf = await base().flatten({ background: '#ffffff' }).jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
    contentType = 'image/jpeg';
  }
  const out = await sharp(buf).metadata();
  return { buf, kind, contentType, before: { w: meta.width, h: meta.height, format: meta.format }, after: { w: out.width, h: out.height } };
}

// ── upload (only --apply) ───────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function upload(path, buf, contentType) {
  const url = `${process.env.VITE_PUBLIC_SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (let attempt = 0; ; attempt++) {
    let res, err;
    try {
      res = await fetch(url, {
        method: 'PUT', // update in place at the same path
        headers: {
          Authorization: `Bearer ${key}`, apikey: key,
          'Content-Type': contentType, 'cache-control': CACHE_CONTROL, 'x-upsert': 'true',
        },
        body: buf,
      });
    } catch (e) { err = e; }
    if (res?.ok) return;
    const retryable = !res || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 5) throw new Error(err ? String(err) : `HTTP ${res.status} ${await res.text()}`);
    const after = Number(res?.headers.get('retry-after'));
    await sleep(after > 0 ? after * 1000 : 500 * 2 ** attempt + Math.random() * 250);
  }
}

// ── main ────────────────────────────────────────────────────────────────────
if (APPLY && !(process.env.VITE_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('--apply needs VITE_PUBLIC_SUPABASE_URL (--env-file=.env) and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const manifest = JSON.parse(await readFile(join(BACKUP, 'manifest.json'), 'utf8'));
const files = manifest.files.filter((f) => !VARIANT_RE.test(f.path)); // belt and braces: never a variant
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${files.length} originals from ${BACKUP}\n`);

// --apply uploads exactly what the dry run produced and you reviewed
// (plan.json + the files next to it); it never re-encodes.
let plan = [];
if (APPLY) {
  const reviewed = JSON.parse(await readFile(join(OUT, 'plan.json'), 'utf8').catch(() => {
    console.error(`No ${join(OUT, 'plan.json')} — run the dry run first.`);
    process.exit(1);
  }));
  plan = reviewed.files;
  console.log(`Using the reviewed plan from ${reviewed.createdAt}\n`);
}
let next = 0, n = 0;
if (!APPLY) await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < files.length) {
    const f = files[next++];
    const row = { path: f.path, before: f.size };
    try {
      const input = await readFile(join(BACKUP, f.path));
      const r = await compress(input);
      Object.assign(row, { kind: r.kind, contentType: r.contentType, after: r.buf.length, dims: `${r.before.w}x${r.before.h}→${r.after.w}x${r.after.h}` });
      row.action = r.buf.length < f.size ? 'replace' : 'keep'; // never upload something bigger
      if (row.action === 'replace') {
        const dest = join(OUT, f.path);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, r.buf);
      }
    } catch (err) {
      row.action = 'error';
      row.error = String(err?.message ?? err);
      console.warn(`  ✗ ${f.path}: ${row.error}`);
    }
    plan.push(row);
    if (++n % 200 === 0) console.log(`  … ${n}/${files.length}`);
  }
}));
plan.sort((a, b) => a.path.localeCompare(b.path));
if (!APPLY) {
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'plan.json'), JSON.stringify({ createdAt: new Date().toISOString(), maxEdge: MAX_EDGE, quality: QUALITY, files: plan }, null, 2));
}

const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
const sum = (rows, k) => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
const replace = plan.filter((r) => r.action === 'replace');
const keep = plan.filter((r) => r.action === 'keep');
const errors = plan.filter((r) => r.action === 'error');
const beforeAll = sum(plan, 'before');
const afterAll = sum(replace, 'after') + sum(keep, 'before') + sum(errors, 'before');
const kinds = {};
for (const r of replace) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;

console.log(`
Originals before        ${mb(beforeAll)}  (${plan.length} files)
Originals after         ${mb(afterAll)}  (${((1 - afterAll / beforeAll) * 100).toFixed(0)}% smaller)
  replace               ${replace.length}   ${JSON.stringify(kinds)}
  keep (already small)  ${keep.length}
  errors                ${errors.length}
Compressed copies + plan.json in ${OUT}`);

if (args.samples && !APPLY) {
  // Three representative files: the biggest JPEG, a median JPEG, and a PNG.
  const jpegs = replace.filter((r) => r.kind === 'jpeg').sort((a, b) => b.before - a.before);
  const picks = [jpegs[0], jpegs[Math.floor(jpegs.length / 2)], replace.find((r) => r.kind.startsWith('png')) ?? jpegs[1]].filter(Boolean);
  const dir = home(args.samples);
  await mkdir(dir, { recursive: true });
  for (const [i, r] of picks.entries()) {
    const a = await sharp(join(BACKUP, r.path)).rotate().resize({ width: 900 }).toBuffer();
    const b = await sharp(join(OUT, r.path)).resize({ width: 900 }).toBuffer();
    const ma = await sharp(a).metadata();
    // 1:1 detail crop from the centre of the compressed image vs the same region of the original.
    const full = await sharp(join(BACKUP, r.path)).rotate().resize({ width: r.dims.split('→')[1].split('x')[0] * 1, withoutEnlargement: true }).toBuffer();
    const fm = await sharp(full).metadata();
    const crop = { left: Math.max(0, Math.floor(fm.width / 2 - 225)), top: Math.max(0, Math.floor(fm.height / 2 - 150)), width: Math.min(450, fm.width), height: Math.min(300, fm.height) };
    const ca = await sharp(full).extract(crop).toBuffer();
    const cb = await sharp(join(OUT, r.path)).extract(crop).toBuffer();
    const W = 1800, H = ma.height + 300 + 10;
    await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
      .composite([
        { input: a, left: 0, top: 0 }, { input: b, left: 900, top: 0 },
        { input: ca, left: 0, top: ma.height + 10 }, { input: cb, left: 900, top: ma.height + 10 },
      ])
      .jpeg({ quality: 92 }).toFile(join(dir, `sample-${i + 1}.jpg`));
    console.log(`sample-${i + 1}: ${r.path}  ${r.kind}  ${r.dims}  ${(r.before / 1024).toFixed(0)} KB → ${(r.after / 1024).toFixed(0)} KB`);
  }
}

if (!APPLY) { console.log('\nNothing was uploaded.'); process.exit(errors.length ? 2 : 0); }

// ── apply: upload the replacements, 3 at a time ─────────────────────────────
const { createClient } = await import('@supabase/supabase-js');
const admin = createClient(process.env.VITE_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function listAll(bucketName, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucketName).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${bucketName}/${prefix} failed: ${error.message}`);
    for (const o of data) {
      const path = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id === null) out.push(...(await listAll(bucketName, path)));
      else out.push({ path, size: o.metadata?.size ?? 0, cacheControl: o.metadata?.cacheControl, mimetype: o.metadata?.mimetype });
    }
    if (data.length < 1000) break;
  }
  return out;
}

// Resume support: skip anything the bucket already holds at the compressed size.
const inBucket = new Map((await listAll(PHOTO_BUCKET)).map((o) => [o.path, o]));
const todoUp = replace.filter((r) => inBucket.get(r.path)?.size !== r.after);
console.log(`\nUploading ${todoUp.length} of ${replace.length} replacements (${replace.length - todoUp.length} already done) — 3 at a time, cache-control "${CACHE_CONTROL}"`);

let up = 0, failed = 0, i = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (i < todoUp.length) {
    const r = todoUp[i++];
    try {
      if (VARIANT_RE.test(r.path)) throw new Error('refusing to touch a variant');
      const buf = await readFile(join(OUT, r.path));
      if (buf.length !== r.after || buf.length >= r.before) throw new Error('compressed file does not match the reviewed plan');
      await upload(r.path, buf, r.contentType);
      up++;
      if (up % 100 === 0) console.log(`  uploaded ${up}/${todoUp.length}`);
    } catch (err) {
      failed++;
      console.warn(`  ✗ upload ${r.path}: ${err.message}`);
    }
  }
}));

// Verify against the bucket, then print the totals.
const after = await listAll(PHOTO_BUCKET);
const byPath = new Map(after.map((o) => [o.path, o]));
const wrong = replace.filter((r) => byPath.get(r.path)?.size !== r.after);
const avatars = await listAll('avatars');
const total = (rows) => rows.reduce((s, o) => s + o.size, 0);
const photos = total(after);
const originalsNow = total(after.filter((o) => !VARIANT_RE.test(o.path)));
const variantsNow = total(after.filter((o) => VARIANT_RE.test(o.path)));
const grand = photos + total(avatars);

console.log(`
Uploaded this run       ${up}   failed ${failed}
Verified in bucket      ${replace.length - wrong.length} / ${replace.length} replacements at the reviewed size${wrong.length ? `  (${wrong.length} not yet — re-run --apply)` : ''}

Bucket totals now
  property-photos       ${mb(photos)}   (originals ${mb(originalsNow)}, variants ${mb(variantsNow)})
  avatars               ${mb(total(avatars))}
  TOTAL                 ${mb(grand)}   ${grand < 1024 ** 3 ? 'under' : 'OVER'} the 1 GB Free-plan limit`);
process.exit(failed || wrong.length ? 2 : 0);
