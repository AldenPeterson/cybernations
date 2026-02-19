-- Add targeting alliance override column to nations table
ALTER TABLE "nations" ADD COLUMN "targeting_alliance_id" INTEGER;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS "nations_targeting_alliance_id_idx" ON "nations"("targeting_alliance_id");

