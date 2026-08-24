-- ───────────────────────────────────────────────────────────────────────────
-- One account per email, one account per phone number — from now on.
--
-- Supabase Auth already keeps auth.users.email unique, so duplicate *emails*
-- were never actually created. Nothing at all guarded the phone number, and
-- five numbers are currently shared by eleven accounts (test accounts, kept
-- deliberately).
--
-- Those existing rows must stay untouched, which rules out a UNIQUE INDEX:
-- Postgres validates one against every row already in the table, so creating
-- it would fail while the test accounts exist. A trigger only runs on write,
-- so the existing duplicates are grandfathered in and every NEW registration
-- (or phone change) is checked.
--
-- Used by: signUpWithEmail(), the `check-availability` action of the
-- admin-user-management Edge Function, and the phone-otp Edge Function.
--
-- Apply in the Supabase SQL editor (Dashboard → SQL). Safe to re-run.
-- ───────────────────────────────────────────────────────────────────────────

-- ── 1) Normalization ───────────────────────────────────────────────────────
-- One definition of "the same phone number", shared by the guard and by every
-- lookup, so they can never disagree. Georgian numbers are stored in several
-- shapes ("+995 555 …", "995555…", "555…"); the last 9 digits are the
-- subscriber number and identify the line regardless of how it was typed.
create or replace function public.phone_key(p text)
returns text
language sql
immutable
as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 9), '');
$$;

-- ── 2) The guard ───────────────────────────────────────────────────────────
-- Fires only when the phone or email actually CHANGES to a new value, so:
--   • the existing shared-number test accounts are never re-validated, and
--     stay editable in every other respect;
--   • re-saving the same number on the same account is always allowed;
--   • a new account, or an account moving onto a number/address someone else
--     already holds, is rejected.
--
-- The advisory lock closes the race where two simultaneous signups both look,
-- both see nothing, and both insert. It is transaction-scoped and keyed on the
-- value being claimed, so it only ever serialises writes for the same number.
create or replace function public.enforce_unique_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_phone text := public.phone_key(new.phone);
  old_phone text := case when tg_op = 'UPDATE' then public.phone_key(old.phone) else null end;
  new_email text := nullif(lower(btrim(coalesce(new.email, ''))), '');
  old_email text := case when tg_op = 'UPDATE' then nullif(lower(btrim(coalesce(old.email, ''))), '') else null end;
begin
  if new_phone is not null and new_phone is distinct from old_phone then
    perform pg_advisory_xact_lock(hashtext('profiles_phone:' || new_phone));
    if exists (
      select 1 from public.profiles
      where id <> new.id and public.phone_key(phone) = new_phone
    ) then
      raise exception 'This phone number is already registered to another account.'
        using errcode = '23505';
    end if;
  end if;

  if new_email is not null and new_email is distinct from old_email then
    perform pg_advisory_xact_lock(hashtext('profiles_email:' || new_email));
    if exists (
      select 1 from public.profiles
      where id <> new.id and nullif(lower(btrim(coalesce(email, ''))), '') = new_email
    ) then
      raise exception 'This email address is already registered to another account.'
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_unique_contact on public.profiles;
create trigger profiles_unique_contact
  before insert or update of phone, email on public.profiles
  for each row execute function public.enforce_unique_contact();

-- Makes the lookups above index-assisted instead of a sequential scan.
-- NOT unique — these coexist with the grandfathered duplicates.
create index if not exists profiles_phone_key_idx
  on public.profiles (public.phone_key(phone))
  where public.phone_key(phone) is not null;

create index if not exists profiles_email_lower_idx
  on public.profiles (lower(btrim(email)))
  where coalesce(btrim(email), '') <> '';

-- ── 3) Availability lookup for the signup flow ─────────────────────────────
-- SECURITY DEFINER so it can answer without handing the caller read access to
-- profiles. Execute is granted to service_role only: the check is reachable
-- through the Edge Functions, never straight from a browser with the anon key.
-- `exclude_user` lets an existing user re-save their own phone in the profile
-- editor without colliding with themselves.
create or replace function public.phone_in_use(p text, exclude_user uuid default null)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where public.phone_key(phone) is not null
      and public.phone_key(phone) = public.phone_key(p)
      and (exclude_user is null or id <> exclude_user)
  );
$$;

revoke execute on function public.phone_in_use(text, uuid) from public, anon, authenticated;
grant  execute on function public.phone_in_use(text, uuid) to service_role;

-- ── 4) The grandfathered rows, for reference ───────────────────────────────
-- Read-only. These are the numbers that predate the guard and are allowed to
-- stay shared. Nothing here needs to run.
--
--   select public.phone_key(phone) as phone, count(*) as accounts
--   from public.profiles
--   where public.phone_key(phone) is not null
--   group by 1 having count(*) > 1
--   order by 2 desc;
