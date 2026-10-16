import { connection } from "next/server";
import { Suspense } from "react";
import { requirePlatformAdmin } from "@/lib/auth";
import { AdminQueue } from "@/features/shops/components/admin-queue";
import { guardPage } from "@/features/shops/page-guard";

export default function AdminShopsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">Shops: admin review</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Queue />
      </Suspense>
    </main>
  );
}

async function Queue() {
  await connection();
  await guardPage("/admin/shops", requirePlatformAdmin);
  return <AdminQueue />;
}
