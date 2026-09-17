-- host_offers, property_activities and reviews: lock down (step 2 of 2).
--
-- Apply AFTER 20260918130100_public_offers_activities_reviews_views.sql and
-- after the frontend reads those views.
--
-- Before:
--   host_offers / property_activities  SELECT policy `true` for anon and
--     authenticated over every column, including host_email.
--   reviews                            SELECT policy `true` for public over
--     every column, including guest_email, the guest's full name and
--     booking_id. INSERT allowed to public whenever guest_email matched the
--     JWT email — no check that the guest actually stayed there.
--
-- After:
--   anon           no table access at all; the public pages read the three
--                  views below, which carry no email and no booking id.
--   authenticated  host_offers / property_activities: own rows only
--                  (host_email = JWT email), same as the write policies.
--                  reviews: own review, or a review of a property the caller
--                  hosts (the host dashboard shows the guest's name).
--                  reviews INSERT: only the guest of a confirmed/completed
--                  booking for that property, and only for their own booking.
--   service_role   unchanged.
--
-- The views run with owner rights (security_invoker = false) so they keep
-- working after anon loses table access: THE COLUMN LISTS BELOW ARE THE
-- SECURITY BOUNDARY — a new column on a base table is not published until it
-- is added here.
--
-- Safe to re-run.

-- ── host_offers ──────────────────────────────────────────────────────────────

alter table public.host_offers enable row level security;

drop policy if exists host_offers_public_read on public.host_offers;
drop policy if exists host_offers_owner_select on public.host_offers;
create policy host_offers_owner_select on public.host_offers
  for select to authenticated
  using (host_email = (auth.jwt() ->> 'email'));

revoke all on table public.host_offers from anon;
revoke all on table public.host_offers from authenticated;
grant select, insert, update, delete on table public.host_offers to authenticated;

-- ── property_activities ──────────────────────────────────────────────────────

alter table public.property_activities enable row level security;

drop policy if exists property_activities_public_read on public.property_activities;
drop policy if exists property_activities_owner_select on public.property_activities;
create policy property_activities_owner_select on public.property_activities
  for select to authenticated
  using (host_email = (auth.jwt() ->> 'email'));

revoke all on table public.property_activities from anon;
revoke all on table public.property_activities from authenticated;
grant select, insert, update, delete on table public.property_activities to authenticated;

-- ── reviews ──────────────────────────────────────────────────────────────────

alter table public.reviews enable row level security;

drop policy if exists public_read_reviews on public.reviews;
drop policy if exists guests_insert_own_reviews on public.reviews;

drop policy if exists reviews_guest_or_host_select on public.reviews;
create policy reviews_guest_or_host_select on public.reviews
  for select to authenticated
  using (
    guest_email = (auth.jwt() ->> 'email')
    or exists (
      select 1 from public.property_applications p
      where p.id::text = reviews.property_id
        and p.host_email = (auth.jwt() ->> 'email')
    )
  );

-- A review may only be written by the guest of a real, finished-or-confirmed
-- booking of that property, for their own booking.
drop policy if exists reviews_guest_insert on public.reviews;
create policy reviews_guest_insert on public.reviews
  for insert to authenticated
  with check (
    guest_email = (auth.jwt() ->> 'email')
    and booking_id is not null
    and exists (
      select 1 from public.bookings b
      where b.id = reviews.booking_id
        and b.property_id = reviews.property_id
        and b.status in ('confirmed', 'completed')
        and (
          b.customer_id = auth.uid()
          or lower(b.user_email) = lower(auth.jwt() ->> 'email')
        )
    )
  );

revoke all on table public.reviews from anon;
revoke all on table public.reviews from authenticated;
grant select on table public.reviews to authenticated;
grant insert (booking_id, property_id, guest_email, guest_name, rating, review_text)
  on table public.reviews to authenticated;

-- Public review feed: rating and text, plus the display name the page has
-- always rendered ("First L."). No guest_email, no booking_id.

notify pgrst, 'reload schema';
