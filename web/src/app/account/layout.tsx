import { Suspense } from "react";
import { SectionNav, SectionNavSkeleton } from "@/components/section-nav";
import { Container } from "@/components/ui";

const ITEMS = [
  { href: "/account", label: "Profile", exact: true },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/reviews", label: "Reviews" },
  { href: "/account/returns", label: "Returns" },
  { href: "/account/complaints", label: "Complaints" },
];

/** Every /account page: the section nav (tab row on phones, sidebar from lg) and the page in <main>. */
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <Container as="main" id="main" className="flex flex-1 flex-col gap-6 py-4 sm:py-8 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-14">
      <div className="lg:sticky lg:top-24">
        <Suspense fallback={<SectionNavSkeleton />}>
          <SectionNav label="Account" items={ITEMS} />
        </Suspense>
      </div>
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
    </Container>
  );
}
