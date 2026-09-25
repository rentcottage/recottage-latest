# RentCottage — deployed state

Snapshot taken 2026-09-21 (end of day). `main` = `origin/main` = **3c71203**.
Updated 2026-09-26: §2 item 17 (the nightly rebuild is live) and the §1a reels
render fix.

**This file is now COMMITTED** (2026-09-21, by owner request). It was
previously untracked and deliberately uncommitted; that convention has been
dropped for this file only. The other twelve files in `docs/` are still
untracked and still live only on `wip/owner-frontend`. Note the consequence:
that branch carries its own `docs/STATE.md`, so this file is now one of the
files that will conflict when the branch is resumed — see §2a.

Re-check anything here against production before relying on it.

> **Provenance of this update.** Everything in sections 1, 1a and 1d was read
> back from production on 2026-09-21 (`functions list`, `functions download` +
> hash comparison, `cron.job`, `storage.buckets`, `pg_policy`,
> `storage.objects`, and one read-only SQL query for the §1d counts) or from
> `git`. Section 1e was written the same day from the commits it names, from
> the live site over `curl`, and from a real test merge. The **n8n workflow schedules
> and the two third-party tokens in §1c are owner-reported** — n8n Cloud and the
> Meta and GitHub token settings are not readable from this machine, so they are
> recorded as stated, not verified.

---

## 1. What is deployed today

### Edge functions (Supabase project `fkjkyzpunatzkovqxyzp`)

The version that is actually **serving** each function:

Counters and `updated_at` as read on 2026-09-21:

| Function | Counter | verify_jwt | Last deployed (UTC) | Notes |
|---|---|---|---|---|
| `n8n-data` | v8 | false | **2026-09-21 05:26** | **the only function deployed on 2026-09-21** — `available-weekend`, see §1d |
| `admin-user-management` | v29 | false | 2026-09-17 20:37 | admin login (`verify-admin`) + user admin |
| `admin-host-actions` | v72 | false | 2026-09-17 18:12 | admin writes, signed experience-photo uploads |
| `admin-read` | v6 | false | 2026-09-17 18:12 | read-only admin data, shared gate + throttle |
| `bog-payment` | v98 | false | 2026-09-17 11:35 | payment create-order / callback |
| `booking-handler` | v104 | false | 2026-09-17 11:34 | host/admin booking actions, no-overlap safety |
| `ical-sync` | v30 | true | 2026-09-17 05:27 | pulls OTA calendars, non-iCal guard |
| `ical-export` | v5 | false | 2026-09-17 05:27 | token-protected outbound feed |
| `booking-reminders` | v32 | false | 2026-09-16 19:37 | |
| `resend-approval-email` | v27 | false | 2026-09-16 15:36 | |
| `phone-otp` | v13 | false | 2026-08-26 11:30 | |
| `corporate-application-handler` | v19 | false | 2026-08-18 20:52 | |
| `host-broadcast` | v27 | **true** | 2026-06-30 08:45 | |
| `property-application-handler` | v63 | false | 2026-06-30 08:25 | |
| `experience-booking-notify` | v17 | false | 2026-05-04 20:01 | |

The counter drift noted below is visible again here: several functions carry a
higher counter than the 2026-09-18 snapshot despite `updated_at` being
unchanged since 2026-09-17. Only `n8n-data` was actually redeployed.

The 2026-09-21 `n8n-data` deploy was verified the honest way: `functions
download` into a scratch directory, then `sha256` of each downloaded file
against the same path in commit `d2f0938`. All three files
(`n8n-data/index.ts`, `n8n-data/handler.ts`, `_shared/adminAuth.ts` — the whole
of what the deploy uploads) matched byte for byte. The counter went v7 → v8,
but that is not what was trusted.

**Version-counter artifact (important when reading `supabase functions list`).**
The `version` field reported by the CLI is a *counter* that drifts upward on its
own, without any deploy: on 2026-09-17 it advanced by +1 on every function
during an unrelated deploy, and by 2026-09-18 it had drifted further (e.g.
`bog-payment` counter v98) while nothing was deployed. The revision actually
serving is the version segment inside `entrypoint_path`, and `updated_at` is the
honest "last deployed" signal. **Verify a deploy by downloading the source and
comparing hashes, never by the counter.**

### Migrations applied to production

All thirteen, in order:

```
20260917130000_ical_export_tokens.sql
20260917160000_booking_no_overlap.sql
20260918100000_public_unavailable_ranges.sql
20260918100100_block_tables_privacy.sql
20260918110000_status_logs_privacy.sql
20260918120000_public_properties_view.sql
20260918120100_property_applications_privacy.sql
20260918130000_storage_experience_photos.sql
20260918130100_public_offers_activities_reviews_views.sql
20260918130150_offers_activities_reviews_privacy.sql
20260918130200_admin_auth_failures.sql
20260918140000_marketing_weekly_stats.sql      ← view, verified present
20260920120000_storage_social_videos.sql       ← NEW 2026-09-20
```

Verified live on 2026-09-21: view `marketing_weekly_stats` present, view
`public_properties` present, bucket `social-videos` present, **exactly one**
policy matching `social-videos`.

