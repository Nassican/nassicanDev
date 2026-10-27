-- CreateEnum
CREATE TYPE "PricingOrigin" AS ENUM ('observed', 'declared', 'estimated', 'missing');

-- CreateEnum
CREATE TYPE "PricingClientType" AS ENUM ('person', 'company');

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('project', 'monthly', 'hour');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('remote', 'onsite', 'hybrid');

-- CreateEnum
CREATE TYPE "PricingScope" AS ENUM ('basic', 'standard', 'advanced');

-- CreateEnum
CREATE TYPE "PricingStatus" AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "PricingNetwork" AS ENUM ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'other');

-- CreateEnum
CREATE TYPE "PricingFinancialSource" AS ENUM ('statements', 'tax_return', 'declared', 'estimated');

-- CreateEnum
CREATE TYPE "MarketQuoteSource" AS ENUM ('received', 'published', 'own', 'other');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TrashKind" ADD VALUE 'pricing_client';
ALTER TYPE "TrashKind" ADD VALUE 'pricing_quote';
ALTER TYPE "TrashKind" ADD VALUE 'market_quote';

-- AlterTable
ALTER TABLE "client_projects" ADD COLUMN     "client_id" TEXT;

-- CreateTable
CREATE TABLE "pricing_clients" (
    "id" TEXT NOT NULL,
    "type" "PricingClientType" NOT NULL DEFAULT 'person',
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Colombia',
    "department" TEXT,
    "municipality" TEXT,
    "zone" TEXT NOT NULL DEFAULT 'urban',
    "stratum" INTEGER,
    "monthly_income" DECIMAL(18,2),
    "income_origin" "PricingOrigin" NOT NULL DEFAULT 'missing',
    "activity" TEXT,
    "founded_at" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_client_financials" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "annual" BOOLEAN NOT NULL DEFAULT true,
    "source" "PricingFinancialSource" NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'puc',
    "assets" DECIMAL(18,2),
    "current_assets" DECIMAL(18,2),
    "liabilities" DECIMAL(18,2),
    "current_liabilities" DECIMAL(18,2),
    "equity" DECIMAL(18,2),
    "revenue_41" DECIMAL(18,2),
    "revenue_42" DECIMAL(18,2),
    "expense_51" DECIMAL(18,2),
    "expense_52" DECIMAL(18,2),
    "expense_53" DECIMAL(18,2),
    "expense_54" DECIMAL(18,2),
    "cost_61" DECIMAL(18,2),
    "purchases_62" DECIMAL(18,2),
    "class_7" DECIMAL(18,2),
    "depreciation" DECIMAL(18,2),
    "inventory_start" DECIMAL(18,2),
    "inventory_end" DECIMAL(18,2),
    "combined_deductions" DECIMAL(18,2),

    CONSTRAINT "pricing_client_financials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_client_signals" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "network" "PricingNetwork" NOT NULL,
    "followers" INTEGER NOT NULL,

    CONSTRAINT "pricing_client_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "PricingUnit" NOT NULL DEFAULT 'project',
    "typical_hours" DECIMAL(10,2) NOT NULL,
    "income_percent" DECIMAL(10,6) NOT NULL,
    "minimum" DECIMAL(18,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pricing_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_tiers" (
    "id" TEXT NOT NULL,
    "from_income" DECIMAL(18,2) NOT NULL,
    "to_income" DECIMAL(18,2),
    "percent" DECIMAL(10,6) NOT NULL DEFAULT 0.01,
    "minimum" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maximum" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "target_income" DECIMAL(18,2) NOT NULL DEFAULT 6000000,
    "fixed_costs" DECIMAL(18,2) NOT NULL DEFAULT 1000000,
    "billable_hours" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "margin" DECIMAL(10,6) NOT NULL DEFAULT 0.3,
    "project_weight" DECIMAL(10,6) NOT NULL DEFAULT 0.5,
    "capacity_weight" DECIMAL(10,6) NOT NULL DEFAULT 0.25,
    "market_weight" DECIMAL(10,6) NOT NULL DEFAULT 0.25,
    "rounding" DECIMAL(18,2) NOT NULL DEFAULT 10000,
    "profit_cap" DECIMAL(10,6) NOT NULL DEFAULT 0.2,
    "debt_low" DECIMAL(10,6) NOT NULL DEFAULT 0.6,
    "debt_high" DECIMAL(10,6) NOT NULL DEFAULT 0.8,
    "debt_medium_factor" DECIMAL(10,6) NOT NULL DEFAULT 0.85,
    "debt_high_factor" DECIMAL(10,6) NOT NULL DEFAULT 0.7,
    "negative_equity_factor" DECIMAL(10,6) NOT NULL DEFAULT 0.5,
    "margin_low" DECIMAL(10,6) NOT NULL DEFAULT 0.05,
    "margin_high" DECIMAL(10,6) NOT NULL DEFAULT 0.15,
    "negative_margin_factor" DECIMAL(10,6) NOT NULL DEFAULT 0.7,
    "low_margin_factor" DECIMAL(10,6) NOT NULL DEFAULT 0.85,
    "high_margin_factor" DECIMAL(10,6) NOT NULL DEFAULT 1.1,
    "liquidity_threshold" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "liquidity_factor" DECIMAL(10,6) NOT NULL DEFAULT 0.85,
    "health_minimum" DECIMAL(10,6) NOT NULL DEFAULT 0.5,
    "use_inventory" BOOLEAN NOT NULL DEFAULT true,
    "use_purchases" BOOLEAN NOT NULL DEFAULT true,
    "use_class_7" BOOLEAN NOT NULL DEFAULT true,
    "quote_max_months" INTEGER NOT NULL DEFAULT 18,
    "transport" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lodging" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "food" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_places" (
    "code" TEXT NOT NULL,
    "department_code" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "municipality" TEXT NOT NULL,

    CONSTRAINT "geo_places_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "pricing_regions" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "municipality" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "pricing_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_region_factors" (
    "id" TEXT NOT NULL,
    "region_id" TEXT NOT NULL,
    "service_id" TEXT,
    "mode" "PricingMode" NOT NULL,
    "factor" DECIMAL(10,6) NOT NULL,
    "origin" "PricingOrigin" NOT NULL,
    "justification" TEXT NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "pricing_region_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_income_estimates" (
    "id" TEXT NOT NULL,
    "region_id" TEXT NOT NULL,
    "stratum" INTEGER NOT NULL,
    "income" DECIMAL(18,2) NOT NULL,
    "justification" TEXT NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "pricing_income_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_quotes" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "scope" "PricingScope" NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "unit" "PricingUnit" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'COP',
    "provider" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Colombia',
    "department" TEXT NOT NULL DEFAULT '',
    "municipality" TEXT NOT NULL DEFAULT '',
    "client_country" TEXT,
    "client_department" TEXT,
    "client_municipality" TEXT,
    "mode" "PricingMode" NOT NULL,
    "date" TEXT NOT NULL,
    "source" "MarketQuoteSource" NOT NULL,
    "url" TEXT,
    "origin" "PricingOrigin" NOT NULL DEFAULT 'observed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_quotes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "service_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "suggested" DECIMAL(18,2) NOT NULL,
    "final" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'COP',
    "unit" "PricingUnit" NOT NULL,
    "status" "PricingStatus" NOT NULL DEFAULT 'draft',
    "valid_until" TEXT,
    "sent_at" TIMESTAMP(3),
    "project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_client_financials_client_id_start_end_key" ON "pricing_client_financials"("client_id", "start", "end");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_client_signals_client_id_network_key" ON "pricing_client_signals"("client_id", "network");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_services_name_key" ON "pricing_services"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_tiers_from_income_key" ON "pricing_tiers"("from_income");

-- CreateIndex
CREATE INDEX "geo_places_department_code_idx" ON "geo_places"("department_code");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_regions_country_department_municipality_key" ON "pricing_regions"("country", "department", "municipality");

-- CreateIndex
CREATE INDEX "pricing_region_factors_region_id_service_id_mode_idx" ON "pricing_region_factors"("region_id", "service_id", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_income_estimates_region_id_stratum_key" ON "pricing_income_estimates"("region_id", "stratum");

-- CreateIndex
CREATE INDEX "market_quotes_service_id_scope_unit_idx" ON "market_quotes"("service_id", "scope", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_quotes_project_id_key" ON "pricing_quotes"("project_id");

-- CreateIndex
CREATE INDEX "pricing_quotes_status_created_at_idx" ON "pricing_quotes"("status", "created_at");

-- AddForeignKey
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "pricing_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_client_financials" ADD CONSTRAINT "pricing_client_financials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "pricing_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_client_signals" ADD CONSTRAINT "pricing_client_signals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "pricing_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_region_factors" ADD CONSTRAINT "pricing_region_factors_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "pricing_regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_region_factors" ADD CONSTRAINT "pricing_region_factors_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "pricing_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_income_estimates" ADD CONSTRAINT "pricing_income_estimates_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "pricing_regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_quotes" ADD CONSTRAINT "market_quotes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "pricing_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quotes" ADD CONSTRAINT "pricing_quotes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "pricing_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quotes" ADD CONSTRAINT "pricing_quotes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "pricing_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quotes" ADD CONSTRAINT "pricing_quotes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
