"use client";

import { ActionForm, Field } from "@/components/action-form";
import { Radio } from "@/components/ui";
import { editReview, writeReview } from "../actions";

const STAR_LABELS = ["1 star: poor", "2 stars: fair", "3 stars: good", "4 stars: very good", "5 stars: excellent"];

/**
 * Write or edit a review (US-055): a required star rating, an optional title and text. In edit
 * mode `review` holds the current values; `orderItemId` is used when writing.
 */
export function ReviewForm({
  orderItemId,
  review,
}: {
  orderItemId: string;
  review?: { id: string; rating: number; title: string | null; text: string };
}) {
  const editing = !!review;
  return (
    <ActionForm action={editing ? editReview : writeReview} submitLabel={editing ? "Save changes" : "Publish review"} label={editing ? "Edit your review" : "Write a review"}>
      {editing ? <input type="hidden" name="reviewId" value={review.id} /> : <input type="hidden" name="orderItemId" value={orderItemId} />}
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm font-medium text-ink">
          Your rating<span aria-hidden="true"> *</span>
        </legend>
        {STAR_LABELS.map((label, i) => (
          <Radio key={label} name="rating" value={i + 1} defaultChecked={review?.rating === i + 1} required>
            {label}
          </Radio>
        ))}
      </fieldset>
      <Field name="title" label="Title (optional)" defaultValue={review?.title ?? ""} hint="For example: Fast and quiet" />
      <Field
        as="textarea"
        name="text"
        label="Your review (optional)"
        rows={5}
        defaultValue={review?.text ?? ""}
        hint="What did you like or dislike? Don't include phone numbers or personal details."
      />
    </ActionForm>
  );
}
