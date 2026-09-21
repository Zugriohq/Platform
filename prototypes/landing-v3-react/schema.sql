CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL,
  market TEXT NOT NULL,
  style TEXT NOT NULL,
  mode TEXT NOT NULL,
  strategy TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  discovery TEXT NOT NULL DEFAULT '',
  consent INTEGER NOT NULL DEFAULT 1 CHECK (consent = 1),
  consent_version TEXT NOT NULL DEFAULT 'waitlist-v1',
  consent_at TEXT,
  source TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_nocase
  ON waitlist(email COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at
  ON waitlist(created_at);

CREATE INDEX IF NOT EXISTS idx_waitlist_market
  ON waitlist(market);

CREATE INDEX IF NOT EXISTS idx_waitlist_role
  ON waitlist(role);

CREATE INDEX IF NOT EXISTS idx_waitlist_country
  ON waitlist(country);

-- 12-month retention cleanup:
-- DELETE FROM waitlist
-- WHERE expires_at IS NOT NULL
--   AND expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now');
