-- social-videos: the bucket the automated Instagram Reels land in.
--
-- WHAT WRITES HERE
--   Nothing that holds a Supabase key. The renderer is a GitHub Actions job in
--   a separate private repo; it receives a single-use SIGNED UPLOAD URL as a
--   workflow input and PUTs the MP4 to it. The signed URL is minted inside the
--   `reel-upload-url` action of the n8n-data function, with the service role,
--   for a path the function chooses itself. GitHub therefore holds no Supabase
--   credential at all, and n8n holds only the x-n8n-secret it already had.
--
-- WHY THERE IS NO INSERT POLICY
--   A signed upload carries its own token and is authorised by that token, not
--   by RLS — exactly like experience-photos (20260918130000). So the bucket
--   gets public SELECT and nothing else: anon and authenticated cannot upload,
--   overwrite, delete or list, and the only way bytes get in is a URL this
--   codebase minted. Objects are deleted again by the `reel-cleanup` action,
--   which runs with the service role (bypassrls).
--
-- PUBLIC READ is required: Instagram fetches the video by URL when n8n
-- publishes it, unauthenticated. The objects are marketing videos built from
-- listing photos the public site already serves.
--
-- Limits are declared on the bucket itself so Storage rejects an oversized or
-- wrong-typed upload before it is written, even through a valid signed URL:
--   video/mp4 only, 50 MB (52428800 bytes).
--
-- Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-videos', 'social-videos', true, 52428800, array['video/mp4'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read, and only public read.
drop policy if exists social_videos_public_read on storage.objects;
create policy social_videos_public_read on storage.objects
  for select to public
  using (bucket_id = 'social-videos');

-- Defensive: if an earlier hand-made policy ever granted writes on this
-- bucket, drop it. (Named policies only — nothing else on storage.objects is
-- touched, so property-photos and experience-photos keep their own rules.)
drop policy if exists social_videos_all on storage.objects;
drop policy if exists social_videos_insert on storage.objects;
drop policy if exists social_videos_update on storage.objects;
drop policy if exists social_videos_delete on storage.objects;
