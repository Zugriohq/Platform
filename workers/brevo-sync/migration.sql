CREATE TABLE IF NOT EXISTS brevo_contact_sync (
  waitlist_id INTEGER NOT NULL REFERENCES waitlist(id) ON DELETE CASCADE,
  list_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','synced','suppressed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT,
  last_error TEXT,
  PRIMARY KEY (waitlist_id, list_id)
);
