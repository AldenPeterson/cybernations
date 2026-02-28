-- CreateTable
CREATE TABLE "capabilities" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_capabilities" (
    "role" "UserRole" NOT NULL,
    "capability_id" INTEGER NOT NULL,

    CONSTRAINT "role_capabilities_pkey" PRIMARY KEY ("role","capability_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "capabilities_name_key" ON "capabilities"("name");

-- CreateIndex
CREATE INDEX "role_capabilities_role_idx" ON "role_capabilities"("role");

-- CreateIndex
CREATE INDEX "role_capabilities_capability_id_idx" ON "role_capabilities"("capability_id");

-- AddForeignKey
ALTER TABLE "role_capabilities" ADD CONSTRAINT "role_capabilities_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
