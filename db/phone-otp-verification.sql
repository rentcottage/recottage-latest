-- ───────────────────────────────────────────────────────────────────────────
-- Phone OTP verification for registration
-- SMS provider: Citynet / City Telecom — sender ID "CottageGe"
-- Used by Edge Function: supabase/functions/phone-otp
--
-- Apply in the Supabase SQL editor (Dashboard → SQL) or via the Management API.
-- ───────────────────────────────────────────────────────────────────────────

-- 1) One-time-code challenge store.
--    Only the service role (the Edge Function) ever touches this table — codes
--    are stored hashed, never in plain text.
create table if not exists public.phone_otps (
  id          uuid primary key default gen_random_uuid(),
  phone       text        not null,            -- normalized gateway format: 995 + 9 digits
  code_hash   text        not null,            -- sha256(code : phone : pepper)
  expires_at  timestamptz not null,
  consumed    boolean     not null default false,
  attempts    smallint    not null default 0,
  ip          text,
  created_at  timestamptz not null default now()
);

-- Lookups for verify (latest live code per phone) and for rate-limit counts.
create index if not exists phone_otps_phone_created_idx on public.phone_otps (phone, created_at desc);
create index if not exists phone_otps_ip_created_idx    on public.phone_otps (ip,    created_at desc);

-- Lock the table down: RLS ON with NO policies => no anon/authenticated access at
-- all. The Edge Function uses the service-role key, which bypasses RLS.
alter table public.phone_otps enable row level security;

-- 2) Flag on profiles marking a phone that passed SMS verification.
alter table public.profiles
  add column if not exists phone_verified boolean not null default false;

-- 3) (Optional) housekeeping — run from a scheduled job if you want to prune old rows:
-- delete from public.phone_otps where created_at < now() - interval '2 days';
