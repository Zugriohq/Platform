-- Brevo email lifecycle state for Zugrio early access.
-- D1 remains the source of truth. Brevo is a delivery/marketing provider only.

ALTER TABLE waitlist ADD COLUMN brevo_synced_at TEXT;
ALTER TABLE waitlist ADD COLUMN welcome_sent_at TEXT;
ALTER TABLE waitlist ADD COLUMN email_sequence_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE waitlist ADD COLUMN email_next_at TEXT;
ALTER TABLE waitlist ADD COLUMN email_last_error TEXT;
ALTER TABLE waitlist ADD COLUMN email_unsubscribed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_waitlist_email_next_at
  ON waitlist(email_next_at);

CREATE TABLE IF NOT EXISTS email_send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waitlist_id INTEGER NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  template_key TEXT NOT NULL,
  provider_message_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  error TEXT NOT NULL DEFAULT '',
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(waitlist_id) REFERENCES waitlist(id)
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_waitlist_id
  ON email_send_log(waitlist_id);

CREATE INDEX IF NOT EXISTS idx_email_send_log_sent_at
  ON email_send_log(sent_at);
