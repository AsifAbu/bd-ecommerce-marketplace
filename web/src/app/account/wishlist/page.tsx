import { Suspense } from "react";
import { userOrLogin } from "@/features/accounts/page-guards";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";
import { wishlistService } from "@/features/wishlist/server";
import { WishlistList } from "@/features/wishlist/ui/wishlist-list";

export const metadata = { title: "My wishlist" };

/** US-057: the logged-in customer's wishlist. Guests are sent to log in. */
export default function WishlistPage({ searchParams }: PageProps<"/account/wishlist">) {
  return (
    <PageShell title="My wishlist" wide>
      <Suspense fallback={<Loading />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await userOrLogin("/account/wishlist");
  const { moved } = await searchParams;
  return <WishlistList items={await wishlistService.listItems(user.id)} moved={moved !== undefined} />;
}
