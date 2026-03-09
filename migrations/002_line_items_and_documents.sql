-- invoice_line_items: Zoho 상세 API에서 가져온 품목
CREATE TABLE IF NOT EXISTS invoice_line_items (
    line_item_id   TEXT PRIMARY KEY,
    invoice_id     TEXT NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    name           TEXT,
    description    TEXT,
    sku            TEXT,
    rate           NUMERIC(20,4),
    quantity       NUMERIC(20,4),
    discount       NUMERIC(20,4),
    tax_percentage NUMERIC(10,4),
    item_total     NUMERIC(20,4),
    item_id        TEXT,
    unit           TEXT,
    hsn_or_sac     TEXT,
    raw_json       JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice_id ON invoice_line_items(invoice_id);

-- invoice_packing_info: 품목별 수동 입력 물리 정보
CREATE TABLE IF NOT EXISTS invoice_packing_info (
    id             SERIAL PRIMARY KEY,
    invoice_id     TEXT NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    line_item_id   TEXT NOT NULL REFERENCES invoice_line_items(line_item_id) ON DELETE CASCADE,
    packing_no     INTEGER,
    length_mm      NUMERIC(10,2),
    width_mm       NUMERIC(10,2),
    height_mm      NUMERIC(10,2),
    package_type   TEXT DEFAULT 'BOX',
    net_weight_kg  NUMERIC(10,3),
    gross_weight_kg NUMERIC(10,3),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (invoice_id, line_item_id)
);

-- business_settings: 셀러 정보, DHL 계정, Incoterms 등 (싱글톤)
CREATE TABLE IF NOT EXISTS business_settings (
    key            TEXT PRIMARY KEY DEFAULT 'default',
    company_name   TEXT,
    address        TEXT,
    city           TEXT,
    state          TEXT,
    zipcode        TEXT,
    country        TEXT,
    phone          TEXT,
    email          TEXT,
    dhl_account    TEXT,
    incoterms      TEXT DEFAULT 'EXW',
    origin_country TEXT DEFAULT 'REPUBLIC OF KOREA',
    packing_type   TEXT DEFAULT 'CARTON BOX',
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본 설정 행 삽입
INSERT INTO business_settings (key) VALUES ('default') ON CONFLICT DO NOTHING;

-- generated_documents: 생성된 PDF 추적
CREATE TABLE IF NOT EXISTS generated_documents (
    id             SERIAL PRIMARY KEY,
    invoice_id     TEXT NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    doc_type       TEXT NOT NULL CHECK (doc_type IN ('packing_list', 'commercial_invoice')),
    file_name      TEXT NOT NULL,
    storage_path   TEXT NOT NULL,
    file_size      INTEGER,
    generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (invoice_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_generated_docs_invoice_id ON generated_documents(invoice_id);
