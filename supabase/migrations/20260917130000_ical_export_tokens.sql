-- ical_export_tokens: one secret export token per property for the public
-- ical-export feed (OTAs cannot send Authorization headers).
--
-- Access: service role only. RLS is enabled with NO policies and all
-- privileges are revoked from anon and authenticated, so the token is only
-- reachable through the ical-sync `export-token` action (verified owner) and
-- the ical-export function (token lookup).
--
-- Idempotent: this project has no remote migration history
-- (supabase_migrations.schema_migrations does not exist), so this file may be
-- executed once directly and later seen again by `supabase db push`.

create table if not exists public.ical_export_tokens (
  property_id uuid primary key references public.property_applications(id) on delete cascade,
  token       text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$'),
  created_at  timestamptz not null default now(),
  rotated_at  timestamptz
);

alter table public.ical_export_tokens enable row level security;

revoke all on table public.ical_export_tokens from anon, authenticated;
grant select, insert, update, delete on table public.ical_export_tokens to service_role;
