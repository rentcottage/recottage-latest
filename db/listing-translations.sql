-- ───────────────────────────────────────────────────────────────────────────
-- Listing text in every site language.
--
-- Hosts write their title and description once, almost always in Georgian
-- (88 of the 100 approved listings). Switching the site to English or Russian
-- translated the interface around them but left the listing itself unreadable.
--
-- The text is translated ONCE and stored, rather than translated per page view:
-- the whole catalogue is ~53,000 characters, so one pass is cents, while
-- translating on every render would add latency and cost to every visit.
--
-- The original column stays the source of truth. These are derived copies and
-- may be null — the app falls back to the original whenever one is missing, so
-- applying this migration changes nothing until translations are filled in.
--
-- Apply in the Supabase SQL editor (Dashboard → SQL). Safe to re-run.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.property_applications
  add column if not exists title_en       text,
  add column if not exists title_ru       text,
  add column if not exists description_en text,
  add column if not exists description_ru text,
  -- Which language the host actually wrote in, detected once at translation
  -- time. Lets the app skip the translated copy and use the original when the
  -- viewer's language already matches what was written.
  add column if not exists source_lang    text,
  -- Fingerprint of the text that was translated. When a host edits their
  -- description this no longer matches, which is how a re-translation job knows
  -- the stored copies are stale instead of silently serving the old text.
  add column if not exists translated_hash text,
  add column if not exists translated_at   timestamptz;

comment on column public.property_applications.source_lang is
  'ka | en | ru — language the host wrote the original title/description in.';
comment on column public.property_applications.translated_hash is
  'md5(title || description) at the time translations were generated; a mismatch means they are stale.';

-- Finds listings needing a first translation or a refresh after an edit.
create index if not exists property_applications_translation_pending_idx
  on public.property_applications (status)
  where translated_hash is null;

-- Which approved listings still need translating, and how much text that is:
--
--   select count(*) as pending,
--          sum(length(coalesce(title,'') || coalesce(description,''))) as chars
--   from public.property_applications
--   where status = 'approved'
--     and (translated_hash is null
--          or translated_hash <> md5(coalesce(title,'') || coalesce(description,'')));
