ALTER TABLE "pricing_settings"
ADD COLUMN "family_discount" DECIMAL(10,6) NOT NULL DEFAULT 0.2;

ALTER TABLE "pricing_settings"
ADD CONSTRAINT "pricing_family_discount_range"
CHECK ("family_discount" BETWEEN 0 AND 1);
