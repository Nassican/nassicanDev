-- CreateTable
CREATE TABLE "vercel_analytics_daily" (
    "date" DATE NOT NULL,
    "dimension" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "visitors" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vercel_analytics_daily_pkey" PRIMARY KEY ("date","dimension","value")
);

-- CreateIndex
CREATE INDEX "vercel_analytics_daily_dimension_date_idx" ON "vercel_analytics_daily"("dimension", "date");

