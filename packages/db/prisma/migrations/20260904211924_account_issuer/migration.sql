/*
  Warnings:

  - Added the required column `issuer` to the `accounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "issuer" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "accounts_issuer_account_id_idx" ON "accounts"("issuer", "account_id");
