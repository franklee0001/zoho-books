-- 009_production_overhaul.sql
-- Production management overhaul: 5-stage workflow + ProductionUnit tracking

BEGIN;

-- 0. Drop old CHECK constraint on status (allows new status values)
ALTER TABLE production_orders DROP CONSTRAINT IF EXISTS production_orders_status_check;

-- 1. Add new columns to production_orders
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS shipping_deadline DATE,
  ADD COLUMN IF NOT EXISTS production_start_date DATE,
  ADD COLUMN IF NOT EXISTS production_end_date DATE,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS shipping_method TEXT;

-- 2. Copy target_date → shipping_deadline for existing data
UPDATE production_orders
  SET shipping_deadline = target_date
  WHERE target_date IS NOT NULL AND shipping_deadline IS NULL;

-- 3. Migrate status values: old 4-stage → new 5-stage
UPDATE production_orders SET status = 'confirmed' WHERE status = 'pending';
UPDATE production_orders SET status = 'producing' WHERE status = 'in_progress';
UPDATE production_orders SET status = 'packing'   WHERE status = 'completed';
-- 'shipped' stays as 'shipped'

-- 4. Migrate production_status_log values
UPDATE production_status_log SET old_status = 'confirmed' WHERE old_status = 'pending';
UPDATE production_status_log SET old_status = 'producing' WHERE old_status = 'in_progress';
UPDATE production_status_log SET old_status = 'packing'   WHERE old_status = 'completed';

UPDATE production_status_log SET new_status = 'confirmed' WHERE new_status = 'pending';
UPDATE production_status_log SET new_status = 'producing' WHERE new_status = 'in_progress';
UPDATE production_status_log SET new_status = 'packing'   WHERE new_status = 'completed';

-- 5. Add new CHECK constraint for 5-stage workflow
ALTER TABLE production_orders ADD CONSTRAINT production_orders_status_check
  CHECK (status IN ('confirmed', 'producing', 'checking', 'packing', 'shipped'));

-- 6. Create production_units table
CREATE TABLE IF NOT EXISTS production_units (
  id                  SERIAL PRIMARY KEY,
  production_order_id INTEGER NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  line_item_id        TEXT    NOT NULL REFERENCES invoice_line_items(line_item_id) ON DELETE CASCADE,
  category_slug       TEXT    NOT NULL,
  unit_index          INTEGER NOT NULL,
  serial_number       TEXT,
  model_version       TEXT,
  is_completed        BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_units_order_id ON production_units(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_units_category ON production_units(category_slug);

COMMIT;
