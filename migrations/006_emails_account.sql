-- Add account_email to track which Gmail account fetched this email
ALTER TABLE emails ADD COLUMN IF NOT EXISTS account_email TEXT;
CREATE INDEX IF NOT EXISTS idx_emails_account_email ON emails(account_email);
