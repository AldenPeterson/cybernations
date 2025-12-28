-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "nation_id" INTEGER,
    "alliance_id" INTEGER,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_type_idx" ON "events"("type");

-- CreateIndex
CREATE INDEX "events_event_type_idx" ON "events"("event_type");

-- CreateIndex
CREATE INDEX "events_nation_id_idx" ON "events"("nation_id");

-- CreateIndex
CREATE INDEX "events_alliance_id_idx" ON "events"("alliance_id");

-- CreateIndex
CREATE INDEX "events_created_at_idx" ON "events"("created_at");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_nation_id_fkey" FOREIGN KEY ("nation_id") REFERENCES "nations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_alliance_id_fkey" FOREIGN KEY ("alliance_id") REFERENCES "alliances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

