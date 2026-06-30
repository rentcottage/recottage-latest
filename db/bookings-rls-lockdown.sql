-- ───────────────────────────────────────────────────────────────────────────
-- Lock down the `bookings` table.  APPLIED 2026-06-30 (via Management API).
--
-- Removed: "Allow anon select bookings by email" (qual=true → leaked ALL rows)
--          "Allow anon insert bookings" (anon could create a paid/confirmed booking)
--          "bookings_corporate_read" (folded into the new policy)
-- Added:   one authenticated read policy — customer / host / corporate see only
--          their own rows. Admins read via the service-role admin-host-actions
--          `fetch-bookings` action; all writes are service-role (bypass RLS).
-- Column types: customer_id/corporate_id = uuid, property_id = text.
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "Allow anon select bookings by email" on public.bookings;
drop policy if exists "Allow anon insert bookings" on public.bookings;
drop policy if exists "bookings_corporate_read" on public.bookings;
drop policy if exists "bookings_read_owner_host_corporate" on public.bookings;

create policy "bookings_read_owner_host_corporate" on public.bookings
for select to authenticated
using (
  (auth.jwt() ->> 'email') = user_email
  or customer_id = auth.uid()
  or property_id in (
    select id::text from public.property_applications where host_email = (auth.jwt() ->> 'email')
  )
  or corporate_id in (
    select id from public.corporate_applications where user_id = auth.uid()
  )
);
