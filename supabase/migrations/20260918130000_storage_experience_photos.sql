-- experience-photos storage lockdown.
--
-- Before:
--   policy `exp_photo_all` — FOR ALL TO public ON storage.objects with
--   bucket_id = 'experience-photos' in both USING and WITH CHECK. Anyone
--   holding the anon key (it ships in the bundle) could upload, overwrite or
--   delete every file in the bucket, including the live experience photos.
--
-- After:
--   public SELECT only. Admin uploads go through the password-gated
--   `create-experience-photo-upload-url` action in admin-host-actions, which
--   mints a short-lived signed upload URL with the service role; a signed
--   upload carries its own token and does not need an INSERT policy.
--
-- property-photos is deliberately left alone: the public become-host form
-- uploads there with the anon key before the application exists, and the
-- bucket has INSERT + SELECT policies only — there is no UPDATE or DELETE
-- policy, so anon can already neither overwrite nor delete an existing object
-- (upsert is refused for the same reason). See the report for the follow-up
-- proposal (per-application path prefixes).
--
-- Safe to re-run.

drop policy if exists exp_photo_all on storage.objects;

drop policy if exists experience_photos_public_read on storage.objects;
create policy experience_photos_public_read on storage.objects
  for select to public
  using (bucket_id = 'experience-photos');
