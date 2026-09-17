-- Public views for host_offers, property_activities and reviews (step 1 of 2).
--
-- Apply BEFORE the frontend switches to them, and before
-- 20260918130150_offers_activities_reviews_privacy.sql takes the base tables
-- away from anon. Creating them changes nothing for existing readers.
--
-- Each view runs with its OWNER's rights (security_invoker is deliberately
-- OFF) so it keeps working after anon loses table access. THEREFORE EACH
-- COLUMN LIST BELOW IS THE SECURITY BOUNDARY: a new column on a base table is
-- not published until it is added here. No host_email, no guest_email, no
-- booking_id.
--
-- Safe to re-run.

-- ── host_offers ──────────────────────────────────────────────────────────────

create or replace view public.public_host_offers
with (security_invoker = false) as
select
  o.id,
  o.property_id,
  o.title,
  o.offer_type,
  o.buy_nights,
  o.free_nights,
  o.discount_percent,
  o.active,
  o.starts_at,
  o.ends_at,
  o.created_at
from public.host_offers o
where o.active;

comment on view public.public_host_offers is
  'Live host deals without host_email. Owner rights (bypasses host_offers RLS): the column list is the security boundary.';

revoke all on public.public_host_offers from public;
revoke all on public.public_host_offers from anon, authenticated;
grant select on public.public_host_offers to anon, authenticated, service_role;

-- ── property_activities ──────────────────────────────────────────────────────

create or replace view public.public_property_activities
with (security_invoker = false) as
select
  a.id,
  a.property_id,
  a.title,
  a.description,
  a.category,
  a.price,
  a.price_unit,
  a.duration_minutes,
  a.image_url,
  a.active,
  a.display_order,
  a.created_at
from public.property_activities a
where a.active;

comment on view public.public_property_activities is
  'Active host activities without host_email. Owner rights (bypasses property_activities RLS): the column list is the security boundary.';

revoke all on public.public_property_activities from public;
revoke all on public.public_property_activities from anon, authenticated;
grant select on public.public_property_activities to anon, authenticated, service_role;

-- ── reviews ──────────────────────────────────────────────────────────────────

create or replace view public.public_reviews
with (security_invoker = false) as
select
  r.id,
  r.property_id,
  r.rating,
  r.review_text,
  r.created_at,
  -- "Nino Privatesurname" → "Nino P."; a one-word name stays as it is; a blank
  -- name becomes 'Guest'. Whitespace is collapsed first so odd spacing cannot
  -- smuggle the surname through.
  case
    when coalesce(btrim(regexp_replace(r.guest_name, '\s+', ' ', 'g')), '') = '' then 'Guest'
    when split_part(btrim(regexp_replace(r.guest_name, '\s+', ' ', 'g')), ' ', 2) = ''
      then split_part(btrim(regexp_replace(r.guest_name, '\s+', ' ', 'g')), ' ', 1)
    else split_part(btrim(regexp_replace(r.guest_name, '\s+', ' ', 'g')), ' ', 1) || ' ' ||
         left(split_part(btrim(regexp_replace(r.guest_name, '\s+', ' ', 'g')), ' ', 2), 1) || '.'
  end as display_name
from public.reviews r;

comment on view public.public_reviews is
  'Public review feed. Owner rights (bypasses reviews RLS): the column list is the security boundary. Never add guest_email or booking_id.';

revoke all on public.public_reviews from public;
revoke all on public.public_reviews from anon, authenticated;
grant select on public.public_reviews to anon, authenticated, service_role;

notify pgrst, 'reload schema';
