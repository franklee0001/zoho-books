CREATE TABLE IF NOT EXISTS invoice_raw (
    source_file TEXT NOT NULL,
    line_no INTEGER NOT NULL,
    invoice_id TEXT,
    raw_json JSONB NOT NULL,
    created_time TIMESTAMPTZ,
    updated_time TIMESTAMPTZ,
    last_modified_time TIMESTAMPTZ,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_file, line_no)
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id TEXT PRIMARY KEY,
    customer_name TEXT,
    company_name TEXT,
    email TEXT,
    phone TEXT,
    country TEXT,
    raw_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id TEXT PRIMARY KEY,
    invoice_number TEXT,
    customer_id TEXT REFERENCES customers(customer_id),
    status TEXT,
    current_sub_status TEXT,
    date DATE,
    due_date DATE,
    currency_code TEXT,
    total NUMERIC(20,4),
    balance NUMERIC(20,4),
    invoice_url TEXT,
    salesperson_id TEXT,
    salesperson_name TEXT,
    created_time TIMESTAMPTZ,
    updated_time TIMESTAMPTZ,
    last_modified_time TIMESTAMPTZ,
    raw_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_addresses (
    invoice_id TEXT REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('billing', 'shipping')),
    attention TEXT,
    address TEXT,
    street2 TEXT,
    city TEXT,
    state TEXT,
    zipcode TEXT,
    country TEXT,
    phone TEXT,
    raw_json JSONB NOT NULL,
    PRIMARY KEY (invoice_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_invoice_raw_invoice_id ON invoice_raw(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_raw_updated_time ON invoice_raw(updated_time);
CREATE INDEX IF NOT EXISTS idx_invoice_raw_last_modified_time ON invoice_raw(last_modified_time);
CREATE INDEX IF NOT EXISTS idx_invoice_raw_invoice_time ON invoice_raw(
    invoice_id,
    last_modified_time DESC,
    updated_time DESC,
    created_time DESC
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
