-- CreateTable
CREATE TABLE "user_role_assignments" (
    "user_id" INTEGER NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("user_id","role")
);

-- Migrate existing single role to assignments
INSERT INTO "user_role_assignments" ("user_id", "role")
SELECT "id", "role" FROM "users";

-- DropColumn
ALTER TABLE "users" DROP COLUMN "role";

-- CreateIndex
CREATE INDEX "user_role_assignments_user_id_idx" ON "user_role_assignments"("user_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_role_idx" ON "user_role_assignments"("role");

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
