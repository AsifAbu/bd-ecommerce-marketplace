import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { reviewService } from "@/features/reviews/server";
import { SellerReviews } from "@/features/reviews/ui/seller-reviews";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Shop reviews" };

/** Seller centre: the shop's rating and reviews with a public reply (owner and staff; scoped by shop). */
export default function ShopReviewsPage({ params, searchParams }: PageProps<"/seller/[shopId]/reviews">) {
  return (
    <>
      <PageHeader title="Reviews" />
      <Suspense fallback={<ListSkeleton />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/reviews`, () => requireShopRole(shopId, ["owner", "staff"]));
  const query = await searchParams;
  const page = Array.isArray(query.page) ? query.page[0] : query.page;
  const [rating, data] = await Promise.all([reviewService.shopRating(access.shopId), reviewService.shopReviews(access.shopId, page ?? 1)]);
  return <SellerReviews shopId={access.shopId} rating={rating} data={data} />;
}
