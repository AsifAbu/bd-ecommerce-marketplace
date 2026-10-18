import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/ui";
import { adminOrLogin } from "@/features/accounts/page-guards";
import { reviewService } from "@/features/reviews/server";
import { AdminReviews } from "@/features/reviews/ui/admin-reviews";

export const metadata = { title: "Review moderation" };

/** US-055: Platform Admin review moderation (hide / show again with a logged reason; never delete). */
export default function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  return (
    <>
      <AdminPageHeader title="Review moderation" description="Hide a review that breaks the rules, with a reason. Reviews are never deleted and can be shown again." />
      <Suspense fallback={<AdminLoading />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await adminOrLogin("/admin/reviews");
  if (!admin) {
    return (
      <Notice tone="danger" role="alert">
        Only Platform Admins can moderate reviews.
      </Notice>
    );
  }
  const query = await searchParams;
  const status = query.status === "hidden" ? "hidden" : "visible";
  const page = Array.isArray(query.page) ? query.page[0] : query.page;
  return <AdminReviews status={status} data={await reviewService.adminQueue(status, page ?? 1)} />;
}
