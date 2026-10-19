import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonStyles } from "@/components/ui";
import { deliveredWithoutCollection, getPayoutConfig, payoutService } from "@/features/payouts/server";
import { AdminPayouts } from "@/features/payouts/ui/admin-payouts";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Payouts: admin" };

/** Admin (US-082): COD collections due per shop, payout batches, and payment records. */
export default function AdminPayoutsPage() {
  return (
    <>
      <AdminPageHeader
        title="Payouts"
        description="Cash collected on delivery, what each shop is owed and the payouts you have made."
        action={
          <Link className={buttonStyles({ variant: "secondary" })} href="/admin/orders">
            All orders
          </Link>
        }
      />
      <Suspense fallback={<AdminLoading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await connection();
  await guardPage("/admin/payouts", requirePlatformAdmin);
  const [overview, unrecorded] = await Promise.all([payoutService.adminOverview(), deliveredWithoutCollection()]);
  return <AdminPayouts {...overview} unrecorded={unrecorded} deliveryChargesTo={getPayoutConfig().deliveryChargesTo} />;
}
