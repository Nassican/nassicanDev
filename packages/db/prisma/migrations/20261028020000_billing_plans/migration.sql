CREATE TABLE "billing_issuer_settings" (
  "id" TEXT PRIMARY KEY DEFAULT 'singleton', "details" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "billing_plans" (
  "id" TEXT PRIMARY KEY, "quote_id" TEXT UNIQUE, "project_id" TEXT UNIQUE,
  "title" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL CHECK (amount >= 0),
  "currency" "Currency" NOT NULL, "unit" "PricingUnit" NOT NULL DEFAULT 'project',
  "details" JSONB NOT NULL, "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_plans_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "pricing_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "billing_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "billing_charges" (
  "id" TEXT PRIMARY KEY, "sequence" SERIAL UNIQUE,
  "plan_id" TEXT NOT NULL REFERENCES "billing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "installment_id" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  "currency" "Currency" NOT NULL, "snapshot" JSONB NOT NULL,
  "canceled_at" TIMESTAMP(3), "cancellation_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "billing_charges_active_installment_key" ON "billing_charges"("plan_id", "installment_id") WHERE "canceled_at" IS NULL;
CREATE INDEX "billing_charges_plan_id_idx" ON "billing_charges"("plan_id");
CREATE TABLE "billing_receipts" (
  "id" TEXT PRIMARY KEY, "charge_id" TEXT NOT NULL REFERENCES "billing_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount" DECIMAL(18,2) NOT NULL CHECK (amount > 0), "paid_at" TEXT NOT NULL,
  "reference" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "billing_receipts_charge_id_paid_at_idx" ON "billing_receipts"("charge_id", "paid_at");
