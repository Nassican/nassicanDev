-- CreateEnum
CREATE TYPE "TrashKind" AS ENUM ('post', 'project', 'page', 'media', 'game', 'book');

-- AlterTable
ALTER TABLE "books" ADD COLUMN     "isbn" TEXT;

-- CreateTable
CREATE TABLE "trash_items" (
    "id" TEXT NOT NULL,
    "kind" "TrashKind" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "deleted_by" TEXT,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trash_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trash_items_deleted_at_idx" ON "trash_items"("deleted_at");

-- CreateIndex
CREATE INDEX "books_isbn_idx" ON "books"("isbn");

-- AddForeignKey
ALTER TABLE "trash_items" ADD CONSTRAINT "trash_items_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

