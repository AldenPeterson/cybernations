-- AlterTable
ALTER TABLE "warchest_submissions" ADD COLUMN "army_xp" INTEGER,
ADD COLUMN "navy_xp" INTEGER,
ADD COLUMN "air_force_xp" INTEGER,
ADD COLUMN "intelligence_xp" INTEGER,
ADD COLUMN "has_assigned_generals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "assigned_generals" TEXT;

