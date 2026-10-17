-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('delivery', 'product', 'return_refund', 'shop_conduct', 'other');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ComplaintAuthorRole" AS ENUM ('customer', 'shop', 'admin');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('damaged', 'wrong_item', 'not_as_described', 'change_of_mind', 'other');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('requested', 'accepted', 'rejected', 'escalated', 'approved', 'denied', 'received', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('bkash', 'nagad', 'bank', 'cash');

-- AlterTable
ALTER TABLE "order_item" ADD COLUMN     "return_eligibility" TEXT;

-- CreateTable
CREATE TABLE "complaint_ticket" (
    "id" TEXT NOT NULL,
    "ticket_no" TEXT NOT NULL,
    "user_id" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "order_id" TEXT,
    "shop_order_id" TEXT,
    "shop_id" TEXT,
    "subject" TEXT NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3) NOT NULL,
    "overdue_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaint_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_message" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_role" "ComplaintAuthorRole" NOT NULL,
    "author_id" TEXT,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_request" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "shop_order_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "user_id" TEXT,
    "contact_phone" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "details" TEXT,
    "photo_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "policy_version" INTEGER,
    "status" "ReturnStatus" NOT NULL DEFAULT 'requested',
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shop_due_at" TIMESTAMP(3) NOT NULL,
    "shop_responded_at" TIMESTAMP(3),
    "shop_note" TEXT,
    "escalated_at" TIMESTAMP(3),
    "escalation_reason" TEXT,
    "dispute_note" TEXT,
    "admin_decided_at" TIMESTAMP(3),
    "admin_decided_by_id" TEXT,
    "admin_note" TEXT,
    "received_at" TIMESTAMP(3),
    "restocked_at" TIMESTAMP(3),
    "refund_amount" DECIMAL(12,2),
    "refund_delivery" DECIMAL(12,2),
    "refund_method" "RefundMethod",
    "refund_reference" TEXT,
    "refunded_at" TIMESTAMP(3),
    "refunded_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "complaint_ticket_ticket_no_key" ON "complaint_ticket"("ticket_no");

-- CreateIndex
CREATE INDEX "complaint_ticket_status_due_at_idx" ON "complaint_ticket"("status", "due_at");

-- CreateIndex
CREATE INDEX "complaint_ticket_user_id_idx" ON "complaint_ticket"("user_id");

-- CreateIndex
CREATE INDEX "complaint_ticket_order_id_idx" ON "complaint_ticket"("order_id");

-- CreateIndex
CREATE INDEX "complaint_ticket_shop_id_status_idx" ON "complaint_ticket"("shop_id", "status");

-- CreateIndex
CREATE INDEX "complaint_message_ticket_id_created_at_idx" ON "complaint_message"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "return_request_order_item_id_status_idx" ON "return_request"("order_item_id", "status");

-- CreateIndex
CREATE INDEX "return_request_shop_id_status_idx" ON "return_request"("shop_id", "status");

-- CreateIndex
CREATE INDEX "return_request_shop_order_id_idx" ON "return_request"("shop_order_id");

-- CreateIndex
CREATE INDEX "return_request_order_id_idx" ON "return_request"("order_id");

-- CreateIndex
CREATE INDEX "return_request_user_id_idx" ON "return_request"("user_id");

-- CreateIndex
CREATE INDEX "return_request_status_shop_due_at_idx" ON "return_request"("status", "shop_due_at");

-- AddForeignKey
ALTER TABLE "complaint_ticket" ADD CONSTRAINT "complaint_ticket_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_ticket" ADD CONSTRAINT "complaint_ticket_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_ticket" ADD CONSTRAINT "complaint_ticket_shop_order_id_fkey" FOREIGN KEY ("shop_order_id") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_ticket" ADD CONSTRAINT "complaint_ticket_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_message" ADD CONSTRAINT "complaint_message_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "complaint_ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_message" ADD CONSTRAINT "complaint_message_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_shop_order_id_fkey" FOREIGN KEY ("shop_order_id") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
