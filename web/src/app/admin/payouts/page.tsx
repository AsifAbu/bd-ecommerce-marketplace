import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { deliveredWithoutCollection, getPayoutConfig, payoutService } from "@/features/payouts/server";
import { AdminPayouts } from "@/features/payouts/ui/admin-payouts";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Payouts: admin" };

/** Admin (US-082): COD collections due per shop, payout batches, and payment records. */
export default function AdminPayoutsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">Payouts: admin</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  await connection();
  await guardPage("/admin/payouts", requirePlatformAdmin);
  const [overview, unrecorded] = await Promise.all([payoutService.adminOverview(), deliveredWithoutCollection()]);
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href="/admin/orders">
          All orders
        </Link>
      </p>
      <AdminPayouts {...overview} unrecorded={unrecorded} deliveryChargesTo={getPayoutConfig().deliveryChargesTo} />
    </>
  );
}
