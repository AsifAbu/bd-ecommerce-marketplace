-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "DeliveryChargesTo" AS ENUM ('shop', 'courier');

-- AlterTable
ALTER TABLE "shop_order" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by" TEXT,
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "courier_name" TEXT,
ADD COLUMN     "handed_over_at" TIMESTAMP(3),
ADD COLUMN     "overdue_notified_at" TIMESTAMP(3),
ADD COLUMN     "packed_at" TIMESTAMP(3),
ADD COLUMN     "refusal_note" TEXT,
ADD COLUMN     "refused_at" TIMESTAMP(3),
ADD COLUMN     "restocked_at" TIMESTAMP(3),
ADD COLUMN     "returned_at" TIMESTAMP(3),
ADD COLUMN     "tracking_no" TEXT;

-- CreateTable
CREATE TABLE "shop_order_event" (
    "id" TEXT NOT NULL,
    "shop_order_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" "ShopOrderStatus" NOT NULL,
    "to_status" "ShopOrderStatus" NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT NOT NULL,
    "note" TEXT,
    "restocked" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_order_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cod_collection" (
    "id" TEXT NOT NULL,
    "shop_order_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "items_amount" DECIMAL(12,2) NOT NULL,
    "delivery_charge" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "recorded_by_id" TEXT,
    "payout_due_at" TIMESTAMP(3) NOT NULL,
    "payout_id" TEXT,
    "paid_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cod_collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "collection_count" INTEGER NOT NULL,
    "gross" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "delivery_charges" DECIMAL(12,2) NOT NULL,
    "delivery_charges_to" "DeliveryChargesTo" NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "due_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "method" TEXT,
    "reference" TEXT,
    "recorded_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shop_order_event_shop_order_id_at_idx" ON "shop_order_event"("shop_order_id", "at");

-- CreateIndex
CREATE INDEX "shop_order_event_at_idx" ON "shop_order_event"("at");

-- CreateIndex
CREATE UNIQUE INDEX "cod_collection_shop_order_id_key" ON "cod_collection"("shop_order_id");

-- CreateIndex
CREATE INDEX "cod_collection_shop_id_collected_at_idx" ON "cod_collection"("shop_id", "collected_at");

-- CreateIndex
CREATE INDEX "cod_collection_payout_id_idx" ON "cod_collection"("payout_id");

-- CreateIndex
CREATE INDEX "cod_collection_paid_out_at_payout_due_at_idx" ON "cod_collection"("paid_out_at", "payout_due_at");

-- CreateIndex
CREATE INDEX "payout_shop_id_created_at_idx" ON "payout"("shop_id", "created_at");

-- CreateIndex
CREATE INDEX "payout_status_due_at_idx" ON "payout"("status", "due_at");

-- CreateIndex
CREATE INDEX "shop_order_status_overdue_notified_at_idx" ON "shop_order"("status", "overdue_notified_at");

-- AddForeignKey
ALTER TABLE "shop_order_event" ADD CONSTRAINT "shop_order_event_shop_order_id_fkey" FOREIGN KEY ("shop_order_id") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_collection" ADD CONSTRAINT "cod_collection_shop_order_id_fkey" FOREIGN KEY ("shop_order_id") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_collection" ADD CONSTRAINT "cod_collection_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_collection" ADD CONSTRAINT "cod_collection_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
