/**
 * Public entry of the reviews feature (US-055). Pure code and types only; the database-wired
 * service is in `./server` (`reviewService`, `reviewsApi`).
 */
export { ReviewError } from "./errors";
export {
  canEdit,
  combine,
  displayRating,
  EDIT_WINDOW_DAYS,
  isReviewableStatus,
  RATING_MAX,
  RATING_MIN,
  REVIEWABLE_STATUSES,
  reviewEligibility,
  summarize,
  type Eligibility,
  type ItemFacts,
  type RatingSummary,
  type ReviewStatus,
} from "./rules";
export type {
  AdminReview,
  AwaitingItem,
  ItemReviewState,
  OwnReview,
  ProductReviewsView,
  PublicReview,
  RatingView,
  ReviewMetrics,
  ReviewService,
  ShopReview,
  WriteContext,
} from "./service";
