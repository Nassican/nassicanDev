ALTER TABLE "pricing_services" ADD COLUMN "description" TEXT,
ADD COLUMN "recommended_price" DECIMAL(18,2);
CREATE TABLE "pricing_service_components" (
  "package_id" TEXT NOT NULL,
  "component_id" TEXT NOT NULL,
  CONSTRAINT "pricing_service_components_pkey" PRIMARY KEY ("package_id", "component_id"),
  CONSTRAINT "pricing_service_component_distinct" CHECK ("package_id" <> "component_id"),
  CONSTRAINT "pricing_package_fk" FOREIGN KEY ("package_id") REFERENCES "pricing_services"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pricing_component_fk" FOREIGN KEY ("component_id") REFERENCES "pricing_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
ALTER TABLE "pricing_income_estimates" ALTER COLUMN "stratum" DROP NOT NULL;
CREATE UNIQUE INDEX "pricing_income_regional_baseline" ON "pricing_income_estimates"("region_id") WHERE "stratum" IS NULL;
