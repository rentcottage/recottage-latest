-- marketing_weekly_stats — the numbers the weekly marketing report is built
-- from, and nothing else.
--
-- SECURITY MODEL
-- Like public_properties, this view runs with its OWNER's rights
-- (security_invoker is deliberately OFF), so it reads the base tables without
-- going through their RLS. THEREFORE THE COLUMN LIST BELOW IS THE SECURITY
-- BOUNDARY. Every column is an aggregate: a count, a money figure, or a
-- grouped breakdown by region / category. There is no column — and no path to
-- a column — carrying an email, a phone number, a person's name, a booking id,
-- a property id or a user id, and none may ever be added here. A marketing
-- report needs totals, not people.
--
-- Unlike public_properties this view is NOT public: only service_role holds
-- SELECT, because its only reader is the n8n-data edge function. anon and
-- authenticated get nothing, so nothing here is reachable with the key that
-- ships in the browser bundle.
--
-- "Approved listings" is the same population public_properties publishes
-- (property_applications where status = 'approved'), so the report and the
-- public site can never disagree.
--
-- Safe to re-run.

create or replace view public.marketing_weekly_stats
with (security_invoker = false) as
with listings as (
  select price_per_night, created_at, location, categories
  from public.property_applications
  where status = 'approved'
),
bookings_agg as (
  select
    count(*) filter (where created_at > now() - interval '7 days')  as bookings_7d,
    count(*) filter (where created_at > now() - interval '30 days') as bookings_30d,
    count(*) filter (where created_at > now() - interval '90 days') as bookings_90d,
    count(*) filter (where status in ('confirmed', 'completed'))    as confirmed_bookings_all_time,
    round(avg(total_price) filter (where status in ('confirmed', 'completed')), 2) as avg_booking_value
  from public.bookings
),
by_region as (
  select coalesce(jsonb_agg(jsonb_build_object('region', region, 'listings', n)
                            order by n desc, region), '[]'::jsonb) as listings_by_region
  from (select location as region, count(*) as n from listings group by 1) r
),
by_category as (
  select coalesce(jsonb_agg(jsonb_build_object('category', category, 'listings', n)
                            order by n desc, category), '[]'::jsonb) as listings_by_category
  from (select unnest(categories) as category, count(*) as n from listings group by 1) c
)
select
  (select count(*) from listings)::int                                              as approved_listings,
  (select count(*) from listings where created_at > now() - interval '7 days')::int  as new_listings_7d,
  (select count(*) from listings where created_at > now() - interval '30 days')::int as new_listings_30d,
  (select count(distinct location) from listings)::int                              as distinct_regions,
  by_region.listings_by_region,
  by_category.listings_by_category,
  (select min(price_per_night) from listings)                                       as price_min,
  (select round(avg(price_per_night), 2) from listings)                             as price_avg,
  (select max(price_per_night) from listings)                                       as price_max,
  bookings_agg.bookings_7d::int,
  bookings_agg.bookings_30d::int,
  bookings_agg.bookings_90d::int,
  bookings_agg.confirmed_bookings_all_time::int,
  bookings_agg.avg_booking_value
from bookings_agg, by_region, by_category;

comment on view public.marketing_weekly_stats is
  'Aggregates for the weekly marketing report (n8n-data function only). Owner rights: the column list is the security boundary — counts, prices and grouped breakdowns only. Never add a contact column, a person''s name or any row id. service_role only.';

revoke all on public.marketing_weekly_stats from public;
revoke all on public.marketing_weekly_stats from anon, authenticated;
grant select on public.marketing_weekly_stats to service_role;

notify pgrst, 'reload schema';
