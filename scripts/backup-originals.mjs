#!/usr/bin/env node
// Stage 1 of shrinking storage: download every ORIGINAL property photo to a
// local folder before anything in the bucket is changed.
//
//   property-photos/<path>  →  ~/rentcottage-photo-backup/<path>
//
// Skips the -400 / -1600 WebP display variants (they can be regenerated) and
// zero-byte objects (nothing to back up). Read-only against the bucket:
// public object URLs + the anon key for listing; no service-role key needed.
//
// Resumable: a file already on disk with the bucket's exact byte size is not
// downloaded again, so a re-run after an interruption only fetches what's
// missing (and costs only that much egress).
//
// Writes <backup>/manifest.json: path, size, sha256 per file — Stage 2 and 3
// use it, and it lets you verify a copy on an external drive later.
//
// Usage (repo root):
//   node --env-file=.env scripts/backup-originals.mjs --list-only   # counts + size, downloads nothing
//   node --env-file=.env scripts/backup-originals.mjs               # download
// Options: --dest=DIR (default ~/rentcottage-photo-backup), --concurrency=N (default 4)

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile, readFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PHOTO_BUCKET, VARIANT_RE } from './lib/variants.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const LIST_ONLY = args['list-only'] === true;
const DEST = resolve(args.dest ? String(args.dest).replace(/^~/, homedir()) : join(homedir(), 'rentcottage-photo-backup'));
const CONCURRENCY = Number(args.concurrency ?? 4);

const SUPABASE_URL = process.env.VITE_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Need VITE_PUBLIC_SUPABASE_URL and VITE_PUBLIC_SUPABASE_ANON_KEY (run with --env-file=.env).');
  process.exit(1);
}
const bucket = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } }).storage.from(PHOTO_BUCKET);

async function listAll(prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list "${prefix}" failed: ${error.message}`);
    for (const o of data) {
      const path = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id === null) out.push(...(await listAll(path)));
      else out.push({ path, size: o.metadata?.size ?? 0 });
    }
    if (data.length < 1000) break;
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchRetry(url, tries = 6) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try { res = await fetch(url); } catch (err) { if (attempt >= tries - 1) throw err; }
    if (res && ((res.status !== 429 && res.status < 500) || attempt >= tries - 1)) return res;
    const after = Number(res?.headers.get('retry-after'));
    await sleep(after > 0 ? after * 1000 : 500 * 2 ** attempt + Math.random() * 250);
  }
}

const publicUrl = (path) =>
  `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// ── main ────────────────────────────────────────────────────────────────────
const all = await listAll();
const originals = all.filter((o) => !VARIANT_RE.test(o.path));
const empty = originals.filter((o) => o.size === 0);
const todo = originals.filter((o) => o.size > 0);
const expectedBytes = todo.reduce((s, o) => s + o.size, 0);

console.log(`Bucket ${PHOTO_BUCKET}: ${all.length} objects`);
console.log(`  originals to back up   ${todo.length}  (${mb(expectedBytes)})`);
console.log(`  zero-byte, skipped     ${empty.length}`);
console.log(`  -400/-1600 variants    ${all.length - originals.length}  (not backed up)`);
console.log(`Destination: ${DEST}\n`);
if (LIST_ONLY) process.exit(0);

await mkdir(DEST, { recursive: true });
const manifest = [];
const failed = [];
let downloadedBytes = 0, reused = 0, n = 0;

let next = 0;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
  while (next < todo.length) {
    const o = todo[next++];
    const file = join(DEST, o.path);
    try {
      const onDisk = await stat(file).catch(() => null);
      let buf;
      if (onDisk && onDisk.size === o.size) {
        buf = await readFile(file);
        reused++;
      } else {
        const res = await fetchRetry(publicUrl(o.path));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buf = Buffer.from(await res.arrayBuffer());
        if (buf.length !== o.size) throw new Error(`size mismatch: got ${buf.length}, bucket says ${o.size}`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(`${file}.part`, buf);
        await rename(`${file}.part`, file); // never leave a half-written file under the real name
        downloadedBytes += buf.length;
      }
      manifest.push({ path: o.path, size: buf.length, sha256: sha256(buf) });
    } catch (err) {
      failed.push({ path: o.path, error: String(err?.message ?? err) });
      console.warn(`  ✗ ${o.path}: ${failed.at(-1).error}`);
    }
    if (++n % 100 === 0) console.log(`  … ${n}/${todo.length}`);
  }
}));

manifest.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(join(DEST, 'manifest.json'), JSON.stringify({
  bucket: PHOTO_BUCKET, createdAt: new Date().toISOString(), files: manifest, skippedEmpty: empty.map((o) => o.path),
}, null, 2));

const backedUpBytes = manifest.reduce((s, f) => s + f.size, 0);
const ok = failed.length === 0 && manifest.length === todo.length && backedUpBytes === expectedBytes;
console.log(`
Backed up      ${manifest.length} / ${todo.length} files   ${mb(backedUpBytes)} / ${mb(expectedBytes)}
  downloaded   ${mb(downloadedBytes)} this run (egress)   reused from disk: ${reused}
Failed         ${failed.length}
Manifest       ${join(DEST, 'manifest.json')}
${ok ? 'VERIFIED: file count and total bytes match the bucket exactly.' : 'NOT COMPLETE — re-run to fetch the rest (only missing files are downloaded).'}`);
process.exit(ok ? 0 : 2);
