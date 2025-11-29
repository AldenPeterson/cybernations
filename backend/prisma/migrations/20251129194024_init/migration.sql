-- CreateTable
CREATE TABLE "alliances" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alliances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nations" (
    "id" INTEGER NOT NULL,
    "ruler_name" TEXT NOT NULL,
    "nation_name" TEXT NOT NULL,
    "alliance_id" INTEGER NOT NULL,
    "team" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "activity" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "infrastructure" TEXT NOT NULL,
    "land" TEXT NOT NULL,
    "nuclear_weapons" INTEGER NOT NULL DEFAULT 0,
    "government_type" TEXT NOT NULL,
    "in_war_mode" BOOLEAN NOT NULL DEFAULT false,
    "attacking_casualties" INTEGER,
    "defensive_casualties" INTEGER,
    "warchest" DOUBLE PRECISION,
    "spyglass_last_updated" INTEGER,
    "rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nation_configs" (
    "id" SERIAL NOT NULL,
    "nation_id" INTEGER NOT NULL,
    "alliance_id" INTEGER NOT NULL,
    "has_dra" BOOLEAN NOT NULL DEFAULT false,
    "discord_handle" TEXT,
    "notes" TEXT,
    "send_tech_slots" INTEGER NOT NULL DEFAULT 0,
    "send_cash_slots" INTEGER NOT NULL DEFAULT 0,
    "get_tech_slots" INTEGER NOT NULL DEFAULT 0,
    "get_cash_slots" INTEGER NOT NULL DEFAULT 0,
    "external_slots" INTEGER NOT NULL DEFAULT 0,
    "send_priority" INTEGER NOT NULL DEFAULT 3,
    "receive_priority" INTEGER NOT NULL DEFAULT 3,
    "current_tech" TEXT,
    "current_infra" TEXT,
    "current_strength" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nation_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aid_offers" (
    "aid_id" INTEGER NOT NULL,
    "declaring_nation_id" INTEGER NOT NULL,
    "receiving_nation_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "money" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "technology" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldiers" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiration_date" TEXT,
    "days_until_expiration" INTEGER,
    "is_expired" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aid_offers_pkey" PRIMARY KEY ("aid_id")
);

-- CreateTable
CREATE TABLE "wars" (
    "war_id" INTEGER NOT NULL,
    "declaring_nation_id" INTEGER NOT NULL,
    "receiving_nation_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "reason" TEXT,
    "destruction" TEXT,
    "attack_percent" DOUBLE PRECISION,
    "defend_percent" DOUBLE PRECISION,
    "formatted_end_date" TEXT,
    "days_until_expiration" INTEGER,
    "expiration_color" TEXT,
    "is_expired" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wars_pkey" PRIMARY KEY ("war_id")
);

