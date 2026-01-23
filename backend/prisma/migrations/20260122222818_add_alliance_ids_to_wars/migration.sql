-- Add alliance ID columns to wars table
ALTER TABLE "wars" ADD COLUMN "declaring_alliance_id" INTEGER;
ALTER TABLE "wars" ADD COLUMN "receiving_alliance_id" INTEGER;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS "wars_declaring_alliance_id_idx" ON "wars"("declaring_alliance_id");
CREATE INDEX IF NOT EXISTS "wars_receiving_alliance_id_idx" ON "wars"("receiving_alliance_id");

-- Backfill existing data from nations table
UPDATE "wars" w
SET 
  "declaring_alliance_id" = n1."alliance_id",
  "receiving_alliance_id" = n2."alliance_id"
FROM "nations" n1, "nations" n2
WHERE 
  w."declaring_nation_id" = n1."id"
  AND w."receiving_nation_id" = n2."id";

