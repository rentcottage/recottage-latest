-- Block tables privacy and write authorization (step 2 of 2; apply AFTER the
-- frontend reads availability through get_unavailable_ranges()).
--
-- Before: anyone (anon key) could read every row of blocked_dates and
-- ical_blocked_dates, including host_email, reason, summary, uid and
-- calendar_id; any signed-in user could insert a block on ANY property by
-- putting their own email in host_email.
--
-- After:
--   blocked_dates       authenticated owners only: SELECT / INSERT / DELETE on
--                       blocks of properties they own (property_applications.host_email
--                       = their confirmed account email, case-insensitive). No UPDATE.
--   ical_blocked_dates  authenticated owners: SELECT only. Writes come solely
--                       from ical-sync (service role).
--   anon                no table access at all (use get_unavailable_ranges()).
--   service_role        unchanged (bypasses RLS): ical-sync, ical-export,
--                       booking-handler, admin-host-actions, no-overlap functions.
--
-- The no-overlap lock triggers and canonical property_id CHECKs are untouched.
-- Safe to re-run.

-- ── Ownership helper ─────────────────────────────────────────────────────────
-- true when the caller's CONFIRMED account email owns the property.
create or replace function public.is_property_owner(p_property_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.property_applications p
    join auth.users u on u.id = auth.uid()
    where p.id::text = p_property_id
      and u.email is not null
      and u.email_confirmed_at is not null
      and p.host_email is not null
      and pg_catalog.lower(p.host_email) = pg_catalog.lower(u.email)
  )
$$;

revoke all on function public.is_property_owner(text) from public;
revoke all on function public.is_property_owner(text) from anon;
grant execute on function public.is_property_owner(text) to authenticated, service_role;

-- ── blocked_dates ────────────────────────────────────────────────────────────
alter table public.blocked_dates enable row level security;

drop policy if exists public_read_blocked_dates on public.blocked_dates;
drop policy if exists hosts_insert_blocked_dates on public.blocked_dates;
drop policy if exists hosts_delete_own_blocked_dates on public.blocked_dates;

drop policy if exists blocked_dates_owner_select on public.blocked_dates;
create policy blocked_dates_owner_select on public.blocked_dates
  for select to authenticated
  using (public.is_property_owner(property_id));

drop policy if exists blocked_dates_owner_insert on public.blocked_dates;
create policy blocked_dates_owner_insert on public.blocked_dates
  for insert to authenticated
  with check (
    public.is_property_owner(property_id)
    and pg_catalog.lower(host_email) = pg_catalog.lower(auth.jwt() ->> 'email')
  );

drop policy if exists blocked_dates_owner_delete on public.blocked_dates;
create policy blocked_dates_owner_delete on public.blocked_dates
  for delete to authenticated
  using (public.is_property_owner(property_id));

revoke all on table public.blocked_dates from anon;
revoke update, truncate, references, trigger on table public.blocked_dates from authenticated;
grant select, insert, delete on table public.blocked_dates to authenticated;

-- ── ical_blocked_dates ───────────────────────────────────────────────────────
alter table public.ical_blocked_dates enable row level security;

drop policy if exists hosts_read_own_ical_blocks on public.ical_blocked_dates;

drop policy if exists ical_blocked_dates_owner_select on public.ical_blocked_dates;
create policy ical_blocked_dates_owner_select on public.ical_blocked_dates
  for select to authenticated
  using (public.is_property_owner(property_id));

revoke all on table public.ical_blocked_dates from anon;
revoke insert, update, delete, truncate, references, trigger on table public.ical_blocked_dates from authenticated;
grant select on table public.ical_blocked_dates to authenticated;

notify pgrst, 'reload schema';
