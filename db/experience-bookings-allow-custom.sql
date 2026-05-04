-- Run this once in the Supabase SQL editor.
--
-- The experience_bookings table was originally created when experiences were
-- hardcoded ('wine_tasting' | 'cooking_class') and a CHECK constraint enforced
-- exactly those two values. Now experiences live in the experiences table
-- with arbitrary UUID ids, so we need to:
--   1. Drop the CHECK constraint so any value can land in experience_type.
--   2. Add an experience_id column that links to experiences(id) for the
--      new-style DB-backed experiences. Legacy bookings keep experience_id NULL
--      and identify themselves via experience_type ('wine_tasting' | 'cooking_class').

-- 1. Drop the legacy CHECK constraint (name pattern Supabase auto-generates;
--    if your project named it differently, adjust the constraint name).
do $$
declare
  c text;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.experience_bookings'::regclass
      and contype = 'c'
  loop
    execute format('alter table public.experience_bookings drop constraint %I', c);
  end loop;
end$$;

-- 2. Add the experience_id column for DB-backed experiences.
alter table public.experience_bookings
  add column if not exists experience_id uuid references public.experiences(id) on delete set null;

create index if not exists experience_bookings_experience_id_idx
  on public.experience_bookings (experience_id);
