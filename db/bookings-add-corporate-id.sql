-- Tag a booking with the agency it was made on behalf of, when applicable.
-- NULL for direct (non-agency) bookings; existing rows stay NULL.
-- 5% (or per-agency commission_pct) of total_price flows to the agency.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS corporate_id uuid
    REFERENCES corporate_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_corporate_id_idx
  ON bookings (corporate_id);

-- Lets the agency read all bookings stamped with their corporate_id
-- (dashboard joins on this for booking history + commission totals).
DROP POLICY IF EXISTS bookings_corporate_read ON bookings;
CREATE POLICY bookings_corporate_read ON bookings
  FOR SELECT
  USING (
    corporate_id IN (
      SELECT id FROM corporate_applications
      WHERE user_id = auth.uid() AND status = 'approved'
    )
  );
