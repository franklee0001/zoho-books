-- Pre-computed contact_email for fast conversation grouping
ALTER TABLE emails ADD COLUMN IF NOT EXISTS contact_email TEXT;
CREATE INDEX IF NOT EXISTS idx_emails_contact_email ON emails(contact_email);

-- Backfill: inbound = from_email, outbound = first recipient
UPDATE emails SET contact_email = LOWER(
  CASE WHEN is_inbound THEN from_email
       ELSE TRIM(SPLIT_PART(to_emails, ',', 1))
  END
) WHERE contact_email IS NULL;
