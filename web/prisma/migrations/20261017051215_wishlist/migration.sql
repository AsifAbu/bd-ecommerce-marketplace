-- CreateTable
CREATE TABLE "wishlist_item" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wishlist_item_user_id_created_at_idx" ON "wishlist_item"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "wishlist_item_product_id_idx" ON "wishlist_item"("product_id");

-- CreateIndex
CREATE INDEX "wishlist_item_variant_id_idx" ON "wishlist_item"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_item_user_id_product_id_variant_id_key" ON "wishlist_item"("user_id", "product_id", "variant_id");

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
