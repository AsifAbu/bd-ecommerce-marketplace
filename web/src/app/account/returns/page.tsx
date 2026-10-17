import Link from "next/link";
import { Suspense } from "react";
import { userOrLogin } from "@/features/accounts/page-guards";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";
import { returnsOfUser } from "@/features/returns/server";
import { ReturnCard } from "@/features/returns/ui/return-card";
import { CustomerReturnActions } from "@/features/returns/ui/return-forms";

export const metadata = { title: "My returns" };

/** US-070: the customer's return requests (also on guest orders linked to the account). */
export default function MyReturnsPage() {
  return (
    <PageShell title="My returns" wide>
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const user = await userOrLogin("/account/returns");
  const returns = await returnsOfUser(user.id);
  return (
    <>
      <p className="text-sm">
        Ask for a return from the order page within 7 days of delivery (
        <Link className="text-blue-800 underline" href="/policies/returns">
          Return and Refund policy
        </Link>
        ). <Link className="text-blue-800 underline" href="/account/orders">My orders</Link> ·{" "}
        <Link className="text-blue-800 underline" href="/account/complaints">My complaints</Link>
      </p>
      {returns.length === 0 ? (
        <p>You have no return requests.</p>
      ) : (
        returns.map((r) => (
          <ReturnCard key={r.id} view={r} audience="customer">
            <p className="text-sm">
              <Link className="text-blue-800 underline" href={`/orders/${r.orderNo}`}>
                Order {r.orderNo}
              </Link>
            </p>
            <CustomerReturnActions view={r} />
          </ReturnCard>
        ))
      )}
    </>
  );
}
