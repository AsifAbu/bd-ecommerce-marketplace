-- AlterTable
ALTER TABLE "product" ADD COLUMN     "bengali_name" TEXT;

-- CreateIndex
CREATE INDEX "product_status_deleted_at_created_at_idx" ON "product"("status", "deleted_at", "created_at");
