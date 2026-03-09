-- 003_customer_payments.sql
-- Customer payments ETL: raw → normalized tables

-- 1. Raw JSONL storage
CREATE TABLE IF NOT EXISTS payment_raw (
    source_file TEXT NOT NULL,
    line_no     INTEGER NOT NULL,
    payment_id  TEXT,
    raw_json    JSONB NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_file, line_no)
);

CREATE INDEX IF NOT EXISTS idx_payment_raw_payment_id ON payment_raw(payment_id);

-- 2. Normalized customer payments
CREATE TABLE IF NOT EXISTS customer_payments (
    payment_id    TEXT PRIMARY KEY,
    customer_id   TEXT REFERENCES customers(customer_id),
    customer_name TEXT,
    payment_number TEXT,
    date          DATE,
    amount        NUMERIC(20, 4),
    unused_amount NUMERIC(20, 4),
    payment_mode  TEXT,
    description   TEXT,
    reference_number TEXT,
    currency_code TEXT,
    account_id    TEXT,
    account_name  TEXT,
    created_time  TIMESTAMPTZ,
    updated_time  TIMESTAMPTZ,
    last_modified_time TIMESTAMPTZ,
    raw_json      JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(date);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);

-- 3. Payment ↔ Invoice mapping
CREATE TABLE IF NOT EXISTS payment_invoices (
    payment_id     TEXT NOT NULL REFERENCES customer_payments(payment_id) ON DELETE CASCADE,
    invoice_id     TEXT NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    amount_applied NUMERIC(20, 4),
    tax_amount_withheld NUMERIC(20, 4),
    PRIMARY KEY (payment_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_invoices_invoice_id ON payment_invoices(invoice_id);

-- 4. Fix waybill doc_type constraint (from previous commit)
ALTER TABLE generated_documents DROP CONSTRAINT IF EXISTS generated_documents_doc_type_check;
ALTER TABLE generated_documents ADD CONSTRAINT generated_documents_doc_type_check
  CHECK (doc_type IN ('packing_list', 'commercial_invoice', 'waybill'));
