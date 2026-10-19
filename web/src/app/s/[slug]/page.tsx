import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { storefrontMetadata } from "@/features/storefront/metadata";
import { parseStorefrontQuery } from "@/features/storefront/query";
import { getStorefrontShop, loadStorefront } from "@/features/storefront/service";
import { StorefrontSkeleton, StorefrontView } from "@/features/storefront/ui/storefront-view";
import { Container } from "@/components/ui";
import { storefrontUrl } from "@/lib/storefront-link";

// US-014: a shop's public storefront, the link sellers share on Facebook. Approved shops only;
// anything else is "not found".

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const shop = await getStorefrontShop(slug);
  if (!shop) return { title: "Shop not found", robots: { index: false } };
  return storefrontMetadata(shop, storefrontUrl(shop.slug));
}

export default function StorefrontPage({ params, searchParams }: PageProps<"/s/[slug]">) {
  return (
    <Container as="main" id="main" className="flex flex-1 flex-col py-6 sm:py-8">
      <Suspense fallback={<StorefrontSkeleton />}>
        <Storefront params={params} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Storefront({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { slug } = await params;
  const data = await loadStorefront(slug, parseStorefrontQuery(await searchParams), new Date());
  if (!data) notFound();
  return <StorefrontView data={data} />;
}
