"use server";

import { refresh } from "next/cache";
import { formString, runAction, type ActionResult } from "@/lib/actions";
import { requirePlatformAdmin, requireShopRole, requireUser } from "@/lib/auth";
import { reviewService } from "./server";

/*
 * Server actions behind the review forms. Each checks the caller first (requireUser /
 * requirePlatformAdmin / requireShopRole); ids from the form are only used through the scoped
 * service after that. The JSON API (api.ts) runs the same service.
 */

const values = (formData: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, formString(formData, k)]));

/** Customer: write a review of a delivered order item. */
export async function writeReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const input = values(formData, ["orderItemId", "rating", "title", "text"]);
  return runAction(
    async () => {
      const user = await requireUser();
      await reviewService.create(user.id, input);
      refresh();
      return "Thank you! Your review is published on the product page.";
    },
    { values: input },
  );
}

/** Customer: edit their review (30 days). */
export async function editReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const input = values(formData, ["rating", "title", "text"]);
  return runAction(
    async () => {
      const user = await requireUser();
      await reviewService.update(user.id, formString(formData, "reviewId"), input);
      refresh();
      return "Your review is updated.";
    },
    { values: input },
  );
}

/** Platform Admin: hide a review with a reason. */
export async function hideReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    await reviewService.hide(admin.id, formString(formData, "reviewId"), { reason: formString(formData, "reason") });
    refresh();
    return "Review hidden. The reason is in the audit log.";
  });
}

/** Platform Admin: show a hidden review again, with a reason. */
export async function unhideReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    await reviewService.unhide(admin.id, formString(formData, "reviewId"), { reason: formString(formData, "reason") });
    refresh();
    return "Review shown again. The reason is in the audit log.";
  });
}

/** Shop owner or staff: reply publicly to a review of the shop's product. */
export async function replyToReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const input = values(formData, ["text"]);
  return runAction(
    async () => {
      const access = await requireShopRole(formString(formData, "shopId"), ["owner", "staff"]);
      await reviewService.reply(access.shopId, access.user.id, formString(formData, "reviewId"), input);
      refresh();
      return "Reply published.";
    },
    { values: input },
  );
}
