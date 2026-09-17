-- Public availability for the property page, without exposing booking or
-- block records (step 1 of 2; apply BEFORE the frontend switches to it and
-- BEFORE 20260918100100_block_tables_privacy.sql removes anon table reads).
--
-- get_unavailable_ranges(p_property_id uuid) → (start_date, end_date, source_kind)
--   • Only approved properties; any other status or an unknown id returns zero
--     rows (no error, so existence is not revealed).
--   • No ids, emails, summaries, reasons, platforms, statuses or prices.
--   • Future ranges only ("today" in Asia/Tbilisi), capped at 1000 rows.
--
-- END-DATE CONVENTION (reproduces the server checks exactly):
--   source_kind = 'blocked'  (blocked_dates, ical_blocked_dates)
--       end_date is stored and treated as INCLUSIVE. A stay [check_in, check_out]
--       conflicts when start_date <= check_out AND end_date >= check_in
--       (assertDatesAvailable / booking_dates_free, and the property page today).
--   source_kind = 'booked'   (occupying bookings)
--       end_date = check_out, EXCLUSIVE (departure day is not a night). A stay
--       conflicts when check_in < end_date AND check_out > start_date
--       (assertDatesAvailable / booking_dates_free / bookings_no_overlap).
--   Occupying = confirmed, pending, pending_host_approval, and pending_payment
--   created less than 20 minutes ago (older holds are released before any new
--   booking is checked, so they never block).
--
-- Safe to re-run.

create or replace function public.get_unavailable_ranges(p_property_id uuid)
returns table (start_date date, end_date date, source_kind text)
language sql
stable
security definer
set search_path = ''
as $$
  with prop as (
    select p.id::text as pid
    from public.property_applications p
    where p.id = p_property_id
      and p.status = 'approved'
  ),
  today as (
    select (pg_catalog.timezone('Asia/Tbilisi', pg_catalog.now()))::date as d
  ),
  ranges as (
    select b.check_in as start_date, b.check_out as end_date, 'booked'::text as source_kind
    from public.bookings b, prop, today
    where b.property_id = prop.pid
      and (
        b.status in ('confirmed', 'pending', 'pending_host_approval')
        or (b.status = 'pending_payment' and b.created_at >= pg_catalog.now() - interval '20 minutes')
      )
      and b.check_out > today.d
    union all
    select d.start_date, d.end_date, 'blocked'::text
    from public.blocked_dates d, prop, today
    where d.property_id = prop.pid
      and d.end_date >= today.d
    union all
    select i.start_date, i.end_date, 'blocked'::text
    from public.ical_blocked_dates i, prop, today
    where i.property_id = prop.pid
      and i.end_date >= today.d
  )
  select r.start_date, r.end_date, r.source_kind
  from ranges r
  order by r.start_date, r.end_date, r.source_kind
  limit 1000
$$;

revoke all on function public.get_unavailable_ranges(uuid) from public;
revoke all on function public.get_unavailable_ranges(uuid) from anon, authenticated;
grant execute on function public.get_unavailable_ranges(uuid) to anon, authenticated, service_role;

-- Ask PostgREST to pick up the new function immediately.
notify pgrst, 'reload schema';
