import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { reviewService } from "@/features/reviews/server";
import { SellerReviews } from "@/features/reviews/ui/seller-reviews";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Shop reviews" };

/** Seller centre: the shop's rating and reviews with a public reply (owner and staff; scoped by shop). */
export default function ShopReviewsPage({ params, searchParams }: PageProps<"/seller/[shopId]/reviews">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Reviews</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
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
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href={`/seller/${access.shopId}`}>
          Back to the shop dashboard
        </Link>
      </p>
      <SellerReviews shopId={access.shopId} rating={rating} data={data} />
    </>
  );
}
