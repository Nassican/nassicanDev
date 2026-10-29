ALTER TABLE "pricing_settings" ADD COLUMN "family_rounding" DECIMAL(18,2) NOT NULL DEFAULT 1000000;
ALTER TABLE "pricing_settings" ALTER COLUMN "rounding" SET DEFAULT 100000;
-- Activate the requested commercial rounding for new calculations only.
-- Stored quote snapshots and their agreed final amounts remain immutable.
UPDATE "pricing_settings" SET "rounding" = 100000 WHERE "id" = 'singleton';