Net effect: `anon` can read **only** the purpose-built views
(`public_properties`, `public_host_offers`, `public_property_activities`,
`public_reviews`) plus `get_unavailable_ranges()`; every base table carrying
contact data is owner-scoped or service-role only. `marketing_weekly_stats` is
service-role only. Admin endpoints share a hashed-IP failure throttle
(`admin_auth_failures`, 10 per 15 min → 429); `n8n-data` uses the same table
under a separate key namespace so the two can never lock each other out.

### Cron (unchanged, fingerprint stable)

All three still `active`. Nothing in the reels work touched Cron.

| Job | Schedule | `md5(command)` |
|---|---|---|
| `booking-expire-pending-approvals` | `*/15 * * * *` | `377941120a77b92a349b20d95f292c4d` |
| `booking-send-contact-reveal-emails` | `7 * * * *` | `76174f8db0af0aab37747ce5864c1f59` |
| `booking-send-host-reminders` | `5,20,35,50 * * * *` | `c21f44713cf7e7a53909778153076d84` |

Those md5s are the fingerprint to re-check against: the commands embed a
function URL and the `CRON_SECRET`, so the hash is recorded rather than the
body. A changed hash means someone edited a job.

---

## 1a. Automated Instagram Reels (new, 2026-09-20)

### The arrangement

n8n asks `n8n-data` for a listing and for a **single-use signed upload URL**,
then dispatches a GitHub Actions job that renders the video and PUTs it to that
URL. n8n publishes the resulting public URL and later calls cleanup.

**GitHub holds no Supabase credential.** Its only write capability is one signed
URL, for one object path the edge function chose, valid two hours, refused if an
object already exists (no upsert).

### `n8n-data` v8 — five actions

| Action | Added | What it does |
|---|---|---|
| `weekly-report` | earlier | aggregates from `marketing_weekly_stats` |
| `listings-for-social` | earlier | rotating listing picks from `public_properties` |
| `reel-upload-url` | **2026-09-20** | `{listing_id}` → `{upload_url, public_url, path, expires_in, generated_at}` |
| `reel-cleanup` | **2026-09-20** | deletes reels older than 3 days → `{deleted, scanned, generated_at}` |
| `available-weekend` | **2026-09-21** | cottages still free for the coming weekend — see §1d |

`listings-for-social` also gained, across this cycle:

- **`min_photos`** (2026-09-20) — filters on the **de-duplicated** union of
  `cover_photo_url` and `photo_urls`; the cover is usually also the first photo.
- **`max_guests`, `bedrooms`, `bathrooms`, `short_description`** (commit
  `6742c2c`, 2026-09-19). `short_description` is the host's description with
  e-mails, phones, URLs, domains and @handles stripped server-side, along with
  the sentence each sat in.

Path rule: `reels/<UTC date>-<16 hex>.mp4`, built from the injected clock and
CSPRNG and asserted against `REEL_NAME_RE`. **Nothing in the request body can
influence it** — that is the property the tests pin hardest.

### Bucket `social-videos`

```
public = true      file_size_limit = 52428800 (50 MB)     allowed_mime_types = {video/mp4}
policies: social_videos_public_read  (SELECT only)  ← the only one
```

No INSERT / UPDATE / DELETE policy exists, by design: a signed upload is
authorised by its own token, not by RLS, so the **absence** of a write policy is
the control. Same pattern as `experience-photos`.

**As of 2026-09-21 the bucket holds 6 objects**, all `video/mp4`, ~7.7 MB each,
uploaded 2026-09-20 19:47–20:23 UTC, all matching the `reels/<date>-<hex>.mp4`
naming. The pipeline has run end-to-end in production. The oldest becomes
eligible for `reel-cleanup` on 2026-09-23.

### Renderer: `rentcottage/rentcottage-reels` (NEW, **private**)

| | |
|---|---|
| Trigger | `workflow_dispatch` **only** — no push, no schedule, no PR |
| Runner | `ubuntu-latest`; 10-minute job timeout, 5-minute render-step timeout; `permissions: contents: read, issues: write` |
| Output | 1080x1920, H.264 high@4.0 + AAC 128k, 30 fps, **15.6 s** |
| Brand | end card is flat **`#FB2C36`** (Tailwind v4 `red-500`) with white — 3.88:1, clears WCAG AA large |
| Colours | one `BRAND` block at the top of `render.py`; `primary_deep` `#E7000B`, `ink` `#222222` |
| Fonts | Noto Sans + Noto Sans Georgian, bundled, **OFL 1.1** with licence text |
| Music | 3 tracks in `music/`, chosen at random; **owner confirms their licences** |
| Tests | `render_test.py`, 18 tests |

Two things worth remembering:

- Photo URLs are allow-listed with `urlsplit` against host
  `fkjkyzpunatzkovqxyzp.supabase.co` and path prefix
  `/storage/v1/object/public/` **before any fetch**, and re-checked after
  redirects. A listing row is host-supplied data, not permission to fetch.
- `drawtext` cannot font-fall-back, and Noto Sans has **no** Georgian glyphs
  while Noto Sans Georgian has **no** Latin or Cyrillic. `textlayout.py` parses
  the fonts' `cmap`/`hmtx` and splits each line into single-script runs, or
  mixed-script titles render half as tofu.
