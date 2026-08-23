-- ───────────────────────────────────────────────────────────────────────────
-- Host Offers — deals a host creates on their OWN property.
--
-- Two kinds, distinguished by offer_type:
--
--   'free_nights'  buy_nights = 2, free_nights = 1  →  "2+1": stay 3, pay 2.
--                  The deal REPEATS: with 2+1 a 7-night stay contains two
--                  complete 3-night cycles, so two nights are free.
--
--   'discount'     discount_percent = 10  →  10% off the stay. Paired with a
--                  date window this is the "10% off the 1st–8th" deal hosts
--                  run to fill quiet parts of a month.
--
-- Distinct from `promos` (db/promos-create.sql): promos are ADMIN-managed
-- percentage discounts targeted at a LOCATION. These are host-managed and
-- targeted at one property.
--
-- DATE WINDOW (starts_at / ends_at) GATES THE STAY, NOT THE PUBLICATION.
-- A host who sets 2026-09-01 → 2026-09-08 means "guests staying those dates
-- get the deal", so the whole stay must fall inside the window. NULL on either
-- side means unbounded on that side. Both dates are inclusive calendar dates
-- (site convention), and check-out day is not a night, so a stay qualifies when
--     check_in >= starts_at  AND  (check_out - 1 day) <= ends_at.
--
-- Offers auto-publish: no admin approval step. Only offers on an APPROVED
-- property reach the public surfaces.
--
-- Promos and host offers NEVER STACK — the guest gets whichever single
-- discount is worth more. Client (src/lib/hostOffers.ts) and server
-- (supabase/functions/_shared/hostOffers.ts) apply that identical rule, so
-- bog-payment's price verification accepts what the guest was shown.
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- 1. Table ───────────────────────────────────────────────────────────────────
create table if not exists public.host_offers (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.property_applications(id) on delete cascade,
  host_email       text not null,          -- denormalised for RLS, as in blocked_dates
  title            text,                   -- optional; UI falls back to a generated label
  offer_type       text not null default 'free_nights'
                   check (offer_type in ('free_nights', 'discount')),

  -- 'free_nights' only
  buy_nights       integer check (buy_nights  between 1 and 30),
  free_nights      integer check (free_nights between 1 and 30),

  -- 'discount' only
  discount_percent numeric(5,2) check (discount_percent > 0 and discount_percent <= 90),

  active           boolean not null default true,
  starts_at        date,                   -- null = no earliest stay date
  ends_at          date,                   -- null = no latest stay date
  created_at       timestamptz not null default now(),

  -- Each type carries exactly its own fields and nothing from the other, so a
  -- row can never be ambiguous about which deal it is. A free stay is not an
  -- offer, hence free_nights <= buy_nights.
  constraint host_offers_shape check (
    (offer_type = 'free_nights'
      and buy_nights is not null and free_nights is not null
      and free_nights <= buy_nights
      and discount_percent is null)
    or
    (offer_type = 'discount'
      and discount_percent is not null
      and buy_nights is null and free_nights is null)
  )
);

-- Existing installs (the free-nights-only version of this table) upgrade here.
alter table public.host_offers add column if not exists offer_type text not null default 'free_nights';
alter table public.host_offers add column if not exists discount_percent numeric(5,2);
alter table public.host_offers alter column buy_nights  drop not null;
alter table public.host_offers alter column free_nights drop not null;
alter table public.host_offers drop constraint if exists host_offers_free_lt_buy;

create index if not exists host_offers_property_idx on public.host_offers (property_id);
create index if not exists host_offers_active_idx   on public.host_offers (active, starts_at, ends_at);
create index if not exists host_offers_host_idx     on public.host_offers (host_email);

-- 2. Row Level Security ──────────────────────────────────────────────────────
-- Public read (the search page and property page need it anonymously).
-- Writes are restricted to the owning host, identified by their JWT email —
-- the same identity rule the rest of the host dashboard uses.
alter table public.host_offers enable row level security;

drop policy if exists "host_offers_public_read" on public.host_offers;
create policy "host_offers_public_read" on public.host_offers
for select to anon, authenticated using (true);

drop policy if exists "host_offers_host_insert" on public.host_offers;
create policy "host_offers_host_insert" on public.host_offers
for insert to authenticated
with check (
  host_email = (auth.jwt() ->> 'email')
  and property_id in (
    select id from public.property_applications where host_email = (auth.jwt() ->> 'email')
  )
);

drop policy if exists "host_offers_host_update" on public.host_offers;
create policy "host_offers_host_update" on public.host_offers
for update to authenticated
using      (host_email = (auth.jwt() ->> 'email'))
with check (
  host_email = (auth.jwt() ->> 'email')
  and property_id in (
    select id from public.property_applications where host_email = (auth.jwt() ->> 'email')
  )
);

drop policy if exists "host_offers_host_delete" on public.host_offers;
create policy "host_offers_host_delete" on public.host_offers
for delete to authenticated
using (host_email = (auth.jwt() ->> 'email'));

-- 3. bookings audit columns ──────────────────────────────────────────────────
-- Mirrors the promo audit columns: a booking records which host offer applied
-- and what it gave. Old rows and non-offer bookings keep NULLs.
alter table public.bookings add column if not exists host_offer_id uuid references public.host_offers(id) on delete set null;
alter table public.bookings add column if not exists host_offer_free_nights integer;
alter table public.bookings add column if not exists host_offer_discount_percent numeric(5,2);
