/*
  Warnings:

  - You are about to drop the column `last_checked_at` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `last_status` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the `post_links` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "post_links" DROP CONSTRAINT "post_links_post_id_fkey";

-- AlterTable
ALTER TABLE "certificates" DROP COLUMN "last_checked_at",
DROP COLUMN "last_status";

-- DropTable
DROP TABLE "post_links";

-- CreateTable
CREATE TABLE "outbound_links" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" INTEGER,
    "ok" BOOLEAN,
    "error" TEXT,
    "checked_at" TIMESTAMP(3),
    "references" JSONB NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbound_links_url_key" ON "outbound_links"("url");

-- CreateIndex
CREATE INDEX "outbound_links_ok_idx" ON "outbound_links"("ok");
