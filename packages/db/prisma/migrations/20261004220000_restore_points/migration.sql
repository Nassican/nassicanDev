-- CreateTable
CREATE TABLE "restore_points" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restore_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restore_points_created_at_idx" ON "restore_points"("created_at");

-- AddForeignKey
ALTER TABLE "restore_points" ADD CONSTRAINT "restore_points_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