-- CreateTable
CREATE TABLE "dynamic_wars" (
    "id" SERIAL NOT NULL,
    "war_id" INTEGER NOT NULL,
    "declaring_nation_id" INTEGER NOT NULL,
    "receiving_nation_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "reason" TEXT,
    "destruction" TEXT,
    "attack_percent" DOUBLE PRECISION,
    "defend_percent" DOUBLE PRECISION,
    "added_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dynamic_wars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nuclear_hits" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "attacking_nation" TEXT NOT NULL,
    "defending_nation" TEXT NOT NULL,
    "result" TEXT,
    "sent_at" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nuclear_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_alliance_aid" (
    "id" SERIAL NOT NULL,
    "source_alliance_id" INTEGER NOT NULL,
    "target_alliance_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cross_alliance_aid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nations_alliance_id_idx" ON "nations"("alliance_id");

-- CreateIndex
CREATE INDEX "nations_id_idx" ON "nations"("id");

-- CreateIndex
CREATE UNIQUE INDEX "nation_configs_nation_id_key" ON "nation_configs"("nation_id");

-- CreateIndex
CREATE INDEX "nation_configs_nation_id_idx" ON "nation_configs"("nation_id");

-- CreateIndex
CREATE INDEX "nation_configs_alliance_id_idx" ON "nation_configs"("alliance_id");

-- CreateIndex
CREATE INDEX "aid_offers_declaring_nation_id_idx" ON "aid_offers"("declaring_nation_id");

-- CreateIndex
CREATE INDEX "aid_offers_receiving_nation_id_idx" ON "aid_offers"("receiving_nation_id");

-- CreateIndex
CREATE INDEX "aid_offers_status_idx" ON "aid_offers"("status");

-- CreateIndex
CREATE INDEX "wars_declaring_nation_id_idx" ON "wars"("declaring_nation_id");

-- CreateIndex
CREATE INDEX "wars_receiving_nation_id_idx" ON "wars"("receiving_nation_id");

-- CreateIndex
CREATE INDEX "wars_status_idx" ON "wars"("status");

-- CreateIndex
CREATE INDEX "dynamic_wars_declaring_nation_id_idx" ON "dynamic_wars"("declaring_nation_id");

-- CreateIndex
CREATE INDEX "dynamic_wars_receiving_nation_id_idx" ON "dynamic_wars"("receiving_nation_id");

-- CreateIndex
CREATE INDEX "dynamic_wars_status_idx" ON "dynamic_wars"("status");

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_wars_war_id_key" ON "dynamic_wars"("war_id");

-- CreateIndex
CREATE UNIQUE INDEX "nuclear_hits_key_key" ON "nuclear_hits"("key");

-- CreateIndex
CREATE INDEX "nuclear_hits_key_idx" ON "nuclear_hits"("key");

-- CreateIndex
CREATE INDEX "cross_alliance_aid_source_alliance_id_idx" ON "cross_alliance_aid"("source_alliance_id");

-- CreateIndex
CREATE INDEX "cross_alliance_aid_target_alliance_id_idx" ON "cross_alliance_aid"("target_alliance_id");

-- CreateIndex
CREATE UNIQUE INDEX "cross_alliance_aid_source_alliance_id_target_alliance_id_key" ON "cross_alliance_aid"("source_alliance_id", "target_alliance_id");

-- AddForeignKey
ALTER TABLE "nations" ADD CONSTRAINT "nations_alliance_id_fkey" FOREIGN KEY ("alliance_id") REFERENCES "alliances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nation_configs" ADD CONSTRAINT "nation_configs_nation_id_fkey" FOREIGN KEY ("nation_id") REFERENCES "nations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nation_configs" ADD CONSTRAINT "nation_configs_alliance_id_fkey" FOREIGN KEY ("alliance_id") REFERENCES "alliances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aid_offers" ADD CONSTRAINT "aid_offers_declaring_nation_id_fkey" FOREIGN KEY ("declaring_nation_id") REFERENCES "nations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aid_offers" ADD CONSTRAINT "aid_offers_receiving_nation_id_fkey" FOREIGN KEY ("receiving_nation_id") REFERENCES "nations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wars" ADD CONSTRAINT "wars_declaring_nation_id_fkey" FOREIGN KEY ("declaring_nation_id") REFERENCES "nations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wars" ADD CONSTRAINT "wars_receiving_nation_id_fkey" FOREIGN KEY ("receiving_nation_id") REFERENCES "nations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_wars" ADD CONSTRAINT "dynamic_wars_declaring_nation_id_fkey" FOREIGN KEY ("declaring_nation_id") REFERENCES "nations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_wars" ADD CONSTRAINT "dynamic_wars_receiving_nation_id_fkey" FOREIGN KEY ("receiving_nation_id") REFERENCES "nations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_alliance_aid" ADD CONSTRAINT "cross_alliance_aid_source_alliance_id_fkey" FOREIGN KEY ("source_alliance_id") REFERENCES "alliances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_alliance_aid" ADD CONSTRAINT "cross_alliance_aid_target_alliance_id_fkey" FOREIGN KEY ("target_alliance_id") REFERENCES "alliances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
