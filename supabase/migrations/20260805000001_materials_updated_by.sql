-- Add updated_by to materials table (mirrors machines & labor_rates pattern)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;
