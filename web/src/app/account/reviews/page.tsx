import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { userOrLogin } from "@/features/accounts/page-guards";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { reviewService } from "@/features/reviews/server";
import { MyReviews } from "@/features/reviews/ui/write-review";

export const metadata = { title: "My reviews" };

/** US-055: delivered items waiting for a review, and the customer's reviews. */
export default function MyReviewsPage() {
  return (
    <>
      <PageHeader title="My reviews" />
      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const user = await userOrLogin("/account/reviews");
  const { awaiting, reviews } = await reviewService.myReviews(user.id);
  return <MyReviews awaiting={awaiting} reviews={reviews} />;
}
