-- Supabase-like roles and auth helpers for local testing only.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
create schema if not exists extensions;
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
-- Mirror production default privileges (postgres-owned objects in public).
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
-- Stub for a table referenced only inside a bookings RLS policy.
create table if not exists public.corporate_applications (id uuid primary key default gen_random_uuid(), user_id uuid, status text, agency_name text);
