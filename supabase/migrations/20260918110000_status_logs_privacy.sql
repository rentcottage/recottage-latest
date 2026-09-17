-- booking_status_logs lockdown.
--
-- Before: a public SELECT (true) policy let anyone with the anon key read every
-- booking's status history, including notes with BOG order ids, emails and
-- phone numbers; anon and authenticated also held write/TRUNCATE privileges.
--
-- After: only the service role reads or writes (bog-payment and booking-handler
-- log through it; the admin dashboard reads through the password-gated
-- admin-read function). No authenticated SELECT policy: no non-admin reader
-- exists. Existing rows are untouched.
--
-- Apply AFTER admin-read is deployed and the admin dashboard uses it.
-- Safe to re-run.

alter table public.booking_status_logs enable row level security;

drop policy if exists "Allow anon select on booking_status_logs" on public.booking_status_logs;

revoke all on table public.booking_status_logs from anon;
revoke all on table public.booking_status_logs from authenticated;

grant select, insert, update, delete on table public.booking_status_logs to service_role;
