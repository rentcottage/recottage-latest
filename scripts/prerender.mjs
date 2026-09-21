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
//
// It also writes one document per APPROVED LISTING, at
// dist/property/<id>/index.html, plus /search. Before that, those URLs had no
// file of their own, so Vercel's SPA rewrite served them the homepage document
// verbatim: homepage title, homepage description, homepage og:image, and
// <link rel="canonical" href="https://rentcottage.ge/"> on all 101 listings —
// 93% of the sitemap pointing its canonical at the homepage, and every share
// of a cottage previewing as the generic site card.
//
// NO URL CHANGES. Every path written here already existed and already
// resolved; this only changes WHAT is served at it, never WHERE. Vercel
// prefers a matching static file over the "/(.*)" rewrite in vercel.json, so
// dist/property/<id>/index.html simply takes over from the fallback, query
// strings and client routing untouched.
//
// The listing metadata is built in scripts/lib/seo.mjs, which exists so that
// what is written here and what SEO.tsx sets after hydration are the same
// strings. If they drift, a crawler indexes one title and the reader sees
// another — see the parity note in that file.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_OG,
  SITE,
  fetchApprovedListings,
  listingRoute,
  loadEnv,
} from './lib/seo.mjs';
import {
  CATEGORY_KA,
  georgianName,
  landingBodyHtml,
  landingDescription,
  landingJsonLd,
  landingOgImage,
  landingTitle,
} from './lib/landing.mjs';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const distDir = join(repoRoot, 'dist');
const indexPath = join(distDir, 'index.html');

const OG = DEFAULT_OG;

/**
 * @typedef {Object} Route
 * @property {string} path        URL path (no leading slash for the file system)
 * @property {string} title       Full <title> text
 * @property {string} description Meta description (1-2 sentences, ~150 chars)
 * @property {string} [keywords]  Meta keywords, when the page sets its own
 * @property {string} [ogType]    og:type, when it is not the template's "website"
 * @property {string} [ogImage]   Absolute share image URL; defaults to the site card
 * @property {string} [ogImageAlt] Alt text for that image
 * @property {string} [bodyHtml]  Crawler-visible markup injected into #root
 * @property {object[]} [jsonLd]  Structured data emitted into the document
 */

