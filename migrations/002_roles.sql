-- Create a minimal ingest role (password must be set manually).
-- Option A (recommended): create/update the role in Supabase dashboard.
-- Option B (psql): replace the placeholder password below.
-- WARNING: never commit real passwords.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoho_ingest') THEN
        CREATE ROLE zoho_ingest LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO zoho_ingest;

GRANT SELECT, INSERT, UPDATE ON TABLE invoice_raw TO zoho_ingest;
GRANT SELECT, INSERT, UPDATE ON TABLE invoices TO zoho_ingest;
GRANT SELECT, INSERT, UPDATE ON TABLE invoice_addresses TO zoho_ingest;
GRANT SELECT, INSERT, UPDATE ON TABLE customers TO zoho_ingest;

GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO zoho_ingest;
