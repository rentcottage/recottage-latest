-- Corporate / travel-agency accounts.
-- One row per agency that signs up at /corporate.
-- Status flow: pending → approved | rejected (admin reviewed).
-- commission_pct is per-agency so admin can override the default 5% later.

CREATE TABLE IF NOT EXISTS corporate_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL,
  tax_id text NOT NULL,
  rep_first_name text NOT NULL,
  rep_last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'pending',
  commission_pct numeric NOT NULL DEFAULT 5.00,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  CONSTRAINT corporate_applications_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS corporate_applications_email_idx
  ON corporate_applications (lower(email));
CREATE INDEX IF NOT EXISTS corporate_applications_user_id_idx
  ON corporate_applications (user_id);
CREATE INDEX IF NOT EXISTS corporate_applications_status_idx
  ON corporate_applications (status);

ALTER TABLE corporate_applications ENABLE ROW LEVEL SECURITY;

-- The corporate user themselves can read their own row (used by /corporate/dashboard gate).
DROP POLICY IF EXISTS corporate_self_read ON corporate_applications;
CREATE POLICY corporate_self_read ON corporate_applications
  FOR SELECT
  USING (auth.uid() = user_id);
