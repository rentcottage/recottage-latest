-- ───────────────────────────────────────────────────────────────────────────
-- Property Activities — the extras a host offers alongside the stay:
-- masterclasses, wine degustation, guided tours, horse riding, and so on.
-- Shown on the cottage detail page, where a description alone isn't enough.
--
-- NOT the same thing as public.experiences (db/experiences.sql): that table is
-- an ADMIN-curated, platform-wide catalogue with no property and no owner, and
-- its RLS accepts anonymous writes. Hosts must never write there — one host
-- could edit the homepage catalogue. These rows are owned by one host and
-- scoped to one property, with the same RLS shape as host_offers.
--
-- INFORMATIONAL, NOT BOOKABLE (phase 1). Prices here are displayed so a guest
-- knows what's on offer and can arrange it with the host; they deliberately do
-- NOT feed the booking total. bog-payment recomputes every booking from
-- nightly rate x nights and rejects anything else with PRICE_MISMATCH, so an
-- activity that added cost would break checkout. Making these bookable means
-- extending that server-side verification first.
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- 1. Table ───────────────────────────────────────────────────────────────────
create table if not exists public.property_activities (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.property_applications(id) on delete cascade,
  host_email    text not null,          -- denormalised for RLS, as in host_offers
  title         text not null,
  description   text,
  -- Drives the icon and the grouping label. 'other' is always valid, so an
  -- unusual activity is never blocked by the vocabulary.
  category      text not null default 'other'
                check (category in ('cooking','wine','tour','horse','hiking','spa','transfer','other')),
  -- null price = "ask the host". Free is price 0 with price_unit 'free'.
  price         numeric(10,2) check (price >= 0),
  price_unit    text not null default 'per_person'
                check (price_unit in ('per_person','per_group','free','on_request')),
  duration_minutes integer check (duration_minutes > 0 and duration_minutes <= 10080),
  image_url     text,
  active        boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists property_activities_property_idx
  on public.property_activities (property_id, active, display_order);
create index if not exists property_activities_host_idx
  on public.property_activities (host_email);

-- 2. Row Level Security ──────────────────────────────────────────────────────
-- Public read (the cottage detail page renders these anonymously).
-- Writes restricted to the owning host via their JWT email.
alter table public.property_activities enable row level security;

drop policy if exists "property_activities_public_read" on public.property_activities;
create policy "property_activities_public_read" on public.property_activities
for select to anon, authenticated using (true);

drop policy if exists "property_activities_host_insert" on public.property_activities;
create policy "property_activities_host_insert" on public.property_activities
for insert to authenticated
with check (host_email = (auth.jwt() ->> 'email') and property_id in (select id from public.property_applications where host_email = (auth.jwt() ->> 'email')));

drop policy if exists "property_activities_host_update" on public.property_activities;
create policy "property_activities_host_update" on public.property_activities
for update to authenticated
using (host_email = (auth.jwt() ->> 'email'))
with check (host_email = (auth.jwt() ->> 'email') and property_id in (select id from public.property_applications where host_email = (auth.jwt() ->> 'email')));

drop policy if exists "property_activities_host_delete" on public.property_activities;
create policy "property_activities_host_delete" on public.property_activities
for delete to authenticated
using (host_email = (auth.jwt() ->> 'email'));