- **macOS gotcha:** Homebrew's plain `ffmpeg` formula is built without
  libfreetype and has no `drawtext`. Use `ffmpeg-full` locally; Ubuntu's
  packaged build is fine. The workflow hard-fails if `drawtext` is missing.

### Render fix — `1a440e4`, merged to `main` 2026-09-26

**What broke.** The Friday 2026-09-25 reel never rendered. Three dispatches
(runs `36144577480`, `36152418082`, `36158576435`) were each **cancelled** at
the 10-minute job timeout with ffmpeg still running, so nothing was uploaded
and the reel's public URL 404s (`NoSuchKey`). Nothing reported it; it surfaced
days later as a Meta error.

**Why.** The listing had two iPhone 16 Pro Max JPEGs (5712x4284, 3024x4032).
Those carry an **HDR gain map as a second embedded JPEG (MPF)**, and ffmpeg 7+
decodes it as an **extra frame**. Under `-loop 1` the input alternated
5712x4284 / 2856x2142, the filter graph was rebuilt on every frame and
`zoompan` restarted each time, so the render never converged. Downloads, fonts
and music were not involved. Tuesday's photos were all ≤1.7 MP with no gain
map.

**Fix.** `prepare_photo()` decodes only the primary image (`-frames:v 1`) and
cover-crops it to 1080x1920 once, before the filter graph sees it. The same
Friday inputs went from >10 minutes (never finishing) to **14.8 s** end to end
locally.

**The workflow now fails loudly instead of silently uploading nothing:**

- ffmpeg is capped at 60 s per photo and 240 s per render, and the render step
  has its own 5-minute timeout. A step timeout **fails** the job, where the old
  job timeout only **cancelled** it with no signal.
- The upload URL's shape is validated before any work, and a stray `"` or
  whitespace is named in the error. The URL itself is never printed.
- Any non-2xx upload fails the job. The public URL is then requested with
  `HEAD` and must serve the uploaded byte count.
- Every log line carries elapsed seconds and is flushed as it happens
  (`python3 -u`).
- A failed or cancelled render **opens a GitHub issue** in the repo, using the
  job's own token.

**Still open, on the n8n side (owner):** the trailing `"` in the video URL sent
to Meta is introduced **inside n8n**. `n8n-data` cannot emit it (`REEL_NAME_RE`),
and the renderer never sees `public_url`. Also, n8n publishes `public_url`
after a fixed wait whether or not the render succeeded. It should check that
the run concluded `success` first.

---

## 1b. Live n8n workflows — *owner-reported, not verified from this machine*

| Workflow | Schedule | Destination |
|---|---|---|
| Daily photo post (seasonal) | 11:00 daily | Instagram + Facebook |
| Daily photo post | 20:00 daily | Instagram + Facebook |
| Reels | **Tue + Fri 18:00** | Instagram + Facebook |

Timezone not recorded — confirm whether these are Asia/Tbilisi or the n8n
instance's UTC before reasoning about overlap with Cron.

> No posting to Instagram or Facebook was performed or tested from this machine.

---

## 1c. Secrets and where they live

**Supabase edge-function secrets** (names only):
`ADMIN_PANEL_PASSWORD`, **`N8N_DATA_SECRET`**, `RESEND_API_KEY`, `CRON_SECRET`,
`HCAPTCHA_SECRET_KEY`, `INTERNAL_API_KEY`, `OTP_PEPPER`, `CITYNET_SMS_*`,
`TWILIO_ACCOUNT_SID`, the BOG test keys, plus the platform-managed `SUPABASE_*`
entries (those refresh on every function deploy — that is normal).

| Secret | Held by | Used for | Renewal |
|---|---|---|---|
| `N8N_DATA_SECRET` | **Supabase** (function env) + n8n credential | the `x-n8n-secret` header — the only gate on `n8n-data` | no expiry; rotate deliberately |
| Meta system-user Page token | **n8n** credential | publishing to Instagram + Facebook | *owner-reported*; system-user tokens are long-lived but check Meta's expiry |
| GitHub fine-grained token `n8n-reels-dispatch` | **n8n** credential | `POST …/workflows/render.yml/dispatches` | **90 days from 2026-09-20 → renew by mid-December 2026** |

The GitHub token is scoped to `rentcottage/rentcottage-reels` only, with
**Actions: Read and write** and nothing else (`Metadata: Read-only` is added
automatically and is mandatory).

**Note on the signed upload URL:** it is a credential — the upload token is in
its query string. The workflow `::add-mask::`s it so it is redacted from logs,
but **GitHub still shows workflow-run inputs in the run summary UI**, and
masking does not cover that panel. Acceptable because the URL is single-use,
path-scoped, two-hour, and the repo is private — but that is *why* the repo is
private.

---

## 1d. `available-weekend` (new, 2026-09-21)

Commit `d2f0938`, on `main`, deployed and hash-verified. Nothing else changed:
no migration, no Cron job, no secret, no other function, no frontend code.

### What it answers

`{action: "available-weekend", count?: 1-10 (default 5), min_photos?, region?,
category?}` →

```
{ check_in, check_out, nights,           ← the weekend, ISO dates
  candidates, checked, available, returned,
  rotation_seed, generated_at, listings[] }
```

