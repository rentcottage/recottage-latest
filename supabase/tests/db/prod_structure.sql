-- Structure-only copy of production tables (generated from catalog; no data).
create table public.property_applications (
  id uuid default gen_random_uuid() not null,
  host_first_name text not null,
  host_last_name text not null,
  host_email text not null,
  host_phone text not null,
  property_type text not null,
  location text not null,
  bedrooms integer not null,
  bathrooms integer not null,
  max_guests integer not null,
  amenities text[] default '{}'::text[],
  photo_urls text[] default '{}'::text[],
  title text not null,
  description text not null,
  price_per_night numeric(10,2) not null,
  status text default 'pending'::text,
  admin_token uuid default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  google_maps_url text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  address text,
  booking_approval_mode text default 'manual_24h'::text,
  rejection_note text,
  cover_photo_url text,
  agreement_reminder_sent_at timestamp with time zone,
  agreement_status text default 'not_sent'::text not null,
  agreement_received_at timestamp with time zone,
  pricing_type text default 'fixed'::text not null,
  guest_pricing_tiers jsonb,
  cover_photo_position text default 'center'::text,
  ical_url text,
  ical_last_synced timestamp with time zone,
  sms_notifications_enabled boolean default false not null,
  categories text[] default '{}'::text[],
  accepted_payment_methods text default 'both'::text not null,
  approved_at timestamp with time zone
);
create table public.bookings (
  id uuid default gen_random_uuid() not null,
  user_email text not null,
  user_name text,
  property_id text,
  property_title text not null,
  property_location text,
  check_in date not null,
  check_out date not null,
  guests integer default 1 not null,
  price_per_night numeric,
  total_price numeric,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now(),
  payment_status text default 'pending'::text,
  requested_check_in date,
  requested_check_out date,
  requested_total_price numeric,
  date_change_status text,
  date_change_requested_at timestamp with time zone,
  payment_transaction_id text,
  customer_id uuid,
  payment_method text default 'pay_now'::text,
  canceled_by text,
  canceled_at timestamp with time zone,
  approval_deadline timestamp with time zone,
  rejection_note text,
  contact_reveal_sent boolean default false,
  reminder_12h_sent boolean default false,
  reminder_16h_sent boolean default false,
  corporate_id uuid,
  promo_id uuid,
  promo_discount_percent numeric(5,2),
  pre_discount_total numeric(10,2),
  host_offer_id uuid,
  host_offer_free_nights integer,
  host_offer_discount_percent numeric(5,2)
);
create table public.blocked_dates (
  id uuid default gen_random_uuid() not null,
  property_id text not null,
  start_date date not null,
  end_date date not null,
  reason text,
  host_email text not null,
  created_at timestamp with time zone default now()
);
create table public.ical_blocked_dates (
  id uuid default gen_random_uuid() not null,
  property_id text not null,
  host_email text not null,
  start_date date not null,
  end_date date not null,
  summary text,
  uid text,
  source text default 'airbnb'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  calendar_id uuid,
  platform text default 'airbnb'::text
);
create table public.booking_status_logs (
  id uuid default gen_random_uuid() not null,
  booking_id uuid not null,
  event_type text not null,
  from_status text,
  to_status text not null,
  changed_by text default 'system'::text not null,
  note text,
  created_at timestamp with time zone default now()
);
alter table public.property_applications add constraint property_applications_pkey PRIMARY KEY (id);
alter table public.property_applications add constraint property_applications_payment_methods_check CHECK ((accepted_payment_methods = ANY (ARRAY['online_only'::text, 'pay_at_property_only'::text, 'both'::text])));
alter table public.property_applications add constraint property_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'hidden'::text])));
alter table public.bookings add constraint bookings_pkey PRIMARY KEY (id);
-- skipped (external table): alter table public.bookings fk bookings_corporate_id_fkey
-- skipped (external table): alter table public.bookings fk bookings_host_offer_id_fkey
-- skipped (external table): alter table public.bookings fk bookings_promo_id_fkey
alter table public.blocked_dates add constraint blocked_dates_pkey PRIMARY KEY (id);
alter table public.ical_blocked_dates add constraint ical_blocked_dates_pkey PRIMARY KEY (id);
-- skipped (external table): alter table public.ical_blocked_dates fk ical_blocked_dates_calendar_id_fkey
alter table public.booking_status_logs add constraint booking_status_logs_pkey PRIMARY KEY (id);
alter table public.booking_status_logs add constraint booking_status_logs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.property_applications enable row level security;
create policy anon_read_approved_applications on public.property_applications as PERMISSIVE for SELECT to anon using ((status = 'approved'::text));
create policy authenticated_read_approved_applications on public.property_applications as PERMISSIVE for SELECT to authenticated using ((status = 'approved'::text));
create policy host_update_own_applications on public.property_applications as PERMISSIVE for UPDATE to public using ((host_email = (auth.jwt() ->> 'email'::text))) with check ((host_email = (auth.jwt() ->> 'email'::text)));
create policy host_view_own_applications on public.property_applications as PERMISSIVE for SELECT to public using ((host_email = (auth.jwt() ->> 'email'::text)));
create policy service_role_all_applications on public.property_applications as PERMISSIVE for ALL to service_role using (true);
create policy anon_insert_applications on public.property_applications as PERMISSIVE for INSERT to anon with check (true);
CREATE INDEX idx_bookings_payment_transaction_id ON public.bookings USING btree (payment_transaction_id);
CREATE INDEX idx_bookings_customer_id ON public.bookings USING btree (customer_id);
CREATE INDEX bookings_corporate_id_idx ON public.bookings USING btree (corporate_id);
alter table public.bookings enable row level security;
create policy bookings_read_owner_host_corporate on public.bookings as PERMISSIVE for SELECT to authenticated using ((((auth.jwt() ->> 'email'::text) = user_email) OR (customer_id = auth.uid()) OR (property_id IN ( SELECT (property_applications.id)::text AS id
   FROM property_applications
  WHERE (property_applications.host_email = (auth.jwt() ->> 'email'::text)))) OR (corporate_id IN ( SELECT corporate_applications.id
   FROM corporate_applications
  WHERE (corporate_applications.user_id = auth.uid())))));
alter table public.blocked_dates enable row level security;
create policy hosts_delete_own_blocked_dates on public.blocked_dates as PERMISSIVE for DELETE to public using ((host_email = (auth.jwt() ->> 'email'::text)));
create policy hosts_insert_blocked_dates on public.blocked_dates as PERMISSIVE for INSERT to public with check ((host_email = (auth.jwt() ->> 'email'::text)));
create policy public_read_blocked_dates on public.blocked_dates as PERMISSIVE for SELECT to public using (true);
CREATE INDEX ical_blocked_dates_property_id_idx ON public.ical_blocked_dates USING btree (property_id);
CREATE INDEX ical_blocked_dates_host_email_idx ON public.ical_blocked_dates USING btree (host_email);
alter table public.ical_blocked_dates enable row level security;
create policy hosts_read_own_ical_blocks on public.ical_blocked_dates as PERMISSIVE for SELECT to public using (true);
create policy service_role_all_ical_blocks on public.ical_blocked_dates as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text));
alter table public.booking_status_logs enable row level security;
create policy "Allow anon select on booking_status_logs" on public.booking_status_logs as PERMISSIVE for SELECT to public using (true);
