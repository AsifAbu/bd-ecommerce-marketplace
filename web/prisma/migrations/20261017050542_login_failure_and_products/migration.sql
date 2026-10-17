-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "login_failure" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_failure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "expires_on" DATE,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "sku" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL,
    "options" JSONB NOT NULL,
    "option_key" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_failure_identifier_created_at_idx" ON "login_failure"("identifier", "created_at");

-- CreateIndex
CREATE INDEX "login_failure_ip_created_at_idx" ON "login_failure"("ip", "created_at");

-- CreateIndex
CREATE INDEX "product_shop_id_deleted_at_idx" ON "product"("shop_id", "deleted_at");

-- CreateIndex
CREATE INDEX "product_category_id_status_idx" ON "product"("category_id", "status");

-- CreateIndex
CREATE INDEX "product_variant_shop_id_idx" ON "product_variant"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_shop_id_sku_key" ON "product_variant"("shop_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_product_id_option_key_key" ON "product_variant"("product_id", "option_key");

-- CreateIndex
CREATE INDEX "product_image_product_id_position_idx" ON "product_image"("product_id", "position");

-- CreateIndex
CREATE INDEX "product_image_shop_id_idx" ON "product_image"("shop_id");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
