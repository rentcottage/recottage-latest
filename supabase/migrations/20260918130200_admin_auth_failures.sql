-- Failed admin-password attempts, shared by admin-read and admin-host-actions.
--
-- One row per failed attempt, keyed by a SHA-256 hash of the client IP (the
-- first hop of x-forwarded-for). Raw IPs are never stored and never logged.
--
-- The rule the functions apply: 10 failures from the same ip_hash within 15
-- minutes → 429 until the oldest of those failures ages out of the window.
-- A successful login clears nothing, so one IP's success cannot unblock
-- another IP that is being throttled.
--
-- Only the service role touches this table: RLS is on and there is no policy,
-- and anon/authenticated hold no grants, so it is invisible to the anon key.
--
-- Safe to re-run.

create table if not exists public.admin_auth_failures (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  function_name text not null,
  failed_at timestamptz not null default now()
);

create index if not exists admin_auth_failures_ip_time
  on public.admin_auth_failures (ip_hash, failed_at desc);

alter table public.admin_auth_failures enable row level security;

revoke all on table public.admin_auth_failures from anon;
revoke all on table public.admin_auth_failures from authenticated;
revoke all on sequence public.admin_auth_failures_id_seq from anon;
revoke all on sequence public.admin_auth_failures_id_seq from authenticated;

comment on table public.admin_auth_failures is
  'Failed admin-password attempts (hashed client IP only). Service role only; feeds the 10-in-15-minutes throttle in admin-read and admin-host-actions.';

notify pgrst, 'reload schema';
