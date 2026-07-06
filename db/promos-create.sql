-- ───────────────────────────────────────────────────────────────────────────
-- Offers & Promos — location-targeted percentage discounts.
--
-- promos: admin-managed via the service-role admin-host-actions function
--   (fetch-promos / save-promo / delete-promo). Public READ only; no anon
--   write policies — mirrors the experiences lockdown (see
--   experiences-and-experience-bookings-rls.sql).
-- bookings: three nullable audit columns so a discounted booking records
--   which promo applied and what the pre-discount total was. Old rows and
--   non-promo bookings keep NULLs; emails already show the discounted
--   total_price, so nothing else changes.
--
-- Dates are inclusive calendar dates (site convention): a promo is live when
-- active = true AND (starts_at IS NULL OR starts_at <= today)
--                AND (ends_at   IS NULL OR ends_at   >= today).
--
-- NOTE: the feature ships dormant — nothing shows on the site until the
-- first active promo is created AND the ENABLE_PROMOS flag is turned on
-- (src/lib/featureFlags.ts).
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- 1. Table ───────────────────────────────────────────────────────────────────
create table if not exists public.promos (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  discount_percent numeric(5,2) not null
                   check (discount_percent > 0 and discount_percent <= 90),
  location         text not null,          -- e.g. "Batumi" — matched bilingually
  active           boolean not null default true,
  starts_at        date,                   -- null = starts immediately
  ends_at          date,                   -- null = no end date
  created_at       timestamptz not null default now()
);

create index if not exists promos_active_idx
  on public.promos (active, starts_at, ends_at);

-- 2. Row Level Security ──────────────────────────────────────────────────────
-- Public read; NO write policies — writes only via service role
-- (admin-host-actions), same lockdown as experiences.
alter table public.promos enable row level security;

drop policy if exists "promos_public_read" on public.promos;
create policy "promos_public_read" on public.promos
for select to anon, authenticated using (true);

-- 3. bookings audit columns ──────────────────────────────────────────────────
alter table public.bookings add column if not exists promo_id uuid references public.promos(id) on delete set null;
alter table public.bookings add column if not exists promo_discount_percent numeric(5,2);
alter table public.bookings add column if not exists pre_discount_total numeric(10,2);
