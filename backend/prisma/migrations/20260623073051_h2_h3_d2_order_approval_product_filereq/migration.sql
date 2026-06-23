-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "minDpi" INTEGER,
ADD COLUMN     "requiredFormats" TEXT[] DEFAULT ARRAY[]::TEXT[];
