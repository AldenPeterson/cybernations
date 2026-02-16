-- CreateTable
CREATE TABLE "casualty_ranking_snapshots" (
    "id" SERIAL NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "nation_id" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "total_casualties" INTEGER NOT NULL,
    "attacking_casualties" INTEGER NOT NULL,
    "defensive_casualties" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casualty_ranking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "casualty_ranking_snapshots_snapshot_date_idx" ON "casualty_ranking_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "casualty_ranking_snapshots_nation_id_idx" ON "casualty_ranking_snapshots"("nation_id");

-- CreateIndex
CREATE INDEX "casualty_ranking_snapshots_snapshot_date_rank_idx" ON "casualty_ranking_snapshots"("snapshot_date", "rank");

-- AddForeignKey
ALTER TABLE "casualty_ranking_snapshots" ADD CONSTRAINT "casualty_ranking_snapshots_nation_id_fkey" FOREIGN KEY ("nation_id") REFERENCES "nations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

