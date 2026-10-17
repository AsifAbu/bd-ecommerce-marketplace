import Link from "next/link";
import { Suspense } from "react";
import { userOrLogin } from "@/features/accounts/page-guards";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";
import { reviewService } from "@/features/reviews/server";
import { WriteReview } from "@/features/reviews/ui/write-review";

export const metadata = { title: "Your review", robots: { index: false } };

/** US-055: write or edit the review of one of the customer's delivered order items. */
export default function WriteReviewPage({ params }: PageProps<"/account/reviews/[orderItemId]">) {
  return (
    <PageShell title="Your review" wide>
      <Suspense fallback={<Loading />}>
        <Content params={params} />
      </Suspense>
    </PageShell>
  );
}

async function Content({ params }: { params: Promise<{ orderItemId: string }> }) {
  const { orderItemId } = await params;
  const user = await userOrLogin(`/account/reviews/${orderItemId}`);
  const context = await reviewService.writeContext(user.id, decodeURIComponent(orderItemId));
  if (!context) {
    return (
      <p>
        We can&apos;t find this item in your orders.{" "}
        <Link className="text-blue-800 underline" href="/account/reviews">
          See the items you can review
        </Link>
        .
      </p>
    );
  }
  return (
    <>
      <WriteReview context={context} />
      <p className="text-sm">
        <Link className="text-blue-800 underline" href="/account/reviews">
          All my reviews
        </Link>
      </p>
    </>
  );
}
