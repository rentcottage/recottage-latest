-- Public listing data without host contact details (step 1 of 2; apply BEFORE
-- the frontend switches to it and BEFORE 20260918120100_property_applications_privacy.sql).
--
-- 1. public.public_properties — the only public way to read listings.
--    SECURITY MODEL: the view runs with its OWNER's rights (security_invoker is
--    deliberately OFF), so it does NOT go through property_applications RLS and
--    keeps working after anon loses table access. Therefore THIS VIEW'S COLUMN
--    LIST AND ITS WHERE CLAUSE ARE THE SECURITY BOUNDARY: add a column only if it
--    is safe to publish for every approved listing.
--    Columns = exactly what the public pages render: listing content, pricing,
--    the cottage location the property page shows (address, map link,
--    coordinates), and the host's first name plus last-name INITIAL (the site
--    only ever displays "First L."). Never: host_last_name, host_email,
--    host_phone, admin_token, ical_url, rejection_note, agreement_*, internal flags.
--    Only status = 'approved' (the public site shows nothing else).
--
-- 2. public.get_booking_host_contact(p_booking_id) — replaces the profile page's
--    direct read of host_email/host_phone. Returns the host's name, email and
--    phone only to the guest who owns the booking (auth.uid() = customer_id, or
--    their confirmed account email = booking user_email), only for a confirmed or
--    completed booking, and only from the day before check-in (UTC), matching
--    the page's reveal rule. Otherwise zero rows.
--
-- Safe to re-run.

create or replace view public.public_properties
with (security_invoker = false) as
select
  p.id,
  p.title,
  p.description,
  p.location,
  p.property_type,
  p.bedrooms,
  p.bathrooms,
  p.max_guests,
  p.amenities,
  p.categories,
  p.photo_urls,
  p.cover_photo_url,
  p.cover_photo_position,
  p.price_per_night,
  p.pricing_type,
  p.guest_pricing_tiers,
  p.accepted_payment_methods,
  p.google_maps_url,
  p.latitude,
  p.longitude,
  p.address,
  p.host_first_name,
  left(p.host_last_name, 1) as host_last_initial,
  p.created_at
from public.property_applications p
where p.status = 'approved';

comment on view public.public_properties is
  'Public listing data. Runs with owner rights (bypasses property_applications RLS): the column list and status filter are the security boundary. No host contact data.';

revoke all on public.public_properties from public;
revoke all on public.public_properties from anon, authenticated;
grant select on public.public_properties to anon, authenticated, service_role;

create or replace function public.get_booking_host_contact(p_booking_id uuid)
returns table (host_first_name text, host_last_name text, host_email text, host_phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.host_first_name, p.host_last_name, p.host_email, p.host_phone
  from public.bookings b
  join public.property_applications p on p.id::text = b.property_id
  where b.id = p_booking_id
    and auth.uid() is not null
    and (
      b.customer_id = auth.uid()
      or exists (
        select 1 from auth.users u
        where u.id = auth.uid()
          and u.email is not null
          and u.email_confirmed_at is not null
          and pg_catalog.lower(u.email) = pg_catalog.lower(b.user_email)
      )
    )
    and b.status in ('confirmed', 'completed')
    and b.check_in - 1 <= (pg_catalog.timezone('UTC', pg_catalog.now()))::date
  limit 1
$$;

revoke all on function public.get_booking_host_contact(uuid) from public;
revoke all on function public.get_booking_host_contact(uuid) from anon;
grant execute on function public.get_booking_host_contact(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
