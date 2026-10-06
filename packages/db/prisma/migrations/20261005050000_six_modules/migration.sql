-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('wishlist', 'backlog', 'in_progress', 'finished', 'dropped');

-- CreateEnum
CREATE TYPE "OpportunityKind" AS ENUM ('job', 'client', 'recruiter', 'collaboration', 'other');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('lead', 'contacted', 'conversation', 'proposal', 'won', 'lost');

-- CreateEnum
CREATE TYPE "BudgetScope" AS ENUM ('total', 'group', 'category');

-- AlterEnum
ALTER TYPE "SyncSource" ADD VALUE 'pagespeed';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TrashKind" ADD VALUE 'note';
ALTER TYPE "TrashKind" ADD VALUE 'course';
ALTER TYPE "TrashKind" ADD VALUE 'opportunity';

-- CreateTable
CREATE TABLE "pagespeed_runs" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "performance" INTEGER,
    "accessibility" INTEGER,
    "best_practices" INTEGER,
    "seo" INTEGER,
    "lcp_ms" INTEGER,
    "fcp_ms" INTEGER,
    "tbt_ms" INTEGER,
    "cls" DOUBLE PRECISION,
    "field_category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagespeed_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "post_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "url" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'backlog',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "hours" DOUBLE PRECISION,
    "hours_spent" DOUBLE PRECISION,
    "price" DECIMAL(14,2),
    "started_at" TEXT,
    "target_date" TEXT,
    "finished_at" TEXT,
    "note" TEXT,
    "certificate_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "OpportunityKind" NOT NULL DEFAULT 'job',
    "stage" "OpportunityStage" NOT NULL DEFAULT 'lead',
    "organization" TEXT,
    "contact_name" TEXT,
    "contact" TEXT,
    "url" TEXT,
    "next_step" TEXT,
    "next_step_on" TEXT,
    "amount" DECIMAL(14,2),
    "currency" "Currency",
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_entries" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" TEXT NOT NULL,
    "scope" "BudgetScope" NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "monthly_limit" DECIMAL(14,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagespeed_runs_path_strategy_date_idx" ON "pagespeed_runs"("path", "strategy", "date");

-- CreateIndex
CREATE UNIQUE INDEX "pagespeed_runs_date_path_strategy_key" ON "pagespeed_runs"("date", "path", "strategy");

-- CreateIndex
CREATE UNIQUE INDEX "notes_post_id_key" ON "notes"("post_id");

-- CreateIndex
CREATE INDEX "notes_updated_at_idx" ON "notes"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "courses_certificate_id_key" ON "courses"("certificate_id");

-- CreateIndex
CREATE INDEX "courses_status_idx" ON "courses"("status");

-- CreateIndex
CREATE INDEX "opportunities_stage_next_step_on_idx" ON "opportunities"("stage", "next_step_on");

-- CreateIndex
CREATE INDEX "opportunity_entries_opportunity_id_at_idx" ON "opportunity_entries"("opportunity_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "budget_lines_scope_key_key" ON "budget_lines"("scope", "key");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_entries" ADD CONSTRAINT "opportunity_entries_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

