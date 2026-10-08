CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  visitor_id TEXT,
  path TEXT,
  referrer TEXT,
  source TEXT NOT NULL DEFAULT 'direct',
  user_agent TEXT,
  country TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip);

CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);

CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  visitor_id TEXT,
  source TEXT NOT NULL DEFAULT 'direct',
  path TEXT,
  href TEXT,
  label TEXT,
  user_agent TEXT,
  country TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clicks_ip ON clicks(ip);

CREATE INDEX IF NOT EXISTS idx_clicks_created ON clicks(created_at);

-- Existing databases: worker.js adds visits.visitor_id and the clicks table
-- automatically on first run, so nothing needs to be re-run by hand.
