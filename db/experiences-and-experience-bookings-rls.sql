-- ───────────────────────────────────────────────────────────────────────────
-- Lock down `experiences` + `experience_bookings`.  APPLIED 2026-06-30.
--
-- experiences: dropped "exp_all" (ALL for public → anyone could edit prices/
--   content). Public READ kept; writes go through the service-role
--   admin-host-actions save-experience / delete-experience actions.
-- experience_bookings: dropped the authenticated read+update policies (any
--   logged-in user could read/modify all bookings = PII). Public INSERT kept
--   (the booking form); admin reads/updates go through the service-role function.
-- ───────────────────────────────────────────────────────────────────────────

-- experiences ────────────────────────────────────────────────────────────────
drop policy if exists "exp_all" on public.experiences;
drop policy if exists "experiences_public_read" on public.experiences;
create policy "experiences_public_read" on public.experiences
for select to anon, authenticated using (true);

-- experience_bookings ─────────────────────────────────────────────────────────
drop policy if exists "Allow authenticated read on experience_bookings" on public.experience_bookings;
drop policy if exists "Allow authenticated update on experience_bookings" on public.experience_bookings;
-- "Allow public insert on experience_bookings" is intentionally kept.

-- NOTE: the experience-photos storage bucket still allows anon write/delete —
-- lock in Dashboard → Storage → Policies (would require routing admin uploads
-- through a function; not done here).
