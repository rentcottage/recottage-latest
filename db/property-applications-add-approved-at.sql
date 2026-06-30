-- Add approved_at to property_applications so approvals are timestamped.
-- Stamped by the admin-host-actions Edge Function on the first
-- pending -> approved transition (preserved across any later re-approve).
-- Existing already-approved rows stay NULL — their approval time was never recorded.

ALTER TABLE property_applications
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
