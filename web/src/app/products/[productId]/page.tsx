import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { PageMain, Skeleton } from "@/components/ui";
import { AddToCartButton } from "@/features/cart/ui/add-to-cart-button";
import { priceRange } from "@/features/products/display";
import { loadProductPage } from "@/features/products/server";
import { ProductDetailView } from "@/features/products/ui/product-page";
import { reviewService } from "@/features/reviews/server";
import { ProductReviews, RatingSummary } from "@/features/reviews/ui/product-reviews";
import { applyWishlistIntent, parseWishlistIntent } from "@/features/wishlist";
import { currentUserOrNull, wishlistService } from "@/features/wishlist/server";
import { WishlistIntentNotice } from "@/features/wishlist/ui/intent-notice";
import { WishlistButton } from "@/features/wishlist/ui/wishlist-button";

// One load per request for both the metadata and the page.
const getPage = cache((productId: string) => loadProductPage(productId));

export async function generateMetadata({ params }: PageProps<"/products/[productId]">): Promise<Metadata> {
  await connection(); // liveness depends on today's date: request time
  const { productId } = await params;
  const page = await getPage(productId);
  if (!page) return { title: "Product not found" };
  const description = page.description.replace(/\s+/g, " ").trim();
  return {
    title: page.title,
    description: `From ${page.shop.name}. ${description.length > 140 ? `${description.slice(0, 139)}…` : description}`,
  };
}

/** US-044: the public product page. Only live listings; anything else is "not found". */
export default function ProductRoute({ params, searchParams }: PageProps<"/products/[productId]">) {
  return (
    <PageMain>
      <Suspense fallback={<ProductSkeleton />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </PageMain>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { productId } = await params;
  const page = await getPage(productId);
  if (!page) notFound();

  const query = await searchParams;
  const user = await currentUserOrNull();
  // US-057: a guest who tapped the heart comes back here after login; save the item now.
  const intent = await applyWishlistIntent(user, page.id, parseWishlistIntent(query), wishlistService.addItem);
  const saved = user ? await wishlistService.savedForProduct(user.id, page.id) : [];

  const onlyVariant = page.variants.length === 1 ? page.variants[0].id : null;
  const wanted = Array.isArray(query.variant) ? query.variant[0] : query.variant;
  const initialVariantId = page.variants.find((v) => v.id === wanted)?.id ?? onlyVariant;
  // US-055: rating and a page of visible reviews (?reviews=n).
  const reviewsPage = Array.isArray(query.reviews) ? query.reviews[0] : query.reviews;
  const reviews = await reviewService.productReviews(page.id, reviewsPage ?? 1);
  const reviewsHref = (n: number) => {
    const next = new URLSearchParams();
    if (typeof wanted === "string" && wanted) next.set("variant", wanted);
    if (n > 1) next.set("reviews", String(n));
    const qs = next.toString();
    return `/products/${encodeURIComponent(page.id)}${qs ? `?${qs}` : ""}#reviews-heading`;
  };

  return (
    <ProductDetailView
      page={page}
      initialVariantId={initialVariantId}
      notice={intent && <WishlistIntentNotice result={intent} />}
      rating={<RatingSummary rating={reviews.rating} />}
      reviews={<ProductReviews data={reviews} pageHref={reviewsHref} />}
      cart={
        <AddToCartButton
          variants={page.variants.map((v) => ({ id: v.id, stock: v.stock, price: v.price }))}
          defaultVariantId={onlyVariant}
          priceFallback={priceRange(page.variants.map((v) => v.price))}
          chooseHint={`Choose ${page.axes.map((a) => a.name.toLowerCase()).join(" and ") || "an option"} first.`}
        />
      }
      wishlist={
        <WishlistButton
          // Remount when the server's answer changes (e.g. saved after login): the router keeps
          // client state of pages visited before.
          key={`${user?.id ?? "guest"}:${saved.map((s) => s.id).join(",")}`}
          productId={page.id}
          loggedIn={user !== null}
          saved={saved}
          variantIds={page.variants.map((v) => v.id)}
          defaultVariantId={onlyVariant}
        />
      }
    />
  );
}

/** Shown while the product loads: the page's two columns as quiet blocks. */
function ProductSkeleton() {
  return (
    <div role="status" aria-label="Loading product" className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
      <Skeleton className="aspect-square w-full" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
