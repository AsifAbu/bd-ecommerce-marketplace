import Link from "next/link";
import { Suspense } from "react";
import { buttonStyles, EmptyState, PageHeader, TextLink } from "@/components/ui";
import { userOrLogin } from "@/features/accounts/page-guards";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { returnsOfUser } from "@/features/returns/server";
import { ReturnCard } from "@/features/returns/ui/return-card";
import { CustomerReturnActions } from "@/features/returns/ui/return-forms";

export const metadata = { title: "My returns" };

/** US-070: the customer's return requests (also on guest orders linked to the account). */
export default function MyReturnsPage() {
  return (
    <>
      <PageHeader
        title="My returns"
        description={
          <>
            Ask for a return from the order page within 7 days of delivery. Read the <TextLink href="/policies/returns">Return and Refund policy</TextLink>.
          </>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const user = await userOrLogin("/account/returns");
  const returns = await returnsOfUser(user.id);
  if (returns.length === 0) {
    return (
      <EmptyState
        title="You have no return requests"
        description="If something is wrong with a delivered item, open the order and choose Request a return."
        action={
          <Link href="/account/orders" className={buttonStyles({ variant: "secondary" })}>
            Go to my orders
          </Link>
        }
      />
    );
  }
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {returns.map((r) => (
        <ReturnCard key={r.id} view={r} audience="customer">
          <p className="text-sm">
            <TextLink href={`/orders/${r.orderNo}`}>Order {r.orderNo}</TextLink>
          </p>
          <CustomerReturnActions view={r} />
        </ReturnCard>
      ))}
    </div>
  );
}
