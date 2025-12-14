-- Add isActive and lastSeenAt fields to nations table
ALTER TABLE "nations" ADD COLUMN "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "nations" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "nations" ADD COLUMN "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS "nations_is_active_idx" ON "nations"("is_active");
CREATE INDEX IF NOT EXISTS "nations_last_seen_at_idx" ON "nations"("last_seen_at");
