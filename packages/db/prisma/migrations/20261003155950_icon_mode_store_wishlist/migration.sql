-- CreateEnum
CREATE TYPE "IconMode" AS ENUM ('color', 'mono');

-- AlterEnum
ALTER TYPE "BookStatus" ADD VALUE 'wishlist';

-- AlterEnum
ALTER TYPE "GamePlatform" ADD VALUE 'microsoft';

-- AlterEnum
ALTER TYPE "GameStatus" ADD VALUE 'wishlist';

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "store" "GamePlatform";

-- AlterTable
ALTER TABLE "technologies" ADD COLUMN     "icon_mode" "IconMode" NOT NULL DEFAULT 'color';
