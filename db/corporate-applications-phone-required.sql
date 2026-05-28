-- Phone is now a required field on the agency registration form.

ALTER TABLE corporate_applications
  ALTER COLUMN phone SET NOT NULL;

ALTER TABLE corporate_applications
  ADD CONSTRAINT corporate_applications_phone_not_blank
  CHECK (length(trim(phone)) > 0);
