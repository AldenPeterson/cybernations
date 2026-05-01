-- Make google_id nullable so users can authenticate via Discord without a Google identity
ALTER TABLE "users" ALTER COLUMN "google_id" DROP NOT NULL;

-- Add Discord identity columns
ALTER TABLE "users" ADD COLUMN "discord_id" TEXT;
ALTER TABLE "users" ADD COLUMN "discord_username" TEXT;

-- Ensure discord_id uniqueness (matches @unique in schema)
CREATE UNIQUE INDEX "users_discord_id_key" ON "users"("discord_id");
