#!/usr/bin/env node
// Post-build prerender for static marketing routes.
//
// Vite outputs a single dist/index.html. The React SEO component updates
// <title> + <meta> tags at runtime via useEffect, which means crawlers and
// link-preview bots that don't run JS only ever see the home-page meta tags.
//
// This script copies dist/index.html to dist/<route>/index.html for each
// known static route and patches its <title>, description, canonical, OG,
// and Twitter tags so crawlers see the correct metadata for every URL.
// React still hydrates the SPA on top — users see no difference.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const indexPath = join(distDir, 'index.html');

const SITE = 'https://rentcottage.ge';
const OG = `${SITE}/og-image.png`;

/**
 * @typedef {Object} Route
 * @property {string} path        URL path (no leading slash for the file system)
 * @property {string} title       Full <title> text
 * @property {string} description Meta description (1-2 sentences, ~150 chars)
 */

/** @type {Route[]} */
const routes = [
  // Home is dist/index.html itself — already has correct meta from index.html
  // template, but we still patch it for consistency in case index.html changes.
  {
    path: '',
    title: 'RentCottage.Ge — Georgian Cottage Rentals | Tbilisi, Batumi, Kakheti',
    description:
      'Find and book unique Georgian cottage rentals across Tbilisi, Batumi, Kakheti and Gudauri. Verified cottages, mountain retreats and traditional Georgian homes.',
  },
  {
    path: 'how-it-works',
    title: 'How It Works — Booking Cottages in Georgia | RentCottage.Ge',
    description:
      'Step-by-step guide to finding, booking and staying in unique Georgian cottages. Learn how to search, contact hosts, and confirm your reservation.',
  },
  {
    path: 'about-georgia',
    title: 'About Georgia — Travel Guide to Caucasus Country | RentCottage.Ge',
    description:
      'Discover Georgia in the Caucasus — culture, cuisine, mountains and 8,000 years of winemaking. The traveller\'s guide for planning your stay.',
  },
  {
    path: 'become-host',
    title: 'Become a Host — List Your Georgian Cottage | RentCottage.Ge',
    description:
      'List your property on RentCottage.Ge and reach guests looking for authentic Georgian stays. No upfront fees, simple onboarding, dedicated support.',
  },
  {
    path: 'host-resources',
    title: 'Host Resources — Tools and Tips for Cottage Owners | RentCottage.Ge',
    description:
      'Practical guides, pricing strategies and best practices for Georgian cottage hosts. Make your listing stand out and grow bookings.',
  },
  {
    path: 'privacy',
    title: 'Privacy Policy | RentCottage.Ge',
    description:
      'How RentCottage.Ge collects, stores and uses your personal data. GDPR-aware privacy practices for guests and hosts.',
  },
  {
    path: 'terms',
    title: 'Terms & Conditions | RentCottage.Ge',
    description:
      'The rules of using RentCottage.Ge — booking process, payments, cancellation policies, host and guest responsibilities.',
  },
  {
    path: 'sitemap',
    title: 'Site Map | RentCottage.Ge',
    description:
      'All RentCottage.Ge pages organised in one place — search, locations, hosting and support.',
  },
];

const escape = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Replace a single tag's content. Works against the existing patterns we set in
 * index.html. If the tag isn't present (e.g. canonical), we append it.
 */
function patchTag(html, regex, replacement, fallback) {
  if (regex.test(html)) return html.replace(regex, replacement);
  return html.replace('</head>', `  ${fallback}\n  </head>`);
}

function patchHtml(template, route) {
  const url = `${SITE}/${route.path}`;
  const t = escape(route.title);
  const d = escape(route.description);

  let html = template;

  // <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`);

  // name="description"
  html = patchTag(
    html,
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${d}" />`,
    `<meta name="description" content="${d}" />`,
  );

  // canonical
  html = patchTag(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${url}" />`,
    `<link rel="canonical" href="${url}" />`,
  );

  // og:title / og:description / og:url / og:image
  html = html.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${t}" />`,
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${d}" />`,
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${url}" />`,
  );
  html = html.replace(
    /<meta property="og:image" content="[^"]*"\s*\/?>/g,
    `<meta property="og:image" content="${OG}" />`,
  );
  html = html.replace(
    /<meta property="og:image:secure_url" content="[^"]*"\s*\/?>/g,
    `<meta property="og:image:secure_url" content="${OG}" />`,
  );

  // twitter:title / twitter:description / twitter:image
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${t}" />`,
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${d}" />`,
  );
  html = html.replace(
    /<meta name="twitter:image" content="[^"]*"\s*\/?>/g,
    `<meta name="twitter:image" content="${OG}" />`,
  );

  return html;
}

const template = readFileSync(indexPath, 'utf8');

let written = 0;
for (const route of routes) {
  const html = patchHtml(template, route);
  const outPath = route.path
    ? join(distDir, route.path, 'index.html')
    : indexPath;
  if (route.path) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');
  written += 1;
  console.log(`  ✓ /${route.path}  →  ${route.title}`);
}

console.log(`\nPrerendered ${written} route${written === 1 ? '' : 's'}.`);
