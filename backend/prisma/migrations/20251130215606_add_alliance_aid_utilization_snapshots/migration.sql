-- CreateTable
CREATE TABLE "alliance_aid_utilization_snapshots" (
    "alliance_id" BIGINT NOT NULL,
    "alliance_name" TEXT NOT NULL,
    "total_aid_offers" INTEGER NOT NULL DEFAULT 0,
    "total_nations" INTEGER NOT NULL DEFAULT 0,
    "aid_utilization_percent" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "snapshot_date" DATE NOT NULL,

    CONSTRAINT "alliance_aid_utilization_snapshots_pkey" PRIMARY KEY ("alliance_id", "snapshot_date")
);

