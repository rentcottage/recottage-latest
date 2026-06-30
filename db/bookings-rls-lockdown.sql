-- ───────────────────────────────────────────────────────────────────────────
-- Lock down the `bookings` table (was readable by anyone with the public anon key).
--
-- After this, only an AUTHENTICATED user can read bookings, and only their own:
--   • the customer who made it          (user_email / customer_id match)
--   • the host of the booked property    (property_applications.host_email match)
--   • the owning corporate account       (corporate_applications.user_id match)
-- Admins read via the service-role `admin-host-actions` function (bypasses RLS).
-- All writes are service-role (bog-payment / booking-handler), so no client
-- INSERT/UPDATE/DELETE policies are needed.
--
-- Apply in Supabase → SQL Editor.
-- ───────────────────────────────────────────────────────────────────────────

-- 1) Turn RLS on.
alter table public.bookings enable row level security;

-- 2) IMPORTANT: remove any pre-existing permissive policy that exposes rows to
--    everyone, or the leak stays open. First see what exists:
--      select policyname, cmd, roles, qual from pg_policies where tablename = 'bookings';
--    Then drop each permissive (e.g. USING (true) / role {anon,public}) one:
--      drop policy "<policy name>" on public.bookings;

-- 3) The single read policy: authenticated users see only their own rows.
drop policy if exists "bookings_read_owner_host_corporate" on public.bookings;
create policy "bookings_read_owner_host_corporate"
on public.bookings
for select
to authenticated
using (
  (auth.jwt() ->> 'email') = user_email
  or customer_id = auth.uid()
  or property_id in (
    select id from public.property_applications
    where host_email = (auth.jwt() ->> 'email')
  )
  or corporate_id in (
    select id from public.corporate_applications
    where user_id = auth.uid()
  )
);
