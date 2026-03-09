-- Production Orders: 인보이스 1:1 매핑, 생산 상태 관리
CREATE TABLE IF NOT EXISTS production_orders (
    id             SERIAL PRIMARY KEY,
    invoice_id     TEXT NOT NULL UNIQUE REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'in_progress', 'completed', 'shipped')),
    priority       INTEGER NOT NULL DEFAULT 0,
    notes          TEXT,
    target_date    DATE,
    completed_at   TIMESTAMPTZ,
    shipped_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_target_date ON production_orders(target_date);
CREATE INDEX IF NOT EXISTS idx_production_orders_invoice_id ON production_orders(invoice_id);

-- Production Status Log: 상태 변경 이력
CREATE TABLE IF NOT EXISTS production_status_log (
    id                  SERIAL PRIMARY KEY,
    production_order_id INTEGER NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    old_status          TEXT,
    new_status          TEXT NOT NULL,
    changed_by          TEXT NOT NULL DEFAULT 'system',
    note                TEXT,
    changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_status_log_order_id ON production_status_log(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_status_log_changed_at ON production_status_log(changed_at);
