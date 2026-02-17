-- AlterTable
-- Make ruler_name nullable since it will be manually set, not from OAuth
ALTER TABLE "users" ALTER COLUMN "ruler_name" DROP NOT NULL;

