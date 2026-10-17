import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { guardPage } from "@/features/shops/page-guard";
import { returnPhotoUrls, returnsOfShop } from "@/features/returns/server";
import { ReturnCard } from "@/features/returns/ui/return-card";
import { ShopReturnActions } from "@/features/returns/ui/return-forms";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Shop returns" };

/** US-071: this shop's return requests (owner and staff): accept or reject within 48 h, then record the refund. */
export default function ShopReturnsPage({ params }: PageProps<"/seller/[shopId]/returns">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Returns</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/returns`, () => requireShopRole(shopId, ["owner", "staff"]));
  const returns = await returnsOfShop(access.shopId);
  const waiting = returns.filter((r) => r.status === "requested");
  const open = returns.filter((r) => ["accepted", "approved", "received", "escalated", "rejected"].includes(r.status));
  const closed = returns.filter((r) => ["refunded", "denied", "cancelled"].includes(r.status));
  const photos = new Map(await Promise.all(returns.filter((r) => r.photoCount).map(async (r) => [r.id, await returnPhotoUrls({ kind: "shop", shopId: access.shopId }, r.id)] as const)));
  const section = (title: string, list: typeof returns, empty: string) => (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="text-xl font-semibold">
        {title} ({list.length})
      </h2>
      {list.length === 0 ? (
        <p>{empty}</p>
      ) : (
        list.map((r) => (
          <ReturnCard key={r.id} view={r} audience="shop" photoUrls={photos.get(r.id)}>
            <ShopReturnActions shopId={access.shopId} view={r} />
          </ReturnCard>
        ))
      )}
    </section>
  );
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href={`/seller/${access.shopId}`}>
          Back to the shop dashboard
        </Link>{" "}
        ·{" "}
        <Link className="text-blue-800 underline" href={`/seller/${access.shopId}/complaints`}>
          Complaints
        </Link>
      </p>
      <p className="text-sm">
        Answer every request within 48 hours, or it goes to the marketplace admin. After accepting, collect the item, then pay the refund (bKash,
        Nagad, bank or cash) within 7 days and record it here; the customer is notified.
      </p>
      {section("Waiting for your answer", waiting, "No requests waiting.")}
      {section("In progress", open, "Nothing in progress.")}
      {section("Closed", closed, "No closed returns yet.")}
    </>
  );
}
