import { Suspense } from "react";
import { adminOrLogin } from "@/features/accounts/page-guards";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";
import { reviewService } from "@/features/reviews/server";
import { AdminReviews } from "@/features/reviews/ui/admin-reviews";

export const metadata = { title: "Reviews: moderation" };

/** US-055: Platform Admin review moderation (hide / show again with a logged reason; never delete). */
export default function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  return (
    <PageShell title="Reviews: moderation" wide>
      <Suspense fallback={<Loading />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await adminOrLogin("/admin/reviews");
  if (!admin) return <p role="alert">Only Platform Admins can moderate reviews.</p>;
  const query = await searchParams;
  const status = query.status === "hidden" ? "hidden" : "visible";
  const page = Array.isArray(query.page) ? query.page[0] : query.page;
  return <AdminReviews status={status} data={await reviewService.adminQueue(status, page ?? 1)} />;
}
