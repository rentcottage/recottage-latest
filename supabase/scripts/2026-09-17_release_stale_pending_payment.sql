-- ONE-OFF DATA FIX — NOT a migration. Do not run without owner approval.
--
-- Releases the two stale pay-now bookings that have been pending_payment for
-- months (stays already in the past). Once bookings_no_overlap is in place,
-- pending_payment rows count as occupying; these two would otherwise stay
-- "occupying" until release_expired_holds() touches their property.
--
-- Guarded: only rows whose id starts with the two known prefixes, still
-- pending_payment, with a past check-out and created more than a day ago.
-- Aborts unless exactly 2 rows match. Adds one status log entry per row.

begin;

do $$
declare
  v_ids uuid[];
begin
  select array_agg(id) into v_ids
  from public.bookings
  where (id::text like '96b9631e%' or id::text like '164d3302%')
    and status = 'pending_payment'
    and check_out < current_date
    and created_at < now() - interval '1 day';

  if coalesce(array_length(v_ids, 1), 0) <> 2 then
    raise exception 'Expected exactly 2 stale pending_payment bookings, found %', coalesce(array_length(v_ids, 1), 0);
  end if;

  update public.bookings
     set status = 'payment_failed', payment_status = 'payment_failed'
   where id = any (v_ids);

  insert into public.booking_status_logs (booking_id, event_type, from_status, to_status, changed_by, note)
  select id, 'stale_pending_payment_released', 'pending_payment', 'payment_failed', 'admin',
         'One-off cleanup: pay-now booking never completed; stay in the past'
  from unnest(v_ids) as id;
end $$;

commit;
