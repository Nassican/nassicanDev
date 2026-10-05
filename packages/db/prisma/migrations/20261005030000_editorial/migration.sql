-- CreateEnum
CREATE TYPE "IdeaStage" AS ENUM ('idea', 'research');

-- CreateTable
CREATE TABLE "content_ideas" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "stage" "IdeaStage" NOT NULL DEFAULT 'idea',
    "target_date" TEXT,
    "post_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_ideas_post_id_key" ON "content_ideas"("post_id");

-- AddForeignKey
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

