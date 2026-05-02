-- Run this once in the Supabase SQL editor.
-- Creates the experiences table + storage bucket used by the homepage and the admin panel.

-- 1. Table -----------------------------------------------------------------
create extension if not exists "pgcrypto";

create table if not exists public.experiences (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text not null,
  price_per_person numeric(10,2) not null default 0,
  currency_symbol text not null default '₾',
  image_url       text,
  status          text not null default 'active'
                  check (status in ('active','coming_soon','archived')),
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists experiences_display_order_idx
  on public.experiences (display_order, created_at);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists experiences_updated_at on public.experiences;
create trigger experiences_updated_at
  before update on public.experiences
  for each row execute function public.set_updated_at();

-- 2. Row Level Security -----------------------------------------------------
-- Public can read non-archived rows. Writes are open to anon (matches the
-- existing admin pattern, which is gated by the client-side AdminGate password).
-- Tighten later if you wire up Supabase admin auth.
alter table public.experiences enable row level security;

drop policy if exists "Public read non-archived experiences" on public.experiences;
create policy "Public read non-archived experiences"
  on public.experiences for select
  using (status <> 'archived');

drop policy if exists "Anon insert experiences" on public.experiences;
create policy "Anon insert experiences"
  on public.experiences for insert
  with check (true);

drop policy if exists "Anon update experiences" on public.experiences;
create policy "Anon update experiences"
  on public.experiences for update
  using (true) with check (true);

drop policy if exists "Anon delete experiences" on public.experiences;
create policy "Anon delete experiences"
  on public.experiences for delete
  using (true);

-- 3. Storage bucket ---------------------------------------------------------
-- Public read so <img src> works without signed URLs. Run in a separate query
-- if your Supabase project blocks bucket creation outside the dashboard.
insert into storage.buckets (id, name, public)
values ('experience-photos', 'experience-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read experience photos" on storage.objects;
create policy "Public read experience photos"
  on storage.objects for select
  using (bucket_id = 'experience-photos');

drop policy if exists "Anon upload experience photos" on storage.objects;
create policy "Anon upload experience photos"
  on storage.objects for insert
  with check (bucket_id = 'experience-photos');

drop policy if exists "Anon update experience photos" on storage.objects;
create policy "Anon update experience photos"
  on storage.objects for update
  using (bucket_id = 'experience-photos');

drop policy if exists "Anon delete experience photos" on storage.objects;
create policy "Anon delete experience photos"
  on storage.objects for delete
  using (bucket_id = 'experience-photos');

-- 4. Seed (optional) — pre-populate with the three current homepage cards.
-- Comment out if you'd rather start empty.
insert into public.experiences (title, description, price_per_person, status, display_order, image_url)
values
  ('Traditional Cooking Class',
   'Learn to make authentic khachapuri and khinkali with local families in a warm home setting.',
   45, 'active', 10,
   'https://readdy.ai/api/search-image?query=Georgian%20grandmother%20teaching%20traditional%20cooking%20in%20rustic%20kitchen%2C%20making%20khachapuri%20and%20khinkali%2C%20authentic%20clay%20oven%2C%20wooden%20utensils%2C%20warm%20family%20atmosphere%2C%20traditional%20Georgian%20cuisine%20preparation&width=400&height=300&seq=cooking&orientation=landscape'),
  ('Traditional Georgian Wine Tasting',
   'Experience 8,000-year-old winemaking tradition with authentic qvevri wines and local varieties.',
   35, 'active', 20,
   'https://readdy.ai/api/search-image?query=Traditional%20Georgian%20wine%20cellar%20tasting%20experience%2C%20ancient%20qvevri%20clay%20vessels%2C%20wine%20master%20pouring%20amber%20wine%2C%20rustic%20stone%20cellar%2C%20candlelit%20atmosphere%2C%20traditional%20Georgian%20winemaking%2C%20authentic%20vineyard%20setting&width=400&height=300&seq=winetasting&orientation=landscape'),
  ('Guided Mountain Hiking',
   'Explore pristine Caucasus trails with experienced local guides through stunning alpine scenery.',
   60, 'coming_soon', 30,
   'https://readdy.ai/api/search-image?query=Georgian%20mountain%20hiking%20experience%20with%20local%20guide%2C%20Caucasus%20peaks%2C%20alpine%20meadows%2C%20traditional%20villages%20and%20hiking%20trails%2C%20breathtaking%20mountain%20scenery&width=400&height=300&seq=hiking-experience&orientation=landscape')
on conflict do nothing;
