import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePlatformAdmin } from "@/lib/auth";
import { AdminQueue } from "@/features/shops/components/admin-queue";
import { guardPage } from "@/features/shops/page-guard";

export const metadata = { title: "Shop review: admin" };

export default function AdminShopsPage() {
  return (
    <>
      <AdminPageHeader
        title="Shop review"
        description="Decide on new applications, medicine licences and Verified upgrades, then manage the shops that are live."
      />
      <Suspense fallback={<AdminLoading />}>
        <Queue />
      </Suspense>
    </>
  );
}

async function Queue() {
  await connection();
  await guardPage("/admin/shops", requirePlatformAdmin);
  return <AdminQueue />;
}
