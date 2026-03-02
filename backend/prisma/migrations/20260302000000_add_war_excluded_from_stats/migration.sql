ALTER TABLE wars
ADD COLUMN IF NOT EXISTS excluded_from_stats BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_wars_excluded_from_stats
ON wars (excluded_from_stats);

