-- CreateTable
CREATE TABLE "warchest_submissions" (
    "id" SERIAL NOT NULL,
    "nation_id" INTEGER,
    "nation_name" TEXT NOT NULL,
    "total_money" DOUBLE PRECISION NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warchest_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warchest_submissions_nation_id_idx" ON "warchest_submissions"("nation_id");

-- CreateIndex
CREATE INDEX "warchest_submissions_nation_name_idx" ON "warchest_submissions"("nation_name");

-- CreateIndex
CREATE INDEX "warchest_submissions_captured_at_idx" ON "warchest_submissions"("captured_at");

-- AddForeignKey
ALTER TABLE "warchest_submissions" ADD CONSTRAINT "warchest_submissions_nation_id_fkey" FOREIGN KEY ("nation_id") REFERENCES "nations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

