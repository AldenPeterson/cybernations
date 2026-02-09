-- Migration to optimize war statistics queries
-- Add indexes and computed columns for better performance

-- Note: Skipping functional index on parsed date due to PostgreSQL IMMUTABLE constraint
-- The date field will still benefit from standard indexes on alliance_id columns

-- 1. Add computed columns for damage calculations
-- These avoid repeated string parsing and calculations in queries
ALTER TABLE "wars" ADD COLUMN IF NOT EXISTS "declaring_damage_dealt" NUMERIC GENERATED ALWAYS AS (
    CASE 
        WHEN destruction IS NULL OR destruction = '' THEN 0
        WHEN defend_percent IS NULL OR defend_percent = 0 THEN 0
        ELSE CAST(REPLACE(destruction, ',', '') AS NUMERIC) * (COALESCE(defend_percent, 0) / 100.0)
    END
) STORED;

ALTER TABLE "wars" ADD COLUMN IF NOT EXISTS "declaring_damage_received" NUMERIC GENERATED ALWAYS AS (
    CASE 
        WHEN destruction IS NULL OR destruction = '' THEN 0
        WHEN attack_percent IS NULL OR attack_percent = 0 THEN 0
        ELSE CAST(REPLACE(destruction, ',', '') AS NUMERIC) * (COALESCE(attack_percent, 0) / 100.0)
    END
) STORED;

ALTER TABLE "wars" ADD COLUMN IF NOT EXISTS "receiving_damage_dealt" NUMERIC GENERATED ALWAYS AS (
    CASE 
        WHEN destruction IS NULL OR destruction = '' THEN 0
        WHEN attack_percent IS NULL OR attack_percent = 0 THEN 0
        ELSE CAST(REPLACE(destruction, ',', '') AS NUMERIC) * (COALESCE(attack_percent, 0) / 100.0)
    END
) STORED;

ALTER TABLE "wars" ADD COLUMN IF NOT EXISTS "receiving_damage_received" NUMERIC GENERATED ALWAYS AS (
    CASE 
        WHEN destruction IS NULL OR destruction = '' THEN 0
        WHEN defend_percent IS NULL OR defend_percent = 0 THEN 0
        ELSE CAST(REPLACE(destruction, ',', '') AS NUMERIC) * (COALESCE(defend_percent, 0) / 100.0)
    END
) STORED;

-- 2. Add indexes on computed damage columns for sorting and aggregation
CREATE INDEX IF NOT EXISTS "wars_declaring_damage_dealt_idx" ON "wars" ("declaring_damage_dealt");
CREATE INDEX IF NOT EXISTS "wars_receiving_damage_dealt_idx" ON "wars" ("receiving_damage_dealt");

-- 3. Create composite indexes for nation-level queries (these help with joins)
CREATE INDEX IF NOT EXISTS "wars_declaring_nation_alliance_idx" 
ON "wars" ("declaring_nation_id", "declaring_alliance_id");

CREATE INDEX IF NOT EXISTS "wars_receiving_nation_alliance_idx" 
ON "wars" ("receiving_nation_id", "receiving_alliance_id");

-- 4. Add partial index on destruction for filtering wars with damage
CREATE INDEX IF NOT EXISTS "wars_destruction_idx" 
ON "wars" (destruction) WHERE destruction IS NOT NULL AND destruction != '';

-- Note: Date-based filtering will still use sequential scans or alliance indexes
-- For better date performance, consider adding a proper DATE column in a future migration

