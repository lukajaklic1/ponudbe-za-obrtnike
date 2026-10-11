-- Track who last saved overhead settings
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oh_updated_by uuid REFERENCES users(id) ON DELETE SET NULL;
