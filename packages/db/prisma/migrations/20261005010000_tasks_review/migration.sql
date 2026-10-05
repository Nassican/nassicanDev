-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('inbox', 'planned', 'done', 'dropped');

-- AlterEnum
ALTER TYPE "TrashKind" ADD VALUE 'task';

-- AlterTable
ALTER TABLE "journal_weeks" ADD COLUMN     "change" TEXT,
ADD COLUMN     "went_well" TEXT,
ALTER COLUMN "summary" DROP NOT NULL;

-- CreateTable
CREATE TABLE "week_priorities" (
    "id" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "week_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "area" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'inbox',
    "planned_for" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "week_priorities_week_idx" ON "week_priorities"("week");

-- CreateIndex
CREATE INDEX "tasks_status_planned_for_idx" ON "tasks"("status", "planned_for");