`listings[]` carries **exactly** the fields `listings-for-social` publishes —
the two actions share one `publicListing()` and a test compares their keys —
so nothing new leaves the building.

### The weekend rule, as implemented

**`check_in` is the first Saturday STRICTLY AFTER today in Asia/Tbilisi;
`check_out` is that Saturday + 2 days.**

| Today (Tbilisi) | check_in |
|---|---|
| Mon–Fri | the Saturday of the week that is coming |
| **Saturday** | the **next** Saturday (+7) — not today |
| **Sunday** | the **next** Saturday (+6) |

The brief allowed keeping a weekend already running "only if Saturday has not
started yet"; on a Saturday it has, and on a Sunday it is over, so that branch
can never be taken and the rule collapses to "the next Saturday". There is no
cutoff hour and no partial (one-night) weekend. The day boundary is read via
`Intl` with `timeZone: 'Asia/Tbilisi'`, not an assumed UTC+4, and a test pins
the rollover at 20:00 UTC.

### Where "free" is decided — not in the function

Each candidate is probed with **`get_unavailable_ranges(p_property_id)`**, the
same SECURITY DEFINER function the public property page calls. It is what
knows that confirmed / pending / pending_host_approval bookings occupy dates,
that a `pending_payment` hold occupies them for 20 minutes **and never after**,
that host and imported OTA blocks count, and that a non-approved property has
no ranges at all. `n8n-data` still reads **no base table**, and the SOURCES
test now pins the RPC too: one function name, one argument, and that argument
a listing id.

What stayed in TypeScript is the **comparison**, with the migration's two
conventions (`blocked` end_date inclusive, `booked` end_date exclusive). It is
duplicated rather than imported because `src/` is outside the bundle the
Supabase deploy uploads — the deploy log lists exactly three files, and
`src/lib/availability.ts` is not among them, so an import would have broken at
deploy time. **The duplicate is therefore pinned by test:** `handler.test.ts`
imports `src/lib/availability.ts` and asserts both modules decide every range
shape against the weekend identically, for both kinds. If the site's rule ever
changes, that test fails rather than the feed silently diverging.

### Cost and failure behaviour

- Probes run **8 at a time**, capped at **300 per request**; the response
  reports `checked` vs `candidates`, so hitting the cap is visible.
- A probe that errors **or throws** drops its listing instead of returning it.
  This feed advertises bookable dates, so the safe failure is one cottage
  fewer, never a weekend that is already taken. A total database outage
  therefore shows as `available: 0` with `candidates` non-zero, not as a 500 —
  worth an eye on the n8n side if a post ever comes back empty.

### Tests

81 in the suite (351 across the repo), all passing; app typecheck and `npm run
build` clean. The PII scan covers the new action and its error paths, with the
availability RPC deliberately seeded with rows carrying a booking id, an
e-mail and a phone.

**Eleven mutants were injected and all eleven were caught**: availability check
skipped; the weekend off by a day in each direction; blocks ignored; bookings
and holds ignored; the `blocked` end-date convention flipped to exclusive; a
contact column added to `LISTING_COLUMNS`; a contact field added to the
response; the `count` upper bound removed; the probe cap removed; a failed
probe counted as free.

### Production counts, read 2026-09-21

For the weekend this rule selects — **check_in 2026-09-26, check_out
2026-09-28**:

| | |
|---|---|
| Approved listings | **101** |
| **Free for that weekend** | **100** |
| Of those, with ≥ 3 distinct photos | **100** |
| Of those, with ≥ 3 photos whose URL ends `.jpg`/`.jpeg` | **89** |

Two things to read carefully. First, only **one** listing in the whole
catalogue is taken that weekend — the availability filter is barely narrowing
anything today, so a near-empty `available` in a future run means a problem,
not a busy weekend. Second, `min_photos` counts **photos, not JPEGs**:
`photoCount()` de-duplicates the union of `cover_photo_url` and `photo_urls`
and never looks at the format. The 89 above is a separate, format-aware count
run only for this report; the remaining 11 free listings reach 3 photos with
`.webp` or other URLs. If the brief's "3 JPEG photos" was meant literally as a
filter, it is **not** implemented and would need a new parameter.

### Probes after deploy

`POST` with no `x-n8n-secret` → `401 {"error":"Unauthorized"}`; with a wrong
one → the identical `401`. No authenticated probe was made: this machine does
not hold `N8N_DATA_SECRET` and did not ask for it, so the action has **not**
been exercised end-to-end against production. The counts above come from the
read-only SQL that reproduces its logic, not from the live endpoint.

### Not done

No n8n workflow was created or changed. Nothing calls `available-weekend` yet —
it is deployed and waiting.

---

## 1e. SEO work and data fixes — 2026-09-21

Ten commits, `d2f0938` → `3c71203`, all on `main` and all deployed. No URL
changed, no redirect was added, no Supabase function, Cron job, Vault entry or
migration was touched at any point. The sitemap went 113 → 140 once (phase 2)
and has been 140 ever since.

### The commits

