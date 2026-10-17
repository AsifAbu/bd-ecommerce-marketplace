-- AlterTable
ALTER TABLE "shop" ADD COLUMN     "free_delivery_threshold" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "cart_item" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "guest_token" TEXT,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "saved_for_later" BOOLEAN NOT NULL DEFAULT false,
    "price_at_add" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cart_item_guest_token_idx" ON "cart_item"("guest_token");

-- CreateIndex
CREATE INDEX "cart_item_variant_id_idx" ON "cart_item"("variant_id");

-- CreateIndex
CREATE INDEX "cart_item_shop_id_idx" ON "cart_item"("shop_id");

-- CreateIndex
CREATE INDEX "cart_item_updated_at_idx" ON "cart_item"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_user_id_variant_id_key" ON "cart_item"("user_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_guest_token_variant_id_key" ON "cart_item"("guest_token", "variant_id");

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
