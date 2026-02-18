-- CreateTable
CREATE TABLE "war_assignments" (
    "id" SERIAL NOT NULL,
    "attacker_nation_id" INTEGER NOT NULL,
    "defender_nation_id" INTEGER NOT NULL,
    "assignment_date" DATE NOT NULL,
    "note" TEXT,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "war_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "war_assignments_attacker_nation_id_idx" ON "war_assignments"("attacker_nation_id");

-- CreateIndex
CREATE INDEX "war_assignments_defender_nation_id_idx" ON "war_assignments"("defender_nation_id");

-- CreateIndex
CREATE INDEX "war_assignments_assignment_date_idx" ON "war_assignments"("assignment_date");

-- CreateIndex
CREATE INDEX "war_assignments_archived_at_idx" ON "war_assignments"("archived_at");

-- AddForeignKey
ALTER TABLE "war_assignments" ADD CONSTRAINT "war_assignments_attacker_nation_id_fkey" FOREIGN KEY ("attacker_nation_id") REFERENCES "nations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "war_assignments" ADD CONSTRAINT "war_assignments_defender_nation_id_fkey" FOREIGN KEY ("defender_nation_id") REFERENCES "nations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "war_assignments" ADD CONSTRAINT "war_assignments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

