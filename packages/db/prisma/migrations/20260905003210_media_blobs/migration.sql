-- CreateTable
CREATE TABLE "media_blobs" (
    "media_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "media_blobs_pkey" PRIMARY KEY ("media_id")
);

-- AddForeignKey
ALTER TABLE "media_blobs" ADD CONSTRAINT "media_blobs_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
