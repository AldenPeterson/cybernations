-- Discord identity is keyed on discord_id; email is no longer required from the OAuth provider
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
