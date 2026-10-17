import { Suspense } from "react";
import { userOrLogin } from "@/features/accounts/page-guards";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";
import { reviewService } from "@/features/reviews/server";
import { MyReviews } from "@/features/reviews/ui/write-review";

export const metadata = { title: "My reviews" };

/** US-055: delivered items waiting for a review, and the customer's reviews. */
export default function MyReviewsPage() {
  return (
    <PageShell title="My reviews" wide>
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const user = await userOrLogin("/account/reviews");
  const { awaiting, reviews } = await reviewService.myReviews(user.id);
  return <MyReviews awaiting={awaiting} reviews={reviews} />;
}
