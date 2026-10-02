-- AlterEnum
ALTER TYPE "SyncSource" ADD VALUE 'wallet';

-- CreateTable
CREATE TABLE "wallet_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL,
    "color" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "exclude_from_stats" BOOLEAN NOT NULL DEFAULT false,
    "is_bank_sync" BOOLEAN NOT NULL DEFAULT false,
    "initial_balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group_id" TEXT,
    "group_name" TEXT,
    "color" TEXT,
    "system_id" TEXT,
    "cardinality" TEXT,
    "custom_category" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_records" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "category_id" TEXT,
    "category_name" TEXT,
    "category_group" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency_code" TEXT NOT NULL,
    "record_date" TIMESTAMP(3) NOT NULL,
    "record_type" TEXT NOT NULL,
    "record_state" TEXT NOT NULL,
    "note" TEXT,
    "counter_party" TEXT,
    "labels" JSONB,
    "transfer_id" TEXT,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_budgets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limit_amount" DECIMAL(18,4) NOT NULL,
    "currency_code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "account_ids" JSONB NOT NULL,
    "category_ids" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_accounts_archived_idx" ON "wallet_accounts"("archived");

-- CreateIndex
CREATE INDEX "wallet_categories_group_id_idx" ON "wallet_categories"("group_id");

-- CreateIndex
CREATE INDEX "wallet_records_record_date_idx" ON "wallet_records"("record_date");

-- CreateIndex
CREATE INDEX "wallet_records_account_id_record_date_idx" ON "wallet_records"("account_id", "record_date");

-- CreateIndex
CREATE INDEX "wallet_records_category_id_record_date_idx" ON "wallet_records"("category_id", "record_date");

-- CreateIndex
CREATE INDEX "wallet_records_record_type_idx" ON "wallet_records"("record_type");

