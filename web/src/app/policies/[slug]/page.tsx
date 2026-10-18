import type { Metadata } from "next";
import { Suspense } from "react";
import { PageMain, Skeleton } from "@/components/ui";
import { isPolicySlug, POLICY_SLUGS, policyTitle } from "@/features/policies/client";
import { PublicPolicy } from "@/features/policies/ui/public-policy";

export function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: isPolicySlug(slug) ? policyTitle(slug) : "Policy" };
}

export default function PolicyPage({ params, searchParams }: PageProps<"/policies/[slug]">) {
  return (
    <PageMain className="gap-8">
      <Suspense
        fallback={
          <div role="status" className="flex max-w-[70ch] flex-col gap-3">
            <span className="sr-only">Loading…</span>
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <PublicPolicy slug={params.then((p) => p.slug)} searchParams={searchParams} />
      </Suspense>
    </PageMain>
  );
}