/** @type {Route[]} */
const routes = [
  // Home is dist/index.html itself — already has correct meta from index.html
  // template, but we still patch it for consistency in case index.html changes.
  {
    path: '',
    title: 'RentCottage.ge — Georgian Cottage Rentals | Tbilisi, Batumi, Kakheti',
    description:
      'Find and book unique Georgian cottage rentals across Tbilisi, Batumi, Kakheti and Gudauri. Verified cottages, mountain retreats and traditional Georgian homes.',
  },
  {
    // The no-parameter form. /search?location=… keeps serving this document —
    // Vercel matches the path, the query string is the client's business —
    // so the copy here must be the unfiltered wording the page itself uses,
    // and the canonical stays /search for every filter combination.
    path: 'search',
    title: 'Search Georgian Cottage Rentals — RentCottage.ge',
    description:
      'Browse hundreds of verified Georgian cottages, mountain retreats and lakeside properties. Filter by location, price and amenities. Find your perfect cottage rental in Georgia.',
    keywords:
      'Georgian cottage search, rent cottage Georgia, vacation rental Georgia, mountain cottage Georgia, traditional Georgian home rental',
  },
  {
    path: 'how-it-works',
    title: 'How It Works — Booking Cottages in Georgia | RentCottage.ge',
    description:
      'Step-by-step guide to finding, booking and staying in unique Georgian cottages. Learn how to search, contact hosts, and confirm your reservation.',
  },
  {
    path: 'about-georgia',
    title: 'About Georgia — Travel Guide to Caucasus Country | RentCottage.ge',
    description:
      'Discover Georgia in the Caucasus — culture, cuisine, mountains and 8,000 years of winemaking. The traveller\'s guide for planning your stay.',
  },
  {
    path: 'become-host',
    title: 'Become a Host — List Your Georgian Cottage | RentCottage.ge',
    description:
      'List your property on RentCottage.ge and reach guests looking for authentic Georgian stays. No upfront fees, simple onboarding, dedicated support.',
  },
  {
    path: 'host-resources',
    title: 'Host Resources — Tools and Tips for Cottage Owners | RentCottage.ge',
    description:
      'Practical guides, pricing strategies and best practices for Georgian cottage hosts. Make your listing stand out and grow bookings.',
  },
  {
    path: 'privacy',
    title: 'Privacy Policy | RentCottage.ge',
    description:
      'How RentCottage.ge collects, stores and uses your personal data. GDPR-aware privacy practices for guests and hosts.',
  },
  {
    path: 'terms',
    title: 'Terms & Conditions | RentCottage.ge',
    description:
      'The rules of using RentCottage.ge — booking process, payments, cancellation policies, host and guest responsibilities.',
  },
  {
    path: 'sitemap',
    title: 'Site Map | RentCottage.ge',
    description:
      'All RentCottage.ge pages organised in one place — search, locations, hosting and support.',
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
  const image = escape(route.ogImage || OG);

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

  // keywords — only when the route sets its own, so the template's site-wide
  // list survives on the pages that never overrode it.
  if (route.keywords) {
    const k = escape(route.keywords);
    html = patchTag(
      html,
      /<meta name="keywords" content="[^"]*"\s*\/?>/,
      `<meta name="keywords" content="${k}" />`,
      `<meta name="keywords" content="${k}" />`,
    );
  }

  // og:type — "product" for a listing, the template's "website" otherwise.
  if (route.ogType) {
    const ty = escape(route.ogType);
    html = patchTag(
      html,
      /<meta property="og:type" content="[^"]*"\s*\/?>/,
      `<meta property="og:type" content="${ty}" />`,
      `<meta property="og:type" content="${ty}" />`,
    );
  }

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
    `<meta property="og:image" content="${image}" />`,
  );
  html = html.replace(
    /<meta property="og:image:secure_url" content="[^"]*"\s*\/?>/g,
    `<meta property="og:image:secure_url" content="${image}" />`,
  );

  // og:image:type — the template declares image/png for the site card. A
  // listing's image comes from the storage render endpoint, which negotiates
  // JPEG or WebP per request, so there is no one type to declare. The tag is
  // removed rather than left asserting something false; it is optional, and
  // every preview bot sniffs the real type anyway.
  if (route.ogImage) {
    html = html.replace(/\s*<meta property="og:image:type" content="[^"]*"\s*\/?>/g, '');
  }

  // og:image:alt — describes the picture, so a listing's card says which
  // cottage it shows instead of repeating the site tagline.
  if (route.ogImageAlt) {
    const a = escape(route.ogImageAlt);
    html = html.replace(
      /<meta property="og:image:alt" content="[^"]*"\s*\/?>/g,
      `<meta property="og:image:alt" content="${a}" />`,
    );
    html = html.replace(
      /<meta name="twitter:image:alt" content="[^"]*"\s*\/?>/g,
      `<meta name="twitter:image:alt" content="${a}" />`,
    );
  }

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
    `<meta name="twitter:image" content="${image}" />`,
  );

  // Structured data, in the SERVED html. Everywhere else on the site the
  // JSON-LD is injected by SEO.tsx after React mounts, which a crawler that
  // does not run JavaScript never sees.
  if (route.jsonLd?.length) {
    const blocks = route.jsonLd
      .map((schema) => `  <script type="application/ld+json">${JSON.stringify(schema)}</script>`)
      .join('\n');
    html = html.replace('</head>', `${blocks}\n  </head>`);
  }

  // The crawler-visible body. It goes INSIDE #root, so React's first render
  // replaces it wholesale and there is no duplicated markup left behind for a
  // reader; a bot that never runs the bundle keeps the links and the copy.
  if (route.bodyHtml) {
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root">\n${route.bodyHtml}\n  </div>`,
    );
  }

  return html;
}

const template = readFileSync(indexPath, 'utf8');

/** Writes one document. `path` is relative and already URL-safe. */
function write(route) {
  const html = patchHtml(template, route);
  const outPath = route.path ? join(distDir, route.path, 'index.html') : indexPath;
  if (route.path) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');
}

for (const route of routes) {
  write(route);
  console.log(`  ✓ /${route.path}  →  ${route.title}`);
}
console.log(`\nPrerendered ${routes.length} static route${routes.length === 1 ? '' : 's'}.`);

// ── Listings ─────────────────────────────────────────────────────────────────
//
// One document per approved cottage. The ids come from public_properties, the
// same view the sitemap is built from, so the set of files written here and
// the set of /property/<id> URLs in sitemap.xml are the same set by
// construction — no second source of truth to drift.
//
// A build without Supabase credentials keeps the static routes and skips
// these, matching how scripts/generate-sitemap.mjs already behaves. The site
// then serves what it served before this change, which is the safe direction.

loadEnv(repoRoot);

// Per-listing JSON-LD, built during `vite build` by the module the property
// page itself calls (src/lib/listingSchema.ts). Missing artifact means the
// pages are written without structured data rather than with wrong data.
const SCHEMA_INDEX = join(repoRoot, 'listing-schemas.json');
const listingSchemas = existsSync(SCHEMA_INDEX)
  ? JSON.parse(readFileSync(SCHEMA_INDEX, 'utf8'))
  : {};

const listings = await fetchApprovedListings();

