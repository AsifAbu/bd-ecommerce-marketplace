-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "PolicyAcceptanceContext" AS ENUM ('signup', 'checkout', 'account');

-- CreateTable
CREATE TABLE "policy_document" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "change_summary" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'draft',
    "effective_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_by" TEXT,
    "published_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_acceptance" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "guest_phone" TEXT,
    "policy_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "context" "PolicyAcceptanceContext" NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policy_document_slug_status_effective_at_idx" ON "policy_document"("slug", "status", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "policy_document_slug_version_key" ON "policy_document"("slug", "version");

-- CreateIndex
CREATE INDEX "policy_acceptance_user_id_slug_version_idx" ON "policy_acceptance"("user_id", "slug", "version");

-- CreateIndex
CREATE INDEX "policy_acceptance_guest_phone_idx" ON "policy_acceptance"("guest_phone");

-- CreateIndex
CREATE INDEX "policy_acceptance_policy_id_idx" ON "policy_acceptance"("policy_id");

-- AddForeignKey
ALTER TABLE "policy_document" ADD CONSTRAINT "policy_document_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_document" ADD CONSTRAINT "policy_document_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acceptance" ADD CONSTRAINT "policy_acceptance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acceptance" ADD CONSTRAINT "policy_acceptance_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy_document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
