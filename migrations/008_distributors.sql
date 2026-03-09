CREATE TABLE distributors (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  product_scope TEXT DEFAULT 'all',
  products TEXT,
  stage TEXT DEFAULT 'lead',
  notes TEXT,
  customer_id TEXT REFERENCES customers(customer_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_distributors_country_code ON distributors(country_code);
CREATE INDEX idx_distributors_stage ON distributors(stage);
