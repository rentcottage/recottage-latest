// Renders the /cottages/<slug> landing pages into real HTML.
//
// The grouping is NOT done here — vite.config.ts already did it with the app's
// own regionMatches()/canonicalCity() and left the result in
// landing-groups.json. This module turns one of those groups into a document:
// Georgian copy built only from the numbers in the group, a list of the
// cottages as ordinary <a href> links, and the JSON-LD.
//
// EVERY FACT ON THESE PAGES IS COUNTED FROM THE LISTINGS. How many cottages,
// what they cost, how many guests they sleep, which categories they carry,
// which other pages exist. There is nothing about scenery, weather, history or
// what there is to do, because none of that is in the database and none of it
// would be verifiable. Region adjacency is not claimed either: the brief asked
// for "nearby regions", but adjacency is not derivable from the data, so the
// copy links other regions that HAVE cottages and says exactly that.
//
// The copy is machine-generated and marked for the owner to review — see
// OWNER_REVIEW_MARK, which is emitted as an HTML comment on every page.

import { DEFAULT_OG, SITE, ogImageUrl } from './seo.mjs';

/** Emitted into every generated page so the copy can be found and reviewed. */
export const OWNER_REVIEW_MARK =
  '<!-- rc:owner-review copy="machine-generated from listing data; owner review pending" -->';

/** Georgian category labels, copied from the app's own i18n (becomeHost, ka). */
export const CATEGORY_KA = {
  Mountain: 'მთა',
  Lakeside: 'ტბის სანაპირო',
  Traditional: 'ტრადიციული',
  Forest: 'ტყე',
  Countryside: 'სოფლის მხარე',
  Winery: 'მარანი',
};

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * The Georgian name for a canonical key, from the same dictionary the app
 * uses. Falls back to the key itself, which is the stored English spelling.
 */
