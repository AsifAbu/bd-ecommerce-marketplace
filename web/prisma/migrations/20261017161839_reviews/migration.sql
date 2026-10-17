-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('visible', 'hidden');

-- CreateTable
CREATE TABLE "review" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL DEFAULT '',
    "status" "ReviewStatus" NOT NULL DEFAULT 'visible',
    "hidden_reason" TEXT,
    "hidden_by_id" TEXT,
    "hidden_at" TIMESTAMP(3),
    "edited_at" TIMESTAMP(3),
    "reply_text" TEXT,
    "reply_by_id" TEXT,
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_rating" (
    "product_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "average" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "stars_1" INTEGER NOT NULL DEFAULT 0,
    "stars_2" INTEGER NOT NULL DEFAULT 0,
    "stars_3" INTEGER NOT NULL DEFAULT 0,
    "stars_4" INTEGER NOT NULL DEFAULT 0,
    "stars_5" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_rating_pkey" PRIMARY KEY ("product_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_order_item_id_key" ON "review"("order_item_id");

-- CreateIndex
CREATE INDEX "review_product_id_status_created_at_idx" ON "review"("product_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "review_shop_id_status_created_at_idx" ON "review"("shop_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "review_user_id_created_at_idx" ON "review"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "review_status_created_at_idx" ON "review"("status", "created_at");

-- CreateIndex
CREATE INDEX "product_rating_shop_id_idx" ON "product_rating"("shop_id");

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_hidden_by_id_fkey" FOREIGN KEY ("hidden_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_reply_by_id_fkey" FOREIGN KEY ("reply_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_rating" ADD CONSTRAINT "product_rating_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
