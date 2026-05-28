-- Add accepted_payment_methods to property_applications.
-- Values: 'online_only' | 'pay_at_property_only' | 'both'
-- Existing rows default to 'both' so no behavior change.

ALTER TABLE property_applications
  ADD COLUMN IF NOT EXISTS accepted_payment_methods text NOT NULL DEFAULT 'both';

ALTER TABLE property_applications
  ADD CONSTRAINT property_applications_payment_methods_check
  CHECK (accepted_payment_methods IN ('online_only', 'pay_at_property_only', 'both'));
