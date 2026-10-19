"use client";

import { useId } from "react";
import { ActionForm, Field } from "@/components/action-form";
import { Radio } from "@/components/ui";
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
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm font-medium text-ink">
          Reason<span aria-hidden="true"> *</span>
        </legend>
        {reasons.map((r) => (
          <Radio key={r.value} name="reason" value={r.value} required>
            {r.label}
          </Radio>
        ))}
      </fieldset>
      <Field as="textarea" name="details" label="What is wrong?" hint="Required for “Something else”. Up to 1,000 characters." rows={4} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-photos`} className="text-sm font-medium text-ink">
          Photos{photosRequired ? " (required for damaged, wrong or not-as-described items)" : " (optional)"}
        </label>
        <p id={`${id}-photos-hint`} className="text-sm text-muted">
          Up to 4 JPEG, PNG or WebP photos, 5 MB each.
        </p>
        <input
          id={`${id}-photos`}
          name="photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-describedby={`${id}-photos-hint`}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border file:border-edge file:bg-paper file:px-4 file:font-medium file:text-ink hover:file:bg-surface"
        />
      </div>
    </ActionForm>
  );
}
