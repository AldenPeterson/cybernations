-- AlterTable
ALTER TABLE "aid_offers" DROP COLUMN IF EXISTS "days_until_expiration",
DROP COLUMN IF EXISTS "expiration_date",
ADD COLUMN IF NOT EXISTS "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "wars" ADD COLUMN IF NOT EXISTS "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex (only if they don't exist)
CREATE INDEX IF NOT EXISTS "aid_offers_is_active_idx" ON "aid_offers"("is_active");
CREATE INDEX IF NOT EXISTS "aid_offers_last_seen_at_idx" ON "aid_offers"("last_seen_at");
CREATE INDEX IF NOT EXISTS "wars_is_active_idx" ON "wars"("is_active");
CREATE INDEX IF NOT EXISTS "wars_last_seen_at_idx" ON "wars"("last_seen_at");