| Commit | What |
|---|---|
| `bf2c459` | **Phase 1.** Prerender the 101 listing pages + `/search` |
| `b8d232d` | **Phase 2.** 27 landing pages at `/cottages/<slug>` |
| `f8fdc08` | Georgian category labels on the six category pages |
| `bd99e0b` | **Phase 2b.** Unearned ratings removed; listing JSON-LD served |
| `70f2bab` | **Phase 2c.** Host map pin picker; "Highest Rated" sort removed |
| `725d35b` | **Phase 2d.** "Most Reviews" sort removed |
| `8d97dde` | ჯვარისა added to the village catalogue |
| `274d4a5` | Empty commit — **did not trigger a build**, see §2 item 17 |
| `38d55b3` | Listing title suffix shortened to `" \| RentCottage.ge"` |
| `3c71203` | Brand spelling normalised to `RentCottage.ge` |

### Phase 2b — `bd99e0b`

Three places rendered a star and a score from a `rating: 5.0` literal sitting
next to `reviews: 0`: the property title row and two spots in `BookingWidget`.
All 101 listings claimed five stars and admitted zero reviews in one breath.
All three are now gated on `reviews > 0` and say "No reviews yet" otherwise,
reusing the existing `property.reviews.noReviewsYet` string so no i18n file was
touched. `PropertyCard` (search + landing) already had the guard.

Listing JSON-LD moved into the **served HTML**. `src/lib/listingSchema.ts`
builds it; the property page calls it at runtime and `vite.config.ts` calls the
same function at build time, leaving `listing-schemas.json` for the prerender
to inject. One builder, so the indexed document and the live DOM cannot
disagree. `VacationRental` with `containsPlace → Accommodation` carrying
`numberOfRooms` and `occupancy` (they are invalid on the business node), and an
`Offer` with `priceCurrency: GEL` and a per-night `UnitPriceSpecification`.
`aggregateRating` only when `reviewCount > 0`, so today never.

Validated structurally across all 101 pages: **0 errors, 194 warnings**, all of
them data coverage — **100 of 101 listings have no latitude/longitude** and 94
have no street address. Those fields are omitted, never invented.

### Phase 2c — `70f2bab`

Hosts can place a **map pin**. The edit form already wrote `latitude` /
`longitude` through two text boxes, which is why exactly one listing had
coordinates — nobody types decimal degrees. There is now a map above them:
click to drop, drag to adjust; the boxes stay editable and remain what is
saved; saving with no pin still writes null.

**Leaflet 1.9.4 (BSD-2-Clause) + OpenStreetMap tiles**, chosen because it is
the only mature option needing **no API key** — nothing secret in the bundle
and no billing account behind the map. Google Maps and Mapbox both require a
paid bundled key. It lands in the host-dashboard chunk (351 KB), never in the
main bundle, so guests do not download it. Initial view: the saved pin, else
the town via one best-effort keyless Nominatim lookup bounded to Georgia, else
Georgia. Coordinates format to seven decimals because the columns are
`numeric(10,7)`; out-of-range values are refused, not clamped.

**RLS was verified, not extended.** `property_applications` has RLS on, **no
table-level grant** to `anon` or `authenticated`, and a **column-level UPDATE
grant** to `authenticated` covering `latitude` and `longitude` but not `status`
or `host_email`. Policy `property_applications_owner_update` gates `USING` and
`WITH CHECK` on `is_property_owner(id)`, which matches the row's `host_email`
to the caller's confirmed `auth.users` email. A host can write coordinates on
their own listing and nothing else. No policy, no migration.

### Phases 2c / 2d — the two no-op sorts

Both "Highest Rated" (`rating`) and "Most Reviews" (`reviews`) compared
constants: every listing carries the same hardcoded `5.0` and `0`. Both options
are gone from the dropdown and both `case` branches from the sort. `SORT_KEYS`
in `src/pages/search/page.tsx` now whitelists `alphabetical`, `price-low`,
`price-high`; a bookmarked `?sort=rating` or `?sort=reviews` falls back to the
default instead of leaving the `<select>` with no matching option. **The i18n
strings `search.sortRating` and `search.sortReviews` were left in all three
languages on purpose**, so restoring either needs no translation work. The
restore note lives above `SORT_KEYS`.

### ჯვარისა (Jvarisa) — `8d97dde`

Two approved listings named the village and reached no town page, because it
was absent from the 399-entry catalogue. Added to `src/data/regions.json` in
the shape of its Racha neighbours: `cityToRegion.jvarisa → racha-lechkhumi`,
`enToKa.jvarisa → ჯვარისა`. Counts moved by exactly one (399 → 400, 426 → 427;
`regionAliases` unchanged at 16).

The phrase shapes were never the problem — verified by substituting a known
long village into both strings, where all five shapes already resolved,
including the Mtavruli capital `Რ` and the missing space after the dot. The
4-character floor in the whole-word scan is why a 3-character name like `ონი`
does not resolve inside a phrase.

**No page and no sitemap change:** Jvarisa has two listings, under the
three-listing threshold. The entry becomes visible if a third appears.

### Data fixes applied directly to production

Every statement was guarded on the exact previous value and each touched
**exactly one row**. For the two location rewrites, full 37-column row
snapshots were diffed before and after: **one column changed on each.**

