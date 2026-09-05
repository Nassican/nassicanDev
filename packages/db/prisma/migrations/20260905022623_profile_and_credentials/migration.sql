/*
  Warnings:

  - You are about to drop the column `issued_on` on the `certificates` table. All the data in the column will be lost.
  - The `location` column on the `profile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "EducationStatus" AS ENUM ('completed', 'in-progress');

-- AlterTable
ALTER TABLE "certificates" DROP COLUMN "issued_on",
ADD COLUMN     "date_label" TEXT;

-- AlterTable
ALTER TABLE "education" ADD COLUMN     "link" TEXT,
ADD COLUMN     "status" "EducationStatus" NOT NULL DEFAULT 'in-progress',
ALTER COLUMN "start_date" SET DATA TYPE TEXT,
ALTER COLUMN "end_date" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "experience" ALTER COLUMN "start_date" SET DATA TYPE TEXT,
ALTER COLUMN "end_date" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "profile" DROP COLUMN "location",
ADD COLUMN     "location" JSONB;

-- AlterTable
ALTER TABLE "profile_translations" ALTER COLUMN "bio" DROP NOT NULL;

-- CreateTable
CREATE TABLE "profile_cvs" (
    "id" TEXT NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "profile_cvs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_cv_translations" (
    "cv_id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "profile_cv_translations_pkey" PRIMARY KEY ("cv_id","locale")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_cvs_profile_id_lang_key" ON "profile_cvs"("profile_id", "lang");

-- AddForeignKey
ALTER TABLE "profile_cvs" ADD CONSTRAINT "profile_cvs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_cv_translations" ADD CONSTRAINT "profile_cv_translations_cv_id_fkey" FOREIGN KEY ("cv_id") REFERENCES "profile_cvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
