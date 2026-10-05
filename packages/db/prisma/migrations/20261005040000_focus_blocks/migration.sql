-- CreateTable
CREATE TABLE "focus_blocks" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "task_id" TEXT,
    "planned_minutes" INTEGER NOT NULL,
    "break_minutes" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "return_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "focus_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "focus_blocks_started_at_idx" ON "focus_blocks"("started_at");

-- CreateIndex
CREATE INDEX "focus_blocks_task_id_idx" ON "focus_blocks"("task_id");

-- AddForeignKey
ALTER TABLE "focus_blocks" ADD CONSTRAINT "focus_blocks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

