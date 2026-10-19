import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { complaintsOfShop } from "@/features/complaints/server";
import { TicketList } from "@/features/complaints/ui/ticket-views";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Shop complaints" };

/** US-072: complaints about this shop's orders (owner and staff), with the 72 h due time. */
export default function ShopComplaintsPage({ params }: PageProps<"/seller/[shopId]/complaints">) {
  return (
    <>
      <PageHeader title="Complaints" description="Answer customers in the complaint thread. The marketplace admin resolves each complaint within 72 hours." />
      <Suspense fallback={<ListSkeleton />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/complaints`, () => requireShopRole(shopId, ["owner", "staff"]));
  return (
    <div className="max-w-3xl">
      <TicketList
        tickets={await complaintsOfShop(access.shopId)}
        href={(t) => `/seller/${access.shopId}/complaints/${t.id}`}
        showCustomer
        empty="No complaints about your orders."
      />
    </div>
  );
}
