ALTER TABLE tasks ADD COLUMN device_hash TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_tasks_device_hash ON tasks(device_hash);
