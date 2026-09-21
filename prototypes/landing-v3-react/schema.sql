CREATE TABLE IF NOT EXISTS waitlist_signups (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  market TEXT NOT NULL,
  horizon TEXT NOT NULL,
  mode TEXT NOT NULL,
  strategy TEXT NOT NULL,
  platform TEXT NOT NULL,
  consent INTEGER NOT NULL CHECK (consent = 1),
  consent_at TEXT NOT NULL,
  source TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at
  ON waitlist_signups(created_at);

CREATE INDEX IF NOT EXISTS idx_waitlist_market
  ON waitlist_signups(market);

CREATE INDEX IF NOT EXISTS idx_waitlist_role
  ON waitlist_signups(role);

-- Retention operation to run on a schedule or manually:
-- DELETE FROM waitlist_signups WHERE expires_at < datetime('now');
