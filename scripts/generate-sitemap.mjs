#!/usr/bin/env node
// Build-time sitemap generator.
//
// Reads approved property listings + non-archived experiences from Supabase
// and writes a fresh dist/sitemap.xml that includes:
//   - the static marketing routes
//   - one <url> per approved cottage at /property/<id>
//   - one <url> per active/coming-soon experience at /book-experience?id=<id>
//
// On Vercel, env vars are populated automatically. Locally we read .env if
// present so `npm run build` works without exporting them by hand.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const distDir = join(repoRoot, 'dist');
const outPath = join(distDir, 'sitemap.xml');

const SITE = 'https://rentcottage.ge';
const today = new Date().toISOString().split('T')[0];

// --- env loading (Vercel sets these; locally fall back to .env) ----------
const envPath = join(repoRoot, '.env');
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '⚠ VITE_PUBLIC_SUPABASE_URL or VITE_PUBLIC_SUPABASE_ANON_KEY not set; ' +
      'skipping dynamic sitemap (the static one in public/ will be served).',
  );
  process.exit(0);
}

// --- static routes (kept in sync with scripts/prerender.mjs) -------------
const staticRoutes = [
  { path: '', changefreq: 'daily', priority: '1.0' },
  { path: 'search', changefreq: 'daily', priority: '0.9' },
  { path: 'about-georgia', changefreq: 'monthly', priority: '0.8' },
  { path: 'how-it-works', changefreq: 'monthly', priority: '0.8' },
  { path: 'become-host', changefreq: 'monthly', priority: '0.8' },
  { path: 'host-resources', changefreq: 'monthly', priority: '0.7' },
  { path: 'book-experience', changefreq: 'weekly', priority: '0.8' },
  { path: 'privacy', changefreq: 'yearly', priority: '0.3' },
  { path: 'terms', changefreq: 'yearly', priority: '0.3' },
  { path: 'sitemap', changefreq: 'monthly', priority: '0.3' },
];

// --- fetch dynamic data --------------------------------------------------
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const [propertiesRes, experiencesRes] = await Promise.all([
  supabase
    .from('property_applications')
    .select('id, created_at')
    .eq('status', 'approved'),
  supabase
    .from('experiences')
    .select('id, created_at')
    .neq('status', 'archived'),
]);

if (propertiesRes.error) {
  console.error('Failed to fetch properties:', propertiesRes.error.message);
  process.exit(1);
}
if (experiencesRes.error) {
  console.error('Failed to fetch experiences:', experiencesRes.error.message);
  process.exit(1);
}

const properties = propertiesRes.data ?? [];
const experiences = experiencesRes.data ?? [];

// --- build XML -----------------------------------------------------------
const escape = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const lastmod = (row) =>
  (row.created_at || today).toString().split('T')[0];

const urlBlock = (loc, mod, freq, priority) =>
  `  <url>\n` +
  `    <loc>${escape(loc)}</loc>\n` +
  `    <lastmod>${mod}</lastmod>\n` +
  `    <changefreq>${freq}</changefreq>\n` +
  `    <priority>${priority}</priority>\n` +
  `  </url>`;

const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
];

for (const r of staticRoutes) {
  lines.push(urlBlock(`${SITE}/${r.path}`, today, r.changefreq, r.priority));
}

for (const p of properties) {
  lines.push(
    urlBlock(`${SITE}/property/${p.id}`, lastmod(p), 'weekly', '0.7'),
  );
}

for (const e of experiences) {
  lines.push(
    urlBlock(
      `${SITE}/book-experience?id=${e.id}`,
      lastmod(e),
      'weekly',
      '0.6',
    ),
  );
}

lines.push('</urlset>', '');
writeFileSync(outPath, lines.join('\n'), 'utf8');

console.log(
  `\nGenerated sitemap.xml: ${staticRoutes.length} static + ${properties.length} properties + ${experiences.length} experiences = ${staticRoutes.length + properties.length + experiences.length} URLs`,
);
