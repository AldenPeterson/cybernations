-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ALLIANCE_MANAGER', 'USER');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "google_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ruler_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_alliance_managers" (
    "user_id" INTEGER NOT NULL,
    "alliance_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_alliance_managers_pkey" PRIMARY KEY ("user_id","alliance_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_ruler_name_key" ON "users"("ruler_name");

-- CreateIndex
CREATE INDEX "user_alliance_managers_user_id_idx" ON "user_alliance_managers"("user_id");

-- CreateIndex
CREATE INDEX "user_alliance_managers_alliance_id_idx" ON "user_alliance_managers"("alliance_id");

-- AddForeignKey
ALTER TABLE "user_alliance_managers" ADD CONSTRAINT "user_alliance_managers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_alliance_managers" ADD CONSTRAINT "user_alliance_managers_alliance_id_fkey" FOREIGN KEY ("alliance_id") REFERENCES "alliances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

