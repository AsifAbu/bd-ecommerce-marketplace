import { connection } from "next/server";
import { Suspense } from "react";
import { SectionNav, SectionNavSkeleton, type SectionNavItem } from "@/components/section-nav";
import { Container } from "@/components/ui";
import { requireShopRole } from "@/lib/auth";

/**
 * Every /seller/[shopId] page: the seller centre nav (tab row on phones, sidebar from lg) and the
 * page in <main>. The nav only decides which links to show (Payouts is for owners); every page
 * still checks access itself.
 */
export default function SellerLayout({ children, params }: LayoutProps<"/seller/[shopId]">) {
  return (
    <Container
      as="main"
      className="flex flex-1 flex-col gap-6 py-4 sm:py-8 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-14 print:block print:max-w-none print:p-0"
    >
      <div className="lg:sticky lg:top-24 print:hidden">
        <Suspense fallback={<SectionNavSkeleton />}>
          <SellerNav params={params} />
        </Suspense>
      </div>
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
    </Container>
  );
}

async function SellerNav({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  let isOwner = false;
  try {
    isOwner = (await requireShopRole(shopId, ["owner", "staff"])).role === "owner";
  } catch {
    return null; // the page itself redirects a guest or answers 404
  }
  const base = `/seller/${shopId}`;
  const items: SectionNavItem[] = [
    { href: base, label: "Dashboard", exact: true },
    { href: `${base}/products`, label: "Products" },
    { href: `${base}/orders`, label: "Orders" },
    { href: `${base}/returns`, label: "Returns" },
    { href: `${base}/complaints`, label: "Complaints" },
    { href: `${base}/reviews`, label: "Reviews" },
    ...(isOwner ? [{ href: `${base}/payouts`, label: "Payouts" }] : []),
  ];
  return <SectionNav label="Shop" items={items} />;
}
