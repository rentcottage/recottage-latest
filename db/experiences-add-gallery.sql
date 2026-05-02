-- Run this once in the Supabase SQL editor.
-- Adds a gallery column to experiences so each card can have up to 9 additional
-- photos beyond the cover (image_url). Total cap is enforced in the admin UI.

alter table public.experiences
  add column if not exists gallery_urls text[] not null default '{}';
