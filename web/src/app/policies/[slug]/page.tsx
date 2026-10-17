import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <p className="text-sm">
        <Link className="underline" href="/policies">
          All policies
        </Link>
      </p>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <PublicPolicy slug={params.then((p) => p.slug)} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
