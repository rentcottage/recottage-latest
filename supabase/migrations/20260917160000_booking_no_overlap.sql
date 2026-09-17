-- Double-booking prevention (Option C).
--
-- 1. An exclusion constraint makes overlapping occupying bookings of the same
--    property impossible, whichever code path writes them.
-- 2. Booking writes that must also respect host and imported blocks go through
--    SECURITY DEFINER functions that take a per-property advisory lock, release
--    expired payment holds, and check both block tables with the SAME rule the
--    booking handler uses today (start_date <= check_out AND end_date >= check_in).
-- 3. Block inserts/updates take the same per-property lock (trigger), so a
--    booking check and a concurrent block insert are serialized.
--
-- pending_payment holds its dates for 20 minutes from created_at; after that
-- release_expired_holds() moves it to payment_failed (BOG's order ttl is 15).
--
-- Safe to re-run. Service role only: EXECUTE is revoked from public, anon and
-- authenticated on every function.

create extension if not exists btree_gist with schema extensions;

-- ── Canonical property ids ────────────────────────────────────────────────────
-- property_id is text in these tables while property_applications.id is uuid.
-- Locks, overlap checks and the exclusion constraint compare text, so every
-- row must use the same spelling: lowercase canonical uuid text.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_property_id_canonical' and conrelid = 'public.bookings'::regclass) then
    alter table public.bookings add constraint bookings_property_id_canonical
      check (property_id is null or property_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blocked_dates_property_id_canonical' and conrelid = 'public.blocked_dates'::regclass) then
    alter table public.blocked_dates add constraint blocked_dates_property_id_canonical
      check (property_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ical_blocked_dates_property_id_canonical' and conrelid = 'public.ical_blocked_dates'::regclass) then
    alter table public.ical_blocked_dates add constraint ical_blocked_dates_property_id_canonical
      check (property_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  end if;
end $$;

-- ── Exclusion constraint ──────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_no_overlap' and conrelid = 'public.bookings'::regclass) then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (
        property_id extensions.gist_text_ops with =,
        daterange(check_in, check_out, '[)') with &&
      )
      where (status in ('confirmed', 'pending', 'pending_host_approval', 'pending_payment'));
  end if;
end $$;

-- ── Lock key (same expression everywhere) ─────────────────────────────────────
create or replace function public.booking_dates_lock_key(p_property_id text)
returns bigint
language sql
immutable
set search_path = ''
as $$ select pg_catalog.hashtextextended('rentcottage:booking-dates:' || coalesce(p_property_id, ''), 0) $$;

-- ── Block tables take the same lock ───────────────────────────────────────────
create or replace function public.lock_property_booking_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(public.booking_dates_lock_key(new.property_id::text));
  return new;
end $$;

drop trigger if exists blocked_dates_lock_booking_dates on public.blocked_dates;
create trigger blocked_dates_lock_booking_dates
  before insert or update of property_id, start_date, end_date on public.blocked_dates
  for each row execute function public.lock_property_booking_dates();

drop trigger if exists ical_blocked_dates_lock_booking_dates on public.ical_blocked_dates;
create trigger ical_blocked_dates_lock_booking_dates
  before insert or update of property_id, start_date, end_date on public.ical_blocked_dates
  for each row execute function public.lock_property_booking_dates();

-- ── Shared checks ─────────────────────────────────────────────────────────────

-- Moves THIS property's pending_payment bookings older than 20 minutes to
-- payment_failed (with a status log). Caller must hold the property lock.
create or replace function public.release_expired_holds(p_property_id text, p_except uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select b.id
    from public.bookings b
    where b.property_id = p_property_id
      and b.status = 'pending_payment'
      and coalesce(b.created_at, '-infinity'::timestamptz) < pg_catalog.now() - interval '20 minutes'
      and (p_except is null or b.id <> p_except)
    for update
  loop
    update public.bookings
       set status = 'payment_failed', payment_status = 'payment_failed'
     where id = r.id;
    insert into public.booking_status_logs (booking_id, event_type, from_status, to_status, changed_by, note)
    values (r.id, 'payment_hold_expired', 'pending_payment', 'payment_failed', 'system', 'Payment hold expired after 20 minutes; dates released');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- true when the stay [check_in, check_out) is free of other occupying bookings
-- and of host/imported blocks (today's rule). Caller must hold the property lock.
create or replace function public.booking_dates_free(p_property_id text, p_check_in date, p_check_out date, p_except uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
      select 1 from public.bookings b
      where b.property_id = p_property_id
        and b.status in ('confirmed', 'pending', 'pending_host_approval', 'pending_payment')
        and (p_except is null or b.id <> p_except)
        and b.check_in < p_check_out
        and b.check_out > p_check_in)
    and not exists (
      select 1 from public.blocked_dates d
      where d.property_id = p_property_id
        and d.start_date <= p_check_out
        and d.end_date >= p_check_in)
    and not exists (
      select 1 from public.ical_blocked_dates d
      where d.property_id = p_property_id
        and d.start_date <= p_check_out
        and d.end_date >= p_check_in)
$$;

-- ── create_booking_checked ────────────────────────────────────────────────────
-- Inserts a booking (given as JSON column values) only if its dates are free.
-- Returns the inserted row as JSON. Raises DATES_UNAVAILABLE on conflict.
create or replace function public.create_booking_checked(p_booking jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property text;
  v_check_in date := (p_booking ->> 'check_in')::date;
  v_check_out date := (p_booking ->> 'check_out')::date;
  v_status text := p_booking ->> 'status';
  v_cols text;
  v_row jsonb;
begin
  -- Normalize any uuid spelling (case, braces, no hyphens) to canonical text;
  -- anything that is not a uuid is rejected.
  begin
    v_property := (nullif(pg_catalog.btrim(p_booking ->> 'property_id'), ''))::uuid::text;
  exception when invalid_text_representation then
    raise exception 'INVALID_BOOKING' using errcode = 'P0001';
  end;
  p_booking := pg_catalog.jsonb_set(p_booking, '{property_id}', pg_catalog.to_jsonb(v_property));

  if v_property is null or v_check_in is null or v_check_out is null or v_check_out <= v_check_in then
    raise exception 'INVALID_BOOKING' using errcode = 'P0001';
  end if;
  if v_status is null or v_status not in ('confirmed', 'pending', 'pending_host_approval', 'pending_payment') then
    raise exception 'INVALID_BOOKING' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(public.booking_dates_lock_key(v_property));
  perform public.release_expired_holds(v_property);

  if not public.booking_dates_free(v_property, v_check_in, v_check_out) then
    raise exception 'DATES_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select string_agg(pg_catalog.quote_ident(a.attname), ', ' order by a.attnum)
    into v_cols
    from pg_catalog.pg_attribute a
   where a.attrelid = 'public.bookings'::regclass
     and a.attnum > 0 and not a.attisdropped
     and p_booking ? a.attname
     and a.attname not in ('id', 'created_at');

  begin
    execute pg_catalog.format(
      'insert into public.bookings (%1$s) select %1$s from pg_catalog.jsonb_populate_record(null::public.bookings, $1) returning pg_catalog.to_jsonb(bookings.*)',
      v_cols)
      into v_row
      using p_booking;
  exception when exclusion_violation then
    raise exception 'DATES_UNAVAILABLE' using errcode = 'P0001';
  end;
  return v_row;
end $$;

-- ── apply_paid_status ─────────────────────────────────────────────────────────
-- Applies a verified BOG payment. p_updates may contain only payment_status,
-- status (pending_host_approval | confirmed), payment_transaction_id and
-- approval_deadline. Returns { result: applied | conflict | noop, booking }.
-- On conflict (dates taken meanwhile, including an expired hold whose dates
-- were re-booked) the booking is rejected in the same transaction with
-- canceled_by = 'system' and payment_status = 'paid', ready for one refund.
create or replace function public.apply_paid_status(p_booking_id uuid, p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property text;
  v_booking public.bookings%rowtype;
  v_status text := p_updates ->> 'status';
begin
  if v_status is null or v_status not in ('pending_host_approval', 'confirmed') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if exists (select 1 from pg_catalog.jsonb_object_keys(p_updates) k where k not in ('payment_status', 'status', 'payment_transaction_id', 'approval_deadline')) then
    raise exception 'INVALID_UPDATE' using errcode = 'P0001';
  end if;

  select property_id into v_property from public.bookings where id = p_booking_id;
  if not found then
    return pg_catalog.jsonb_build_object('result', 'noop', 'booking', null);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(public.booking_dates_lock_key(v_property));
  select * into v_booking from public.bookings where id = p_booking_id for update;

  if v_booking.status not in ('pending_payment', 'payment_failed') then
    return pg_catalog.jsonb_build_object('result', 'noop', 'booking', pg_catalog.to_jsonb(v_booking));
  end if;

  perform public.release_expired_holds(v_property, p_booking_id);

  if v_property is not null and not public.booking_dates_free(v_property, v_booking.check_in, v_booking.check_out, p_booking_id) then
    update public.bookings
       set status = 'rejected',
           payment_status = 'paid',
           payment_transaction_id = coalesce(p_updates ->> 'payment_transaction_id', payment_transaction_id),
           canceled_by = 'system',
           canceled_at = pg_catalog.now(),
           rejection_note = 'DATES_UNAVAILABLE_AFTER_PAYMENT'
     where id = p_booking_id
     returning * into v_booking;
    return pg_catalog.jsonb_build_object('result', 'conflict', 'booking', pg_catalog.to_jsonb(v_booking));
  end if;

  begin
    update public.bookings
       set payment_status = coalesce(p_updates ->> 'payment_status', payment_status),
           status = v_status,
           payment_transaction_id = coalesce(p_updates ->> 'payment_transaction_id', payment_transaction_id),
           approval_deadline = case when p_updates ? 'approval_deadline' then (p_updates ->> 'approval_deadline')::timestamptz else approval_deadline end
     where id = p_booking_id
     returning * into v_booking;
  exception when exclusion_violation then
    update public.bookings
       set status = 'rejected',
           payment_status = 'paid',
           payment_transaction_id = coalesce(p_updates ->> 'payment_transaction_id', payment_transaction_id),
           canceled_by = 'system',
           canceled_at = pg_catalog.now(),
           rejection_note = 'DATES_UNAVAILABLE_AFTER_PAYMENT'
     where id = p_booking_id
     returning * into v_booking;
    return pg_catalog.jsonb_build_object('result', 'conflict', 'booking', pg_catalog.to_jsonb(v_booking));
  end;
  return pg_catalog.jsonb_build_object('result', 'applied', 'booking', pg_catalog.to_jsonb(v_booking));
end $$;

-- ── apply_date_change ─────────────────────────────────────────────────────────
-- Approves a pending date change at the given price if the requested dates are
-- free. Raises NO_PENDING_CHANGE, INVALID_DATES, BOOKING_CLOSED or DATES_UNAVAILABLE.
create or replace function public.apply_date_change(p_booking_id uuid, p_total_price numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property text;
  v_booking public.bookings%rowtype;
begin
  select property_id into v_property from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'NO_PENDING_CHANGE' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(public.booking_dates_lock_key(v_property));
  select * into v_booking from public.bookings where id = p_booking_id for update;

  if v_booking.date_change_status is distinct from 'pending' then
    raise exception 'NO_PENDING_CHANGE' using errcode = 'P0001';
  end if;
  if v_booking.requested_check_in is null or v_booking.requested_check_out is null
     or v_booking.requested_check_out <= v_booking.requested_check_in then
    raise exception 'INVALID_DATES' using errcode = 'P0001';
  end if;
  if v_booking.status in ('cancelled', 'cancelled_by_host', 'rejected') then
    raise exception 'BOOKING_CLOSED' using errcode = 'P0001';
  end if;

  perform public.release_expired_holds(v_property, p_booking_id);
  if v_property is null or not public.booking_dates_free(v_property, v_booking.requested_check_in, v_booking.requested_check_out, p_booking_id) then
    raise exception 'DATES_UNAVAILABLE' using errcode = 'P0001';
  end if;

  begin
    update public.bookings
       set check_in = v_booking.requested_check_in,
           check_out = v_booking.requested_check_out,
           total_price = p_total_price,
           requested_total_price = p_total_price,
           date_change_status = 'approved'
     where id = p_booking_id
     returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'DATES_UNAVAILABLE' using errcode = 'P0001';
  end;
  return pg_catalog.to_jsonb(v_booking);
end $$;

-- ── Privileges: service role only ─────────────────────────────────────────────
revoke all on function public.booking_dates_lock_key(text) from public, anon, authenticated;
revoke all on function public.lock_property_booking_dates() from public, anon, authenticated;
revoke all on function public.release_expired_holds(text, uuid) from public, anon, authenticated;
revoke all on function public.booking_dates_free(text, date, date, uuid) from public, anon, authenticated;
revoke all on function public.create_booking_checked(jsonb) from public, anon, authenticated;
revoke all on function public.apply_paid_status(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.apply_date_change(uuid, numeric) from public, anon, authenticated;

grant execute on function public.booking_dates_lock_key(text) to service_role;
grant execute on function public.release_expired_holds(text, uuid) to service_role;
grant execute on function public.booking_dates_free(text, date, date, uuid) to service_role;
grant execute on function public.create_booking_checked(jsonb) to service_role;
grant execute on function public.apply_paid_status(uuid, jsonb) to service_role;
grant execute on function public.apply_date_change(uuid, numeric) to service_role;

-- Browsers never write bookings directly (RLS already has no write policy).
revoke insert, update, delete on table public.bookings from anon, authenticated;