| Row | Column | From → To |
|---|---|---|
| `f3cdb09c` | title | Maps URL → *(interim)* → `კოტეჯი აუზით სადმელში` |
| `07da0caf` | title | Maps URL → *(interim)* → `მყუდრო კოტეჯი ჰამაკებით` |
| `830f0af2` | location | `რაჭა ამბროლაურის რაიონი სოფ . ჯვარისა` → `ჯვარისა, რაჭა-ლეჩხუმი` |
| `0348ccf5` | location | `Რაჭა.სოფ ჯვარისა` → `ჯვარისა, რაჭა-ლეჩხუმი` |

**The two Ambrolauri rows are NOT duplicates.** Same host, same village,
created nine minutes apart, but they
share **zero photos** — 0 identical URLs and 0 identical filenames across 9 and
10 uploads — and differ on bedrooms (3 vs 1), capacity (8 vs 4), price (350 vs
250) and description. Two separate cottages on one property. Neither has ever
had a booking. Nothing was merged or hidden.

Still outstanding as **data**, deliberately untouched: `c1dd9b57`
(`location = "რაჭა"`) and `0fbf5109` (`location = "ხევსურეთი"`). Both name a
*region* where a village belongs; no catalogue entry can fix that. Both still
reach their region page.

### Title length — `38d55b3`

The tail was `" Cottage Rental | RentCottage.Ge"`, 32 characters, 40% of the
average title tag, on a median of 78 where Google shows roughly 60–70. Now
`" | RentCottage.ge"`, 17 characters.

| Rendered length | Before | After |
|---|---|---|
| under 60 | 6 | **46** |
| 60–70 | 26 | **30** |
| **over 70** | **69** | **25** |

At or under 70: **32 → 76 of 101.** Median 78 → 63. The 25 still over are long
because the host's own title is long; the worst is a 137-character marketing
paragraph pasted into the title field, which no template change fixes.

Measure rendered text, not the escaped HTML — four titles contain quotes that
become `&quot;`, which inflates a byte count by ~2 listings' worth of banding.

Landing pages, `/search` and the static routes were **not** changed: they never
carried "Cottage Rental", so the change saves them nothing, and none is over 70
(landing max 56, static max 68).

### Brand spelling — `3c71203`

One display spelling now: **`RentCottage.ge`**. 99 occurrences across 35 files —
the 8 static titles and their descriptions, the Organization / LocalBusiness /
BreadcrumbList `name` fields, `og:site_name` at build and runtime, landing
titles and Georgian copy, all three i18n sets, every page component,
`index.html` and the placeholder SVG's aria-label.

**The domain is untouched** — every URL still reads `rentcottage.ge`.

`tests/frontend/brandSpelling.test.ts` is the ratchet: it walks `src`,
`scripts`, `public` and `index.html` and fails if the mixed-case form returns.
It also asserts the sweep reaches the files that carry the name and that the
brand is still present, so it cannot pass by scanning nothing. Verified to
bite. Excluded on purpose: `supabase/functions/**` (see §2 item 18), this
file's own historical notes, and the two lines in `prerender.test.ts` that must
name the old spelling to assert its absence.

### Test and page counts at end of day

410 tests across the repo, typecheck and build clean. 9 static + 101 listing +
27 landing prerendered pages; sitemap **140 URLs**.

---

## 2. Open follow-ups

1. **Cancelled pay-now test** — the cancelled pay-now booking attempt was never
   re-tested after the Phase 2 no-overlap work. Marked pending at the time of
   the block-tables deploy.
2. **`refund_pending` → `refunded` reconciliation** — refunds are marked pending
   and never reconciled to a final state; nothing closes the loop today.
3. **`privacy_test.py` date-dependent fixture bug** — the `single-day block`
   spot check fails whenever "today" is 11–12 days before month end, because the
   seeded month-rollover block collides with the dates the spot check assumes
   are free. Pre-existing, not a product bug; the 120-day RPC-vs-server
   comparison in the same test still passes.
4. **Admin password in `sessionStorage`** — the admin session *is* the password
   (`rc_admin_pw`); any XSS on the admin origin yields the password itself, not
   just a session. A short-lived token issued by `verify-admin` would fix it,
   but touches every admin panel.
5. **Booking.com calendars #2 and #4 need new links** — those two iCal URLs are
   dead; the host must re-export them from Booking.com.
6. **`property-photos` path scoping** — anon may still INSERT anywhere in the
   bucket (no overwrite, no delete). Per-application path prefixes would scope
   it, but that changes the become-host submission flow.
7. **`experience-photos` bucket limits** — the bucket has no
   `allowed_mime_types` and no size limit; validation lives only in the
   `create-experience-photo-upload-url` action.
8. **The GitHub repo is public** (`rentcottage/recottage-latest`).
   `rentcottage/rentcottage-reels` is **private** and must stay that way — see
   the upload-URL note in §1c.
9. **Consent + unsubscribe missing** — there is no consent/opt-in column
   anywhere in the database and no unsubscribe mechanism in the code, while the
   published privacy policy promises both. Required before **any** marketing
   email goes out (EU guests + Georgian data-protection law). n8n phase 1 is
   listing data only and does not touch this.
10. **Renew the GitHub token `n8n-reels-dispatch` by mid-December 2026** (90
    days from 2026-09-20). When it lapses the Reels workflow stops dispatching
    and n8n will surface it as a 401 on the dispatch node, not as a render
    failure.
