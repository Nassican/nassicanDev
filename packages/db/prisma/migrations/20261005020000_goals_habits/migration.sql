-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'achieved', 'dropped');

-- CreateEnum
CREATE TYPE "GoalSource" AS ENUM ('books_finished', 'games_finished', 'posts_published', 'tasks_done');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TrashKind" ADD VALUE 'goal';
ALTER TYPE "TrashKind" ADD VALUE 'habit';

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "why" TEXT,
    "plan_if" TEXT NOT NULL,
    "plan_then" TEXT NOT NULL,
    "deadline" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "target" INTEGER,
    "unit" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "source" "GoalSource",
    "since" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habits" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cue" TEXT NOT NULL,
    "days" TEXT NOT NULL DEFAULT '1234567',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_checks" (
    "habit_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "habit_checks_pkey" PRIMARY KEY ("habit_id","date")
);

-- CreateIndex
CREATE INDEX "goals_status_idx" ON "goals"("status");

-- AddForeignKey
ALTER TABLE "habit_checks" ADD CONSTRAINT "habit_checks_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

