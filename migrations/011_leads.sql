CREATE TABLE IF NOT EXISTS leads (
  id              SERIAL PRIMARY KEY,
  unique_key      TEXT UNIQUE NOT NULL,
  timestamp       TIMESTAMPTZ,
  date            TEXT,
  email           TEXT,
  name            TEXT,
  company         TEXT,
  country         TEXT,
  phone           TEXT,
  website         TEXT,
  source          TEXT,
  product_interest TEXT,
  quantity        TEXT,
  message         TEXT,
  subject         TEXT,
  reply_status    TEXT,
  deal_status     TEXT DEFAULT 'new',
  order_status    TEXT,
  amount          DECIMAL(15,2),
  notes           TEXT,
  distributor     TEXT,
  extra_data      JSONB DEFAULT '{}',
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country);
CREATE INDEX IF NOT EXISTS idx_leads_deal_status ON leads(deal_status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_synced_at ON leads(synced_at);
