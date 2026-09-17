-- property_applications lockdown (step 2 of 2; apply AFTER the frontend reads
-- public_properties / get_booking_host_contact).
--
-- Before:
--   • anon and every signed-in user could read ALL columns of approved listings
--     (host names, email, phone, address, admin_token, …);
--   • anon could INSERT rows with any values, including status = 'approved'
--     (the real submission path is property-application-handler, service role);
--   • a host could UPDATE any column of their own rows, including status
--     (self-approval) and admin_token, and could READ admin_token of their own
--     pending application (the emailed approve link accepts it).
--
-- After:
--   anon           no access (public listings come from public_properties).
--   authenticated  SELECT own rows only (is_property_owner: confirmed account
--                  email = host_email, case-insensitive), every column EXCEPT
--                  admin_token; UPDATE own rows, only the listing fields the host
--                  dashboard edits. No INSERT, DELETE or status changes.
--   service_role   unchanged (admin panel functions, application handler, etc.).
--
-- Policies on bookings, host_offers and property_activities that sub-select
-- property_applications (id, host_email) keep working for owners.
-- Safe to re-run.

alter table public.property_applications enable row level security;

drop policy if exists anon_read_approved_applications on public.property_applications;
drop policy if exists authenticated_read_approved_applications on public.property_applications;
drop policy if exists anon_insert_applications on public.property_applications;
drop policy if exists host_view_own_applications on public.property_applications;
drop policy if exists host_update_own_applications on public.property_applications;

drop policy if exists property_applications_owner_select on public.property_applications;
create policy property_applications_owner_select on public.property_applications
  for select to authenticated
  using (public.is_property_owner(id::text));

drop policy if exists property_applications_owner_update on public.property_applications;
create policy property_applications_owner_update on public.property_applications
  for update to authenticated
  using (public.is_property_owner(id::text))
  with check (public.is_property_owner(id::text));

revoke all on table public.property_applications from anon;
revoke all on table public.property_applications from authenticated;

-- Every column except admin_token. A NEW column is not readable by hosts until
-- it is added here.
grant select (
  id, host_first_name, host_last_name, host_email, host_phone, property_type,
  location, bedrooms, bathrooms, max_guests, amenities, photo_urls, title,
  description, price_per_night, status, created_at, google_maps_url, latitude,
  longitude, address, booking_approval_mode, rejection_note, cover_photo_url,
  agreement_reminder_sent_at, agreement_status, agreement_received_at,
  pricing_type, guest_pricing_tiers, cover_photo_position, ical_url,
  ical_last_synced, sms_notifications_enabled, categories,
  accepted_payment_methods, approved_at
) on public.property_applications to authenticated;

-- Exactly the fields HostPropertyEditModal writes.
grant update (
  title, description, price_per_night, amenities, google_maps_url, latitude,
  longitude, address, booking_approval_mode, pricing_type, guest_pricing_tiers,
  accepted_payment_methods, photo_urls, cover_photo_url, cover_photo_position
) on public.property_applications to authenticated;

notify pgrst, 'reload schema';
