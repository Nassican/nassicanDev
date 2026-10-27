-- CreateEnum
CREATE TYPE "PricingFactorOrigin" AS ENUM ('observed', 'manual');

-- AlterTable
ALTER TABLE "pricing_settings" ADD COLUMN     "confidence_high" DECIMAL(10,6) NOT NULL DEFAULT 0.75,
ADD COLUMN     "confidence_medium" DECIMAL(10,6) NOT NULL DEFAULT 0.5,
ADD COLUMN     "outlier_multiplier" DECIMAL(10,6) NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "pricing_region_factors" ALTER COLUMN "origin" TYPE "PricingFactorOrigin"
USING (CASE WHEN "origin"::text = 'observed' THEN 'observed' ELSE 'manual' END)::"PricingFactorOrigin";

-- A manual factor must never become an unexplained regional stereotype.
ALTER TABLE "pricing_region_factors" ADD CONSTRAINT "pricing_factor_evidence"
CHECK ("factor" > 0 AND length(btrim("date")) > 0 AND ("factor" = 1 OR length(btrim("justification")) > 0));
ALTER TABLE "pricing_income_estimates" ADD CONSTRAINT "pricing_income_stratum"
CHECK ("stratum" BETWEEN 0 AND 6 AND "income" >= 0);
ALTER TABLE "pricing_clients" ADD CONSTRAINT "pricing_client_stratum"
CHECK ("stratum" IS NULL OR "stratum" BETWEEN 0 AND 6);
