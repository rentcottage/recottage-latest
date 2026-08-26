-- ───────────────────────────────────────────────────────────────────────────
-- Durable phone verification across the email-confirmation gap.
--
-- Before this, passing the SMS check at signup was remembered only in
-- localStorage (rc_pending_phone_verified). Confirming the email in another
-- browser or on a phone — or simply logging in instead of landing on
-- /auth/callback — lost the flag, so the profile asked the user to verify a
-- number they had already verified.
--
-- The proof now lives on the OTP row itself:
--   verify  → stamps verified_at and stores the hash of a one-time claim token
--   attach  → the freshly created (not yet confirmed) user binds the row to
--             their id by presenting that token
--   claim   → once signed in, the account redeems the binding server-side
--
-- Apply in the Supabase SQL editor (Dashboard → SQL) or via the Management API.
-- Idempotent — safe to re-run.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.phone_otps
  -- set only when a correct code was entered; `consumed` alone cannot say so,
  -- because it is also set when the attempt limit burns the code
  add column if not exists verified_at timestamptz,
  -- sha256(claim_token : pepper). The plaintext token is returned once, to
  -- whoever actually passed the SMS code, and is never stored.
  add column if not exists claim_hash  text,
  -- the account that presented the token, bound at signup
  add column if not exists claimed_by  uuid,
  -- set when the binding has been redeemed onto a profile; makes claims one-shot
  add column if not exists applied_at  timestamptz;

-- claim() looks the row up by owner; attach() looks it up by phone + token.
create index if not exists phone_otps_claimed_by_idx
  on public.phone_otps (claimed_by)
  where claimed_by is not null;

create index if not exists phone_otps_phone_verified_idx
  on public.phone_otps (phone, verified_at desc)
  where verified_at is not null;

-- RLS stays on with no policies: only the Edge Function's service role reads
-- this table, so the claim tokens are never exposed to the client.

-- Housekeeping: a claim stays redeemable for 7 days (CLAIM_WINDOW_SEC in the
-- Edge Function), so prune no sooner than that.
-- delete from public.phone_otps where created_at < now() - interval '8 days';
