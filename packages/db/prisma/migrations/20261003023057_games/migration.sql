-- CreateEnum
CREATE TYPE "GamePlatform" AS ENUM ('ubisoft', 'gog', 'steam', 'epic', 'xbox', 'playstation', 'other');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('backlog', 'playing', 'finished', 'dropped');

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform" "GamePlatform" NOT NULL DEFAULT 'other',
    "status" "GameStatus" NOT NULL DEFAULT 'backlog',
    "hours" DOUBLE PRECISION,
    "price" DECIMAL(14,2),
    "purchased_at" TEXT,
    "finished_at" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "games_status_idx" ON "games"("status");

-- CreateIndex
CREATE INDEX "games_platform_idx" ON "games"("platform");
