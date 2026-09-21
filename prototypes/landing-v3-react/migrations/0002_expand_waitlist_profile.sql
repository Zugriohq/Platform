-- Expand the existing Zugrio waitlist table without dropping prior signups.
-- Existing lineage before this migration:
-- id, email, role, market, style, mode, strategy, consent, source, created_at, updated_at

ALTER TABLE waitlist ADD COLUMN platform TEXT NOT NULL DEFAULT '';
ALTER TABLE waitlist ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE waitlist ADD COLUMN discovery TEXT NOT NULL DEFAULT '';
ALTER TABLE waitlist ADD COLUMN consent_version TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE waitlist ADD COLUMN consent_at TEXT;
ALTER TABLE waitlist ADD COLUMN referrer TEXT NOT NULL DEFAULT '';
ALTER TABLE waitlist ADD COLUMN utm_source TEXT NOT NULL DEFAULT '';
ALTER TABLE waitlist ADD COLUMN utm_medium TEXT NOT NULL DEFAULT '';
ALTER TABLE waitlist ADD COLUMN utm_campaign TEXT NOT NULL DEFAULT '';
ALTER TABLE waitlist ADD COLUMN expires_at TEXT;

UPDATE waitlist
SET consent_at = COALESCE(consent_at, created_at),
    expires_at = COALESCE(
      expires_at,
      strftime('%Y-%m-%dT%H:%M:%fZ', datetime(created_at, '+12 months'))
    )
WHERE consent_at IS NULL OR expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_market ON waitlist(market);
CREATE INDEX IF NOT EXISTS idx_waitlist_role ON waitlist(role);
CREATE INDEX IF NOT EXISTS idx_waitlist_country ON waitlist(country);
