CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  path TEXT,
  referrer TEXT,
  source TEXT NOT NULL DEFAULT 'direct',
  user_agent TEXT,
  country TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip);

CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);