export function georgianName(key, enToKa) {
  const names = enToKa?.[key];
  if (Array.isArray(names) && names.length) return names[0];
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Numbers ──────────────────────────────────────────────────────────────────

function stats(listings) {
  const prices = listings.map((l) => Number(l.price_per_night)).filter(Number.isFinite).sort((a, b) => a - b);
  const guests = listings.map((l) => Number(l.max_guests)).filter(Number.isFinite).sort((a, b) => a - b);
  const beds = listings.map((l) => Number(l.bedrooms)).filter(Number.isFinite).sort((a, b) => a - b);
  const cats = {};
  for (const l of listings) for (const c of (l.categories || [])) cats[c] = (cats[c] || 0) + 1;
  const mid = (a) => (a.length ? a[Math.floor(a.length / 2)] : null);
  const median = mid(prices);
  const photos = listings.map((l) => {
    const urls = [l.cover_photo_url, ...(Array.isArray(l.photo_urls) ? l.photo_urls : [])];
    return new Set(urls.filter((u) => typeof u === 'string' && u.trim())).size;
  });
  return {
    n: listings.length,
    belowMid: prices.filter((x) => x < median).length,
    bigGroups: guests.filter((g) => g >= 6).length,
    photoAvg: photos.length ? Math.round(photos.reduce((a, b) => a + b, 0) / photos.length) : 0,
    wellPhotographed: photos.filter((n) => n >= 10).length,
    priceMin: prices[0] ?? null,
    priceMax: prices[prices.length - 1] ?? null,
    priceMid: mid(prices),
    guestMin: guests[0] ?? null,
    guestMax: guests[guests.length - 1] ?? null,
    bedMid: mid(beds),
    categories: Object.entries(cats).sort((a, b) => b[1] - a[1]),
  };
}

// ── Georgian case endings ────────────────────────────────────────────────────
//
// Georgian place names decline, and "ამბროლაური" + "ში" is not a word. Two
// rules cover every name on these pages, and both are mechanical:
//
//   locative ("in X", -ში):  a final ი is dropped, everything else is kept.
//       ამბროლაური→ამბროლაურში  ბათუმი→ბათუმში  ქედა→ქედაში  მესტია→მესტიაში
//   genitive ("of X", -ის):  a final ი OR ა is dropped.
//       რაჭა-ლეჩხუმი→რაჭა-ლეჩხუმის  აჭარა→აჭარის  მცხეთა→მცხეთის
//
// Verified against all 27 generated names in tests/frontend/landing.test.ts.
// A name in Latin script is left alone — it takes no Georgian ending.

const GEORGIAN_RE = /[\u10A0-\u10FF]/;

/** "in X" — ამბროლაური → ამბროლაურში. */
export function locative(name) {
  if (!GEORGIAN_RE.test(name)) return name;
  return `${name.endsWith('ი') ? name.slice(0, -1) : name}ში`;
}

/** "of X" — რაჭა-ლეჩხუმი → რაჭა-ლეჩხუმის. */
export function genitive(name) {
  if (!GEORGIAN_RE.test(name)) return name;
  return `${/[ია]$/u.test(name) ? name.slice(0, -1) : name}ის`;
}

/**
 * 120-200 Georgian words, assembled from the counts above and nothing else.
 * `links` are the sibling pages this page should point at, already resolved.
 */
export function buildCopy(group, ctx) {
  const s = stats(group.listings);
  const name = ctx.displayName;
  const p = [];

  const where = group.kind === 'category'
    ? `„${name}“ კატეგორიაში`
    : locative(name);

  p.push(
    `RentCottage.Ge-ზე ${where} ამჟამად ${s.n} კოტეჯია გამოქვეყნებული. ` +
    `თითოეული მათგანი მასპინძელმა თავად დაამატა და ადმინისტრაციამ დაადასტურა, ` +
    `ჯავშანი კი პირდაპირ ამ საიტიდან კეთდება, შუამავლის გარეშე.`,
  );

  if (s.priceMin != null && s.priceMax != null) {
    p.push(
      s.priceMin === s.priceMax
        ? `ღამის ფასი ყველგან ${s.priceMin} ლარია.`
        : `ღამის ფასი ${s.priceMin} ლარიდან ${s.priceMax} ლარამდე მერყეობს, ` +
          `მედიანური ფასი კი ${s.priceMid} ლარია. ` +
          `${s.belowMid} კოტეჯი ${s.priceMid} ლარზე იაფია.`,
    );
  }

  if (s.guestMin != null && s.guestMax != null) {
    const big = s.bigGroups > 0
      ? ` მათგან ${s.bigGroups} კოტეჯი ექვს ან მეტ სტუმარს იტევს.`
      : '';
    p.push(
      (s.guestMin === s.guestMax
        ? `კოტეჯები ${s.guestMin} სტუმარზეა გათვლილი.`
        : `ტევადობა ${s.guestMin}-დან ${s.guestMax} სტუმრამდეა.`) + big,
    );
  }
  if (s.bedMid != null) {
    p.push(
      `საძინებლების მედიანური რაოდენობა ${s.bedMid}-ია, ` +
      `ფოტოების საშუალო რაოდენობა კი ერთ განცხადებაზე — ${s.photoAvg}. ` +
      `${s.wellPhotographed} განცხადებას ათი ან მეტი ფოტო აქვს, ` +
      `ანუ კოტეჯის ნახვა ჯავშნამდეც შეგიძლიათ.`,
    );
  }

  if (s.categories.length) {
    const list = s.categories
      .map(([c, n]) => `${CATEGORY_KA[c] ?? c} — ${n}`)
      .join(', ');
    p.push(
      `კატეგორიების მიხედვით განაწილება ასეთია: ${list}. ` +
      `ერთ კოტეჯს ერთზე მეტი კატეგორია შეიძლება ჰქონდეს.`,
    );
  }

  if (ctx.regionLink) {
    p.push(
      `${name} ${genitive(ctx.regionLink.name)} რეგიონშია. ` +
      `ამ რეგიონის ყველა კოტეჯი ცალკე გვერდზეა თავმოყრილი.`,
    );
  }
  if (ctx.cityLinks?.length) {
    const names = ctx.cityLinks.map((c) => c.name).join(', ');
    p.push(`რეგიონში ცალკე გვერდი აქვს შემდეგ ადგილებს: ${names}.`);
  }
  if (ctx.siblingLinks?.length) {
    const names = ctx.siblingLinks.map((c) => c.name).join(', ');
    p.push(
      group.kind === 'city'
        ? `იმავე რეგიონში კოტეჯები აქვს აგრეთვე: ${names}.`
        : `კოტეჯები სხვა რეგიონებშიც გვაქვს: ${names}.`,
    );
  }

  p.push(
    `ფასები, თავისუფალი თარიღები და ფოტოები ავტომატურად ახლდება მასპინძლის ` +
    `განცხადებიდან, ამიტომ ამ გვერდზე მოცემული რიცხვები მიმდინარე მდგომარეობას ასახავს. ` +
    `კონკრეტული კოტეჯის გვერდზე ნახავთ სრულ აღწერას, ყველა ფოტოს, ` +
    `თავისუფალი თარიღების კალენდარს და ჯავშნის ფორმას.`,
  );

  return p;
}

/** Rough word count, for the 120-200 budget. */
export function wordCount(paragraphs) {
  return paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
}

// ── Document pieces ──────────────────────────────────────────────────────────

export function landingTitle(group, ctx) {
  const name = ctx.displayName;
  const n = group.listings.length;
  if (group.kind === 'category') return `${name} — ${n} კოტეჯი საქართველოში | RentCottage.Ge`;
  return `კოტეჯები ${locative(name)} — ${n} ვარიანტი | RentCottage.Ge`;
}

export function landingDescription(group, ctx) {
  const s = stats(group.listings);
  const name = ctx.displayName;
  const price = s.priceMin != null
    ? (s.priceMin === s.priceMax ? `${s.priceMin} ლარად` : `${s.priceMin}-დან ${s.priceMax} ლარამდე`)
    : '';
  const cap = s.guestMax != null ? ` ${s.guestMin}-${s.guestMax} სტუმრისთვის.` : '';
  const head = group.kind === 'category'
    ? `„${name}“ კატეგორიის ${s.n} კოტეჯი საქართველოში`
    : `${s.n} კოტეჯი ${locative(name)}`;
  return `${head}${price ? `, ღამე ${price}` : ''}.${cap} დამოწმებული ბინადრობა, პირდაპირი ჯავშანი RentCottage.Ge-ზე.`;
}

export function landingH1(group, ctx) {
  return group.kind === 'category'
    ? `${ctx.displayName} — კოტეჯები საქართველოში`
    : `კოტეჯები ${locative(ctx.displayName)}`;
}

/** A representative photo: the first listing that has a usable one. */
export function landingOgImage(group) {
  for (const l of group.listings) {
    const url = ogImageUrl(l);
    if (url && url !== DEFAULT_OG) return url;
  }
  return DEFAULT_OG;
}

/**
 * The cottages, as ordinary links. This is the part that has to exist without
 * JavaScript: a crawler reaching /cottages/kakheti must be able to walk from
 * here to all eight Kakheti cottages, and these <a href> elements are how.
 */
export function listingsHtml(group) {
  const items = group.listings.map((l) => {
    const href = `${SITE}/property/${l.id}`;
    const img = ogImageUrl(l);
    const price = Number(l.price_per_night);
    const guests = Number(l.max_guests);
    return [
      '      <li class="rc-landing__item">',
      `        <a class="rc-landing__link" href="${escapeHtml(href)}">`,
      `          <img class="rc-landing__img" src="${escapeHtml(img)}" alt="${escapeHtml(l.title)}" loading="lazy" decoding="async" width="1200" height="630" />`,
      `          <span class="rc-landing__name">${escapeHtml(l.title)}</span>`,
      `          <span class="rc-landing__meta">${escapeHtml(l.location)}</span>`,
      `          <span class="rc-landing__price">${Number.isFinite(price) ? `₾${price} / ღამე` : ''}` +
        `${Number.isFinite(guests) ? ` · ${guests} სტუმარი` : ''}</span>`,
      '        </a>',
      '      </li>',
    ].join('\n');
  });
  return `    <ul class="rc-landing__list">\n${items.join('\n')}\n    </ul>`;
}

export function linksHtml(heading, links) {
  if (!links?.length) return '';
  const items = links
    .map((l) => `        <li><a href="${escapeHtml(`${SITE}/cottages/${l.slug}`)}">${escapeHtml(l.name)}</a></li>`)
    .join('\n');
  return [
    '    <nav class="rc-landing__nav">',
    `      <h2>${escapeHtml(heading)}</h2>`,
    '      <ul>',
    items,
    '      </ul>',
    '    </nav>',
  ].join('\n');
}

/** BreadcrumbList + ItemList, both describing what the page actually shows. */
export function landingJsonLd(group, ctx) {
  const url = `${SITE}/cottages/${group.slug}`;
  const crumbs = [
    { name: 'RentCottage.Ge', item: SITE },
    { name: 'კოტეჯები', item: `${SITE}/search` },
  ];
  if (ctx.regionLink) {
    crumbs.push({ name: ctx.regionLink.name, item: `${SITE}/cottages/${ctx.regionLink.slug}` });
  }
  crumbs.push({ name: ctx.displayName, item: url });

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem', position: i + 1, name: c.name, item: c.item,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: landingH1(group, ctx),
      numberOfItems: group.listings.length,
      itemListElement: group.listings.map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/property/${l.id}`,
        name: l.title,
      })),
    },
  ];
}

/** The whole crawler-visible body for one landing page. */
export function landingBodyHtml(group, ctx) {
  const copy = buildCopy(group, ctx);
  return [
    OWNER_REVIEW_MARK,
    '  <main class="rc-landing">',
    `    <h1>${escapeHtml(landingH1(group, ctx))}</h1>`,
    '    <div class="rc-landing__copy" data-owner-review="pending">',
    ...copy.map((para) => `      <p>${escapeHtml(para)}</p>`),
    '    </div>',
    listingsHtml(group),
    ctx.regionLink ? linksHtml('რეგიონი', [ctx.regionLink]) : '',
    linksHtml(group.kind === 'region' ? 'ადგილები ამ რეგიონში' : 'ახლომდებარე ადგილები', ctx.cityLinks),
    linksHtml(group.kind === 'city' ? 'იმავე რეგიონის სხვა ადგილები' : 'სხვა რეგიონები', ctx.siblingLinks),
    linksHtml('კატეგორიები', ctx.categoryLinks),
    '  </main>',
  ].filter(Boolean).join('\n');
}
