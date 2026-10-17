import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { complaintsOfShop } from "@/features/complaints/server";
import { TicketList } from "@/features/complaints/ui/ticket-views";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Shop complaints" };

/** US-072: complaints about this shop's orders (owner and staff), with the 72 h due time. */
export default function ShopComplaintsPage({ params }: PageProps<"/seller/[shopId]/complaints">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Complaints</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/complaints`, () => requireShopRole(shopId, ["owner", "staff"]));
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href={`/seller/${access.shopId}`}>
          Back to the shop dashboard
        </Link>{" "}
        ·{" "}
        <Link className="text-blue-800 underline" href={`/seller/${access.shopId}/returns`}>
          Returns
        </Link>
      </p>
      <p className="text-sm">Answer customers in the complaint thread. The marketplace admin resolves each complaint within 72 hours.</p>
      <TicketList
        tickets={await complaintsOfShop(access.shopId)}
        href={(t) => `/seller/${access.shopId}/complaints/${t.id}`}
        showCustomer
        empty="No complaints about your orders."
      />
    </>
  );
}
