-- CreateEnum
CREATE TYPE "BookFormat" AS ENUM ('physical', 'ebook', 'audiobook');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('backlog', 'reading', 'finished', 'dropped');

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "format" "BookFormat" NOT NULL DEFAULT 'physical',
    "status" "BookStatus" NOT NULL DEFAULT 'backlog',
    "pages" INTEGER,
    "pages_read" INTEGER,
    "price" DECIMAL(14,2),
    "purchased_at" TEXT,
    "finished_at" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "books_status_idx" ON "books"("status");

-- CreateIndex
CREATE INDEX "books_author_idx" ON "books"("author");
