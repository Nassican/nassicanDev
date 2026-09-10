ALTER TABLE "seo_settings"
  ADD COLUMN "allow_ai_search" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allow_ai_training" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "llms_enabled" BOOLEAN NOT NULL DEFAULT true;
