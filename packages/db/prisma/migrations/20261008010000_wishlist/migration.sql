-- CreateEnum
CREATE TYPE "WishStatus" AS ENUM ('wanted', 'bought', 'dropped');

-- CreateEnum
CREATE TYPE "WishPriority" AS ENUM ('high', 'medium', 'low');

-- AlterEnum
ALTER TYPE "TrashKind" ADD VALUE 'wish';

-- CreateTable
CREATE TABLE "wish_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "note" TEXT,
    "priority" "WishPriority" NOT NULL DEFAULT 'medium',
    "status" "WishStatus" NOT NULL DEFAULT 'wanted',
    "price" DECIMAL(14,2),
    "currency" "Currency" NOT NULL DEFAULT 'COP',
    "target_date" TEXT,
    "bought_at" TEXT,
    "paid" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wish_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wish_savings" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wish_savings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wish_items_status_idx" ON "wish_items"("status");

-- CreateIndex
CREATE INDEX "wish_savings_item_id_at_idx" ON "wish_savings"("item_id", "at");

-- AddForeignKey
ALTER TABLE "wish_savings" ADD CONSTRAINT "wish_savings_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "wish_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

