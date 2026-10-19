import { Suspense } from "react";
import { EmptyState, PageHeader, buttonStyles } from "@/components/ui";
import Link from "next/link";
import { userOrLogin } from "@/features/accounts/page-guards";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { reviewService } from "@/features/reviews/server";
import { WriteReview } from "@/features/reviews/ui/write-review";

export const metadata = { title: "Your review", robots: { index: false } };

/** US-055: write or edit the review of one of the customer's delivered order items. */
export default function WriteReviewPage({ params }: PageProps<"/account/reviews/[orderItemId]">) {
  return (
    <>
      <PageHeader title="Your review" />
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: Promise<{ orderItemId: string }> }) {
  const { orderItemId } = await params;
  const user = await userOrLogin(`/account/reviews/${orderItemId}`);
  const context = await reviewService.writeContext(user.id, decodeURIComponent(orderItemId));
  if (!context) {
    return (
      <EmptyState
        title="We can't find this item in your orders"
        description="Reviews can be written for items that were delivered to you."
        action={
          <Link className={buttonStyles()} href="/account/reviews">
            See the items you can review
          </Link>
        }
      />
    );
  }
  return <WriteReview context={context} />;
}
