-- AlterEnum
ALTER TYPE "LinkKind" ADD VALUE 'section';

-- AlterEnum
ALTER TYPE "NavLocation" ADD VALUE 'header_cta';

-- AlterTable
ALTER TABLE "site_settings" DROP COLUMN "contact_email",
DROP COLUMN "feature_flags",
ADD COLUMN     "brand_line" TEXT NOT NULL DEFAULT 'Nassican Group',
ADD COLUMN     "copyright_name" TEXT NOT NULL DEFAULT 'Nassican',
ADD COLUMN     "latest_posts_count" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "show_section_navigator" BOOLEAN NOT NULL DEFAULT true;

