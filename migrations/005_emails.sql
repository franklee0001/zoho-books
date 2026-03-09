-- Gmail OAuth tokens (single-user)
CREATE TABLE IF NOT EXISTS gmail_tokens (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    access_token    TEXT NOT NULL,
    refresh_token   TEXT NOT NULL,
    token_expiry    TIMESTAMPTZ,
    history_id      TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emails from Gmail
CREATE TABLE IF NOT EXISTS emails (
    id              SERIAL PRIMARY KEY,
    gmail_id        TEXT NOT NULL UNIQUE,
    thread_id       TEXT,
    from_email      TEXT,
    from_name       TEXT,
    to_emails       TEXT,
    cc_emails       TEXT,
    subject         TEXT,
    body_text       TEXT,
    body_html       TEXT,
    date            TIMESTAMPTZ,
    labels          TEXT[],
    is_inbound      BOOLEAN NOT NULL DEFAULT true,
    has_attachments BOOLEAN NOT NULL DEFAULT false,
    snippet         TEXT,
    customer_id     TEXT REFERENCES customers(customer_id),
    raw_json        JSONB,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_gmail_id ON emails(gmail_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_from_email ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_customer_id ON emails(customer_id);
CREATE INDEX IF NOT EXISTS idx_emails_is_inbound ON emails(is_inbound);
