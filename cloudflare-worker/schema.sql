DROP TABLE IF EXISTS tasks;
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  client_task_id TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT DEFAULT '',
  ratio TEXT DEFAULT 'Auto',
  quality TEXT DEFAULT 'Auto',
  n INTEGER DEFAULT 1,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 4,
  input_json TEXT DEFAULT '{}',
  result_json TEXT DEFAULT '[]',
  error TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT DEFAULT '',
  finished_at TEXT DEFAULT '',
  request_hash TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_updated ON tasks(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_hash ON tasks(request_hash);
