import { Store } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonStyles, Container, EmptyState, PageHeader } from "@/components/ui";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { ShopStatusBadge, TierBadge } from "@/features/shops/components/shop-badges";
import { guardPage } from "@/features/shops/page-guard";
import { listMyShops } from "@/features/shops/repo";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "My shops" };

export default function SellerHome() {
  return (
    <Container as="main" id="main" className="flex max-w-3xl flex-1 flex-col gap-8 py-6 sm:py-10">
      <PageHeader
        title="My shops"
        actions={
          <Link href="/shops/apply" className={buttonStyles({ variant: "secondary" })}>
            Open a new shop
          </Link>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <MyShops />
      </Suspense>
    </Container>
  );
}

async function MyShops() {
  await connection();
  const user = await guardPage("/seller", requireUser);
  const memberships = await listMyShops(user.id);
  if (memberships.length === 0) {
    return (
      <EmptyState
        icon={<Store aria-hidden="true" size={24} />}
        title="You don't run a shop yet"
        description="Anyone can open a shop and sell across Bangladesh. Applications are approved by the marketplace team."
        action={
          <Link href="/shops/apply" className={buttonStyles()}>
            Open a shop
          </Link>
        }
      />
    );
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {memberships.map((m) => (
        <li key={m.id}>
          <Link
            className="-mx-3 flex min-h-16 flex-col gap-2 rounded-md px-3 py-4 transition-colors hover:bg-surface sm:flex-row sm:items-center sm:justify-between"
            href={`/seller/${m.shop.id}`}
          >
            <span className="text-lg font-semibold">{m.shop.name}</span>
            <span className="flex flex-wrap items-center gap-2">
              <ShopStatusBadge status={m.shop.status} />
              <TierBadge tier={m.shop.tier} />
              <span className="text-sm text-muted">{m.role === "owner" ? "Owner" : "Staff"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
