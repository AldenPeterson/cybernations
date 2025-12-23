-- Add alliance ID columns to aid_offers table
ALTER TABLE "aid_offers" ADD COLUMN "declaring_alliance_id" INTEGER;
ALTER TABLE "aid_offers" ADD COLUMN "receiving_alliance_id" INTEGER;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS "aid_offers_declaring_alliance_id_idx" ON "aid_offers"("declaring_alliance_id");
CREATE INDEX IF NOT EXISTS "aid_offers_receiving_alliance_id_idx" ON "aid_offers"("receiving_alliance_id");

-- Backfill existing data from nations table
UPDATE "aid_offers" ao
SET 
  "declaring_alliance_id" = n1."alliance_id",
  "receiving_alliance_id" = n2."alliance_id"
FROM "nations" n1, "nations" n2
WHERE 
  ao."declaring_nation_id" = n1."id"
  AND ao."receiving_nation_id" = n2."id";

