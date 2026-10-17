"use client";

import { useId } from "react";
import { ActionForm, Field } from "@/components/action-form";
import { requestReturnAction } from "../actions";

/**
 * US-070: the return request form for one order item: how many, why (only the reasons the
 * listing allows), details and up to 4 photos. The server checks everything again.
 */
export function ReturnRequestForm({
  orderNo,
  orderItemId,
  maxQuantity,
  reasons,
  photosRequired,
}: {
  orderNo: string;
  orderItemId: string;
  maxQuantity: number;
  reasons: { value: string; label: string }[];
  /** Production: a photo is required for damaged, wrong and not-as-described items. */
  photosRequired: boolean;
}) {
  const id = useId();
  return (
    <ActionForm action={requestReturnAction} submitLabel="Send return request" label="Request a return" listFieldErrors>
      <input type="hidden" name="orderNo" value={orderNo} />
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <Field
        as="select"
        name="quantity"
        label="How many to return"
        required
        defaultValue={maxQuantity === 1 ? "1" : ""}
        options={Array.from({ length: maxQuantity }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
      />
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">
          Reason<span aria-hidden="true"> *</span>
        </legend>
        {reasons.map((r) => (
          <label key={r.value} className="flex items-center gap-2">
            <input type="radio" name="reason" value={r.value} required />
            {r.label}
          </label>
        ))}
      </fieldset>
      <Field as="textarea" name="details" label="What is wrong?" hint="Required for “Something else”. Up to 1,000 characters." rows={4} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-photos`} className="font-medium">
          Photos{photosRequired ? " (required for damaged, wrong or not-as-described items)" : " (optional)"}
        </label>
        <p id={`${id}-photos-hint`} className="text-sm text-gray-700">
          Up to 4 JPEG, PNG or WebP photos, 5 MB each.
        </p>
        <input
          id={`${id}-photos`}
          name="photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-describedby={`${id}-photos-hint`}
          className="text-sm"
        />
      </div>
    </ActionForm>
  );
}
