-- CreateTable
CREATE TABLE "file_downloads" (
    "file_type" TEXT NOT NULL,
    "original_file" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "download_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_downloads_pkey" PRIMARY KEY ("file_type")
);