11. **Music licences in `rentcottage-reels/music/` are unconfirmed.** Three
    tracks with Pixabay-looking filenames. `render.py` picks at random from
    whatever is in the directory, so an unusable track can simply be deleted —
    no code change. Confirm before the reels reach a wider audience.
12. **`reel-cleanup` has never actually deleted anything yet.** The first
    objects become eligible 2026-09-23. Watch the first real run: it is the one
    path in this feature that removes data.
13. **`available-weekend` has no caller.** The action is live but no n8n
    workflow uses it. Until one does, the only thing exercising it is the test
    suite.
14. **`available-weekend` has never run against production data.** Its logic
    was checked by re-deriving the counts in SQL (§1d), not by calling the
    endpoint, because this machine does not hold `N8N_DATA_SECRET`. The first
    real call is still the first real call.
15. **"3 JPEG photos" is not a filter.** `min_photos` counts de-duplicated
    photos of any format. If JPEG specifically matters for the renderer, that
    is a new parameter, not a tweak.
16. **101 listings x 1 RPC each, twice a week.** Fine now; the 300-probe cap
    and the 8-wide batching are what keep it fine. If the catalogue grows past
    a few hundred, this action wants a single set-returning SQL function
    instead — which would be a migration, and was deliberately not written.
17. ✅ **DONE — the Vercel deploy hook and nightly rebuild are LIVE**, running
    at **03:00 Asia/Tbilisi** (23:00 UTC) since **2026-09-22**. Confirmed on
    2026-09-26 in the Vercel dashboard: the four most recent production
    deployments are all "Created: **Deploy Hook**", hook **`nightly-rebuild`**,
    branch `main`, rebuilding `358ab9f`. The latest was created
    **2026-09-24 23:00:07 UTC** and was live at 23:00:31 UTC (22 s build).
    - **Why it exists.** `scripts/prerender.mjs` and the sitemap read
      `public_properties` at BUILD time, so a database edit — a host dropping
      a pin, a title fix, a new approved listing — is invisible to crawlers
      until something builds. This bit on 2026-09-21. **An empty commit does
      not work** (`274d4a5` never built; Vercel deduplicates an identical git
      tree).
    - **It works.** On 2026-09-26 the live sitemap had 144 URLs, 105 of them
      `/property/`, and `public_properties` returned exactly 105 rows with the
      same ids both ways.
    - ⚠️ **The GitHub deployments API does not record hook rebuilds.**
      `gh api repos/rentcottage/recottage-latest/deployments` still shows the
      2026-09-21 push as the newest production deployment. **The Vercel
      dashboard is the source of truth for what is deployed**: open the
      deployment and look at "Created", or read `meta.deployHookName` from
      `/api/v13/deployments/<dpl_id>` in a logged-in vercel.com tab.
    - The sitemap's static-page `<lastmod>` is the build date **in UTC**, so
      a 03:00 Tbilisi build is stamped with the previous day. That is
      expected, not a stale build.
    - The hook URL is a **secret**. Anyone holding it can trigger unlimited
      production builds, and it carries no authentication of its own. It
      belongs in a scheduler credential only, never in this repo or in a node's
      URL field. *What calls it was not verified from this machine* — the
      dashboard only shows that the hook fired, on time, every night.
    - It fires at exactly 03:00 Tbilisi, well clear of the 11:00 and 20:00
      social posts and the Tue/Fri 18:00 reels, and after `available-weekend`
      rolls its weekend at Tbilisi midnight.
    - A rebuild has **no user-visible downtime**: Vercel builds to a new
      immutable deployment and flips the production alias atomically only on
      success; a failed build never flips. Content-hashed assets mean a page
      loaded mid-flip keeps working, and `lazyPage()` in
      `src/router/config.tsx` already handles a stale chunk with a one-shot
      reload.
18. **`supabase/functions/**` still carries the old brand spelling.** 13 files,
    **44 occurrences** of `RentCottage.Ge`, excluded from `3c71203` because
    changing them means **redeploying 13 production functions** — they are
    transactional e-mail copy plus one iCalendar `PRODID` in
    `ical-export/handler.ts` (`//RentCottage.Ge//Availability//EN`) that
    Booking.com and Airbnb parse as a machine identifier, not display text.
    Decide separately whether the PRODID should change at all. Files:
    `property-application-handler` (11), `corporate-application-handler` (8),
    `admin-host-actions` (8), `resend-approval-email` (3), `host-broadcast` (3),
    `experience-booking-notify` (3), `ical-export` (2 + 1 in its test),
    `booking-reminders/templates` (2), `booking-handler/templates` (1),
    `bog-payment` (1).
19. **100 of 101 listings still have no coordinates**, and 94 have no street
    address. The JSON-LD omits `geo` and `streetAddress` rather than inventing
    them, so those pages publish a thinner entity than they could. The map pin
    picker (§1e) and the host e-mail campaign are what close this.

---

## 2a. Working copy — the owner's WIP branch

The owner's in-progress frontend work lives on the **local-only** branch
**`wip/owner-frontend`** (commit `6838f16`, 33 files: frontend, i18n, and the
whole of `docs/`).

