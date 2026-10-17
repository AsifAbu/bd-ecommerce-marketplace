-- CreateEnum
CREATE TYPE "ShopOrderStatus" AS ENUM ('placed', 'confirmed', 'packed', 'handed_over', 'delivered', 'cancelled', 'refused', 'returned');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cod');

-- CreateEnum
CREATE TYPE "OrderZone" AS ENUM ('inside_dhaka', 'outside_dhaka');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OtpPurpose" ADD VALUE 'checkout_verify';
ALTER TYPE "OtpPurpose" ADD VALUE 'order_track';

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "user_id" TEXT,
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "phone_verified_at" TIMESTAMP(3) NOT NULL,
    "contact_email" TEXT,
    "address" JSONB NOT NULL,
    "zone" "OrderZone" NOT NULL,
    "items_subtotal" DECIMAL(12,2) NOT NULL,
    "delivery_total" DECIMAL(12,2) NOT NULL,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'cod',
    "policy_versions" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "linked_via" TEXT,
    "linked_at" TIMESTAMP(3),
    "sms_sent_at" TIMESTAMP(3),
    "email_sent_at" TIMESTAMP(3),
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_order" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "status" "ShopOrderStatus" NOT NULL DEFAULT 'placed',
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shop_name" TEXT NOT NULL,
    "shop_registration" TEXT,
    "items_subtotal" DECIMAL(12,2) NOT NULL,
    "weight_grams" INTEGER NOT NULL,
    "delivery_charge" DECIMAL(12,2) NOT NULL,
    "free_delivery" BOOLEAN NOT NULL DEFAULT false,
    "total" DECIMAL(12,2) NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "vat_amount" DECIMAL(12,2) NOT NULL,
    "commission_amount" DECIMAL(12,2) NOT NULL,
    "launch_offer" BOOLEAN NOT NULL DEFAULT false,
    "handover_due_at" TIMESTAMP(3) NOT NULL,
    "cancel_reason" TEXT,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "shop_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "variant_label" TEXT,
    "sku" TEXT,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "unit_weight_grams" INTEGER NOT NULL,
    "warranty" TEXT,
    "commission_rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_order_no_key" ON "order"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "order_idempotency_key_key" ON "order"("idempotency_key");

-- CreateIndex
CREATE INDEX "order_user_id_placed_at_idx" ON "order"("user_id", "placed_at");

-- CreateIndex
CREATE INDEX "order_contact_phone_idx" ON "order"("contact_phone");

-- CreateIndex
CREATE INDEX "order_contact_email_idx" ON "order"("contact_email");

-- CreateIndex
CREATE INDEX "shop_order_shop_id_status_idx" ON "shop_order"("shop_id", "status");

-- CreateIndex
CREATE INDEX "shop_order_shop_id_created_at_idx" ON "shop_order"("shop_id", "created_at");

-- CreateIndex
CREATE INDEX "shop_order_status_handover_due_at_idx" ON "shop_order"("status", "handover_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "shop_order_order_id_shop_id_key" ON "shop_order"("order_id", "shop_id");

-- CreateIndex
CREATE INDEX "order_item_shop_order_id_idx" ON "order_item"("shop_order_id");

-- CreateIndex
CREATE INDEX "order_item_product_id_idx" ON "order_item"("product_id");

-- CreateIndex
CREATE INDEX "order_item_variant_id_idx" ON "order_item"("variant_id");

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_shop_order_id_fkey" FOREIGN KEY ("shop_order_id") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
