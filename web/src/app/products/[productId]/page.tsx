import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { loadProductPage } from "@/features/products/server";
import { ProductDetailView } from "@/features/products/ui/product-page";
import { applyWishlistIntent, parseWishlistIntent } from "@/features/wishlist";
import { currentUserOrNull, wishlistService } from "@/features/wishlist/server";
import { WishlistIntentNotice } from "@/features/wishlist/ui/intent-notice";
import { WishlistButton } from "@/features/wishlist/ui/wishlist-button";

// One load per request for both the metadata and the page.
const getPage = cache((productId: string) => loadProductPage(productId));

export async function generateMetadata({ params }: PageProps<"/products/[productId]">): Promise<Metadata> {
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p role="status">Loading product…</p>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
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

  return (
    <ProductDetailView
      page={page}
      initialVariantId={initialVariantId}
      notice={intent && <WishlistIntentNotice result={intent} />}
      wishlist={
        <WishlistButton
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