- It has **no upstream** and **must never be pushed**.
- `main` is clean and equals `origin/main`.
- `docs/STATE.md` is **now tracked on `main`** (committed 2026-09-21 by owner
  request). **The other twelve files in `docs/` remain untracked and live only
  on `wip/owner-frontend`**; they are not in the working tree. Restore them
  with `git checkout wip/owner-frontend -- docs/ && git reset docs/` if you
  want the directory whole again — and note that `git reset docs/` would now
  also unstage this tracked file, so reset the other twelve by name.
- In this repo, stage only the specific files you changed, by explicit path.
  Never `git add -A`, `git add .`, or `commit -a` — a blanket add sweeps the
  owner's half-done work into an unrelated commit.

### Conflict status as of 2026-09-21: **7 files, 12 hunks**

| File | Hunks |
|---|---|
| `src/pages/home/page.tsx` | 4 |
| `src/pages/property/page.tsx` | 2 |
| `src/pages/property/components/BookingWidget.tsx` | 2 |
| `index.html` | 1 |
| `src/i18n/messages/en.ts` | 1 |
| `src/i18n/messages/ka.ts` | 1 |
| `src/i18n/messages/ru.ts` | 1 |

The four one-hunk files are all the same trivial shape: a one-character brand
casing change against a block that branch rewrites or deletes. Resolution rule
— take the branch's version of the line, then lowercase the `.Ge`;
`tests/frontend/brandSpelling.test.ts` fails if that is forgotten.

**`docs/STATE.md` will become an eighth conflicted file.** It was committed to
`main` on 2026-09-21 and `wip/owner-frontend` carries its own copy (+135 lines
against the old base). When resuming that branch, take this version — it is
newer and records everything through `3c71203`.

`src/i18n/messages/content.ts` is **clean** despite both sides touching it:
the changed lines are 13+ apart (this side 28/78/382/430/730/778, the branch
51/91/404/443/752/791) and never share a context window.

### ⚠️ How to measure this — the earlier numbers were wrong

Conflict counts reported before 2026-09-21 evening were produced by running
`git merge-tree` and counting `<<<<<<<` markers. **That method silently misses
modify/delete conflicts**, which produce no inline markers at all. It reported
3 files / 7 hunks when git's own merge reported **7 files**.

It was caught on `src/i18n/messages/ka.ts` line 116 — `why: 'რატომ
RentCottage.Ge?'`. This side *modifies* that line; the branch *deletes* it as
part of removing lines 116–124. A textbook modify/delete, invisible to marker
counting.

**Use a real merge in a throwaway worktree instead**, which never touches the
branch:

```sh
WT=$(mktemp -d)
git worktree add -q --detach "$WT" HEAD
git -C "$WT" merge --no-commit --no-ff wip/owner-frontend
git -C "$WT" status --porcelain | grep -E '^(UU|AA|DU|UD|AU|UA|DD)'
for f in $(git -C "$WT" status --porcelain | awk '/^UU/ {print $2}'); do
  echo "$f $(grep -c '^<<<<<<<' "$WT/$f")"
done
git -C "$WT" merge --abort
git worktree remove --force "$WT"
```

`UU` is a content conflict; `DU` / `UD` are the modify/delete cases the old
method missed.

---

## 3. Deploy conventions

- **GitHub: the `rentcottage` account only.** No account switching. Never
  force-push.
- **Supabase CLI: `/opt/homebrew/bin/supabase`** (not on `PATH`). Login is done
  by the owner through the browser flow in a regular Terminal window; `supabase
  login` cannot run inside the agent harness (non-TTY).
- **Migrations: `supabase db query --linked --project-ref fkjkyzpunatzkovqxyzp -f <file>`.**
  Every migration is written to be safe to re-run.
  **Never `db push`, never `migration repair`** — the remote history does not
  match the local `supabase/migrations` list, and those commands would try to
  reconcile it.
- **Functions: `supabase functions deploy <fn> --project-ref fkjkyzpunatzkovqxyzp --use-api`**,
  keeping each function's `verify_jwt` as declared in `supabase/config.toml`.
  Verify with `functions download` + hash comparison, never with the version
  counter.
- **Frontend**: Vercel auto-deploys on push to `main`. A backend-only commit
  still triggers a (no-op) rebuild — confirm it reports success. The
  `nightly-rebuild` deploy hook also rebuilds `main` at 03:00 Tbilisi. Check
  deploys in the **Vercel dashboard**, not the GitHub deployments API, which
  never sees hook rebuilds (§2 item 17).
- **Order that has worked**: additive migrations → functions → frontend →
  restrictive migrations (revokes/policies), with probes after each step.
- Local SQL tests run against a disposable Postgres 17 in the session scratchpad
  (socket `/private/tmp/rcpg`, port 55432), never against production. Stop it
  when done: `pg_ctl -D /tmp/rcpgdata stop`.
- **Reels renderer**: `python3 render_test.py` before pushing, and render a
  local preview with `--out` rather than dispatching the workflow. The workflow
  is dispatch-only, so a broken render otherwise surfaces mid-schedule.
- **Pushing `.github/workflows/**` needs the `workflow` OAuth scope** on the
  `gh` token. Without it the push is rejected with "refusing to allow an OAuth
  App to create or update workflow … without `workflow` scope"; fix with
  `gh auth refresh -h github.com -s workflow` in a real Terminal.
