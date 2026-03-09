-- Email attachments metadata (lazy-cached from Gmail API)
CREATE TABLE IF NOT EXISTS email_attachments (
  id                  SERIAL PRIMARY KEY,
  email_id            INT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  gmail_message_id    TEXT NOT NULL,
  gmail_attachment_id TEXT NOT NULL,
  filename            TEXT NOT NULL,
  mime_type           TEXT,
  size                INT,
  storage_path        TEXT,          -- NULL = not yet cached in storage
  cached_at           TIMESTAMPTZ,   -- set when file is downloaded & cached
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_email_id ON email_attachments(email_id);
CREATE UNIQUE INDEX idx_email_attachments_gmail ON email_attachments(gmail_message_id, gmail_attachment_id);