if (listings === null) {
  console.warn(
    '\n⚠ VITE_PUBLIC_SUPABASE_URL or VITE_PUBLIC_SUPABASE_ANON_KEY not set; ' +
      'skipping listing prerender (those URLs keep falling back to index.html).',
  );
} else {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let listingsWritten = 0;
  let schemasWritten = 0;
  let skipped = 0;

  for (const listing of listings) {
    // The id becomes a directory name, so it is checked rather than trusted.
    // It is a uuid primary key, not user input — but this is the one place a
    // database value is turned into a filesystem path.
    if (!UUID_RE.test(String(listing.id ?? '')) || !listing.title || !listing.location) {
      skipped += 1;
      continue;
    }
    const route = listingRoute(listing);
    const schema = listingSchemas[listing.id];
    write({
      ...route,
      ogImageAlt: `${listing.title} — ${listing.location}, Georgia`,
      jsonLd: schema ? [schema] : undefined,
    });
    if (schema) schemasWritten += 1;
    listingsWritten += 1;
  }

  console.log(
    `Prerendered ${listingsWritten} listing page${listingsWritten === 1 ? '' : 's'}, ` +
    `${schemasWritten} with structured data.`,
  );
  if (listingsWritten > 0 && schemasWritten < listingsWritten) {
    console.warn(`⚠ ${listingsWritten - schemasWritten} listing page(s) have no JSON-LD.`);
  }
  if (skipped > 0) {
    console.warn(`⚠ Skipped ${skipped} listing(s) with a missing id, title or location.`);
  }
}

// ── Landing pages ────────────────────────────────────────────────────────────
//
// /cottages/<slug>: one page per region, per town and per category with at
// least three cottages. The grouping was done during `vite build` with the
// app's own matchers and left in landing-groups.json — see vite.config.ts for
// why it cannot be done here. This step only renders it.

const LANDING_INDEX = join(repoRoot, 'landing-groups.json');

if (!existsSync(LANDING_INDEX)) {
  console.warn('\n⚠ landing-groups.json missing; skipping landing pages.');
} else {
  const { groups } = JSON.parse(readFileSync(LANDING_INDEX, 'utf8'));
  const { enToKa, cityToRegion } = JSON.parse(
    readFileSync(join(repoRoot, 'src/data/regions.json'), 'utf8'),
  );

  const bySlug = new Map(groups.map((g) => [g.slug, g]));
  const regions = groups.filter((g) => g.kind === 'region');
  const cities = groups.filter((g) => g.kind === 'city');
  const categories = groups.filter((g) => g.kind === 'category');
  // A category's display name is its Georgian label from the app's own i18n;
  // a place's comes from the place dictionary. Without this a Georgian page
  // reads "Mountain — კოტეჯები საქართველოში".
  const nameOf = (g) => (g.kind === 'category'
    ? (CATEGORY_KA[g.key] ?? g.key)
    : georgianName(g.key, enToKa));
  const linkOf = (g) => ({ slug: g.slug, name: nameOf(g) });

  /** The region page for a city, when that region has a page of its own. */
  const regionPageForCity = (cityKey) => {
    const regionKey = cityToRegion[cityKey];
    if (!regionKey) return null;
    const g = bySlug.get(regionKey.replace(/\s+/g, '-'));
    return g && g.kind === 'region' ? g : null;
  };

  let landingWritten = 0;
  for (const group of groups) {
    const displayName = nameOf(group);

    // Region pages are hubs: they link down to every town page inside them.
    // Town pages link back up to their region and sideways to the other towns
    // in it. "Sideways" means "also has cottages", not "is geographically
    // near" — adjacency is not in the data and is not claimed.
    let regionLink = null;
    let cityLinks = [];
    let siblingLinks = [];

    if (group.kind === 'region') {
      cityLinks = cities.filter((c) => cityToRegion[c.key] === group.key).map(linkOf);
      siblingLinks = regions.filter((r) => r.slug !== group.slug).map(linkOf);
    } else if (group.kind === 'city') {
      const region = regionPageForCity(group.key);
      if (region) regionLink = linkOf(region);
      siblingLinks = cities
        .filter((c) => c.slug !== group.slug && cityToRegion[c.key] === cityToRegion[group.key])
        .map(linkOf);
    } else {
      siblingLinks = categories.filter((c) => c.slug !== group.slug).map(linkOf);
    }

    const ctx = {
      displayName,
      regionLink,
      cityLinks,
      siblingLinks,
      categoryLinks: group.kind === 'category' ? [] : categories.map(linkOf),
    };

    write({
      path: `cottages/${group.slug}`,
      title: landingTitle(group, ctx),
      description: landingDescription(group, ctx),
      ogType: 'website',
      ogImage: landingOgImage(group),
      ogImageAlt: landingTitle(group, ctx),
      jsonLd: landingJsonLd(group, ctx),
      bodyHtml: landingBodyHtml(group, ctx),
    });
    landingWritten += 1;
  }
  console.log(
    `Prerendered ${landingWritten} landing page${landingWritten === 1 ? '' : 's'} ` +
    `(${regions.length} region, ${cities.length} city, ${categories.length} category).`,
  );
}
