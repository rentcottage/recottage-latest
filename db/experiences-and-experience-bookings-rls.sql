-- ───────────────────────────────────────────────────────────────────────────
-- Lock down `experiences` (was anon-writable → defacement/price tampering) and
-- `experience_bookings` (was anon-readable → customer PII).
--
-- experiences:          public READ stays; all WRITES go through the service-role
--                       admin-host-actions function (save-experience / delete-experience).
-- experience_bookings:  anyone can CREATE a booking; only the service-role admin
--                       function can read/update (admin panel reads via it).
--
-- Apply in Supabase → SQL Editor. For each table, first list existing policies and
-- drop any permissive one, then create the policy below.
--   select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'experiences';
--   drop policy "<name>" on public.experiences;   -- repeat for each anon write/all policy
-- ───────────────────────────────────────────────────────────────────────────

-- experiences ────────────────────────────────────────────────────────────────
alter table public.experiences enable row level security;
drop policy if exists "experiences_public_read" on public.experiences;
create policy "experiences_public_read" on public.experiences
  for select to anon, authenticated using (true);
-- (no anon INSERT/UPDATE/DELETE policy → writes are service-role only)

-- experience_bookings ──────────────────────────────────────────────────────────
alter table public.experience_bookings enable row level security;
drop policy if exists "experience_bookings_public_insert" on public.experience_bookings;
create policy "experience_bookings_public_insert" on public.experience_bookings
  for insert to anon, authenticated with check (true);
-- (no SELECT/UPDATE/DELETE policy → only the service-role admin function can read/modify)

-- OPTIONAL — storage: the `experience-photos` bucket still allows anon write/delete.
-- Lock it in Dashboard → Storage → Policies (remove anon insert/update/delete).
-- Note: admin photo upload currently writes to the bucket from the browser, so
-- locking it would require routing uploads through a function (not done here).
