-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('phone_verify', 'password_reset');

-- CreateEnum
CREATE TYPE "AccountTokenType" AS ENUM ('password_reset', 'email_verify');

-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('enum', 'multi_enum', 'number', 'boolean', 'text');

-- CreateEnum
CREATE TYPE "FilterWidget" AS ENUM ('checkbox_list', 'range_slider', 'toggle');

-- CreateEnum
CREATE TYPE "AttributeOptionStatus" AS ENUM ('active', 'pending');

-- CreateEnum
CREATE TYPE "CategoryRequestKind" AS ENUM ('category', 'enum_option');

-- CreateEnum
CREATE TYPE "CategoryRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ShopType" AS ENUM ('general', 'electronics', 'books', 'fashion', 'medicine');

-- CreateEnum
CREATE TYPE "ShopTier" AS ENUM ('basic', 'verified');

-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('trade_licence', 'vat', 'tin', 'ubid', 'pra', 'dbid');

-- CreateEnum
CREATE TYPE "UpgradeStatus" AS ENUM ('none', 'pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ShopRole" AS ENUM ('owner', 'staff');

-- CreateEnum
CREATE TYPE "LicenceStatus" AS ENUM ('pending', 'verified', 'rejected', 'expired');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "avatar_url" TEXT;

-- CreateTable
CREATE TABLE "address" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "upazila" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_code" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "ip" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "AccountTokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "is_leaf" BOOLEAN NOT NULL DEFAULT true,
    "is_other" BOOLEAN NOT NULL DEFAULT false,
    "requires_licence" BOOLEAN NOT NULL DEFAULT false,
    "requires_expiry" BOOLEAN NOT NULL DEFAULT false,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "live_product_count" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "unit" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_option" (
    "id" TEXT NOT NULL,
    "attribute_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "AttributeOptionStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attribute_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_attribute" (
    "category_id" TEXT NOT NULL,
    "attribute_id" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "filter_widget" "FilterWidget",
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_variant_axis" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "category_attribute_pkey" PRIMARY KEY ("category_id","attribute_id")
);

-- CreateTable
CREATE TABLE "category_request" (
    "id" TEXT NOT NULL,
    "kind" "CategoryRequestKind" NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "shop_id" TEXT,
    "parent_id" TEXT,
    "attribute_id" TEXT,
    "option_id" TEXT,
    "name" TEXT NOT NULL,
    "reason" TEXT,
    "status" "CategoryRequestStatus" NOT NULL DEFAULT 'pending',
    "due_at" TIMESTAMP(3) NOT NULL,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ShopType" NOT NULL,
    "tier" "ShopTier" NOT NULL DEFAULT 'basic',
    "status" "ShopStatus" NOT NULL DEFAULT 'pending',
    "status_reason" TEXT,
    "owner_id" TEXT NOT NULL,
    "owner_nid" TEXT NOT NULL,
    "owner_photo_key" TEXT NOT NULL,
    "registration_type" "RegistrationType",
    "registration_no" TEXT,
    "registration_doc_key" TEXT,
    "upgrade_status" "UpgradeStatus" NOT NULL DEFAULT 'none',
    "upgrade_reason" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "description" TEXT,
    "policies" TEXT,
    "medicine_suspended" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_member" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "ShopRole" NOT NULL,
    "permissions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_licence" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "licence_no" TEXT NOT NULL,
    "expiry_date" DATE NOT NULL,
    "document_key" TEXT NOT NULL,
    "status" "LicenceStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reason" TEXT,
    "warned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_licence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_invite" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "address_user_id_idx" ON "address"("user_id");

-- CreateIndex
CREATE INDEX "otp_code_phone_purpose_created_at_idx" ON "otp_code"("phone", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "otp_code_ip_created_at_idx" ON "otp_code"("ip", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "account_token_token_hash_key" ON "account_token"("token_hash");

-- CreateIndex
CREATE INDEX "account_token_user_id_idx" ON "account_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "category_parent_id_idx" ON "category"("parent_id");

-- CreateIndex
CREATE INDEX "category_path_idx" ON "category"("path");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_key_key" ON "attribute"("key");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_option_attribute_id_value_key" ON "attribute_option"("attribute_id", "value");

-- CreateIndex
CREATE INDEX "category_attribute_attribute_id_idx" ON "category_attribute"("attribute_id");

-- CreateIndex
CREATE INDEX "category_request_status_due_at_idx" ON "category_request"("status", "due_at");

-- CreateIndex
CREATE INDEX "category_request_requested_by_user_id_idx" ON "category_request"("requested_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_slug_key" ON "shop"("slug");

-- CreateIndex
CREATE INDEX "shop_status_idx" ON "shop"("status");

-- CreateIndex
CREATE INDEX "shop_owner_id_idx" ON "shop"("owner_id");

-- CreateIndex
CREATE INDEX "shop_member_user_id_idx" ON "shop_member"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_member_shop_id_user_id_key" ON "shop_member"("shop_id", "user_id");

-- CreateIndex
CREATE INDEX "shop_licence_shop_id_idx" ON "shop_licence"("shop_id");

-- CreateIndex
CREATE INDEX "shop_licence_status_expiry_date_idx" ON "shop_licence"("status", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "shop_invite_token_hash_key" ON "shop_invite"("token_hash");

-- CreateIndex
CREATE INDEX "shop_invite_shop_id_idx" ON "shop_invite"("shop_id");

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_token" ADD CONSTRAINT "account_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_option" ADD CONSTRAINT "attribute_option_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attribute" ADD CONSTRAINT "category_attribute_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attribute" ADD CONSTRAINT "category_attribute_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_request" ADD CONSTRAINT "category_request_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_request" ADD CONSTRAINT "category_request_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_request" ADD CONSTRAINT "category_request_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_request" ADD CONSTRAINT "category_request_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_request" ADD CONSTRAINT "category_request_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "attribute_option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_request" ADD CONSTRAINT "category_request_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop" ADD CONSTRAINT "shop_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_member" ADD CONSTRAINT "shop_member_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_member" ADD CONSTRAINT "shop_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_licence" ADD CONSTRAINT "shop_licence_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_licence" ADD CONSTRAINT "shop_licence_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_invite" ADD CONSTRAINT "shop_invite_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_invite" ADD CONSTRAINT "shop_invite_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
