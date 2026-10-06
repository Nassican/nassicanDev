-- CreateEnum
CREATE TYPE "ClientProjectStatus" AS ENUM ('not_started', 'in_progress', 'finished');

-- AlterEnum
BEGIN;
CREATE TYPE "TrashKind_new" AS ENUM ('post', 'project', 'page', 'media', 'game', 'book', 'subscription', 'journal', 'task', 'goal', 'habit', 'idea', 'course', 'client_project');
ALTER TABLE "trash_items" ALTER COLUMN "kind" TYPE "TrashKind_new" USING ("kind"::text::"TrashKind_new");
ALTER TYPE "TrashKind" RENAME TO "TrashKind_old";
ALTER TYPE "TrashKind_new" RENAME TO "TrashKind";
DROP TYPE "public"."TrashKind_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_post_id_fkey";

-- DropForeignKey
ALTER TABLE "opportunity_entries" DROP CONSTRAINT "opportunity_entries_opportunity_id_fkey";

-- DropTable
DROP TABLE "budget_lines";

-- DropTable
DROP TABLE "notes";

-- DropTable
DROP TABLE "opportunities";

-- DropTable
DROP TABLE "opportunity_entries";

-- DropEnum
DROP TYPE "BudgetScope";

-- DropEnum
DROP TYPE "OpportunityKind";

-- DropEnum
DROP TYPE "OpportunityStage";

-- CreateTable
CREATE TABLE "client_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "status" "ClientProjectStatus" NOT NULL DEFAULT 'not_started',
    "contact_name" TEXT,
    "contact" TEXT,
    "url" TEXT,
    "description" TEXT,
    "started_at" TEXT,
    "due_date" TEXT,
    "finished_at" TEXT,
    "amount" DECIMAL(14,2),
    "currency" "Currency",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_project_entries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "hours" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_project_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_projects_status_idx" ON "client_projects"("status");

-- CreateIndex
CREATE INDEX "client_project_entries_project_id_at_idx" ON "client_project_entries"("project_id", "at");

-- AddForeignKey
ALTER TABLE "client_project_entries" ADD CONSTRAINT "client_project_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

