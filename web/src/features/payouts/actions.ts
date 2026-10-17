"use server";

import { refresh } from "next/cache";
import { formString, runAction, type ActionResult } from "@/lib/actions";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatPaisa } from "./money";
import { payoutService } from "./server";

/* Admin payout actions (US-082). Each checks requirePlatformAdmin first. */

export async function createPayoutAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const payout = await payoutService.createBatch(admin.id, { shopId: formString(formData, "shopId") });
    refresh();
    return `Payout created: ${formatPaisa(payout.net)} for ${payout.collectionCount} ${payout.collectionCount === 1 ? "order" : "orders"}. Send the money, then mark it paid.`;
  });
}

export async function markPayoutPaidAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const values = { method: formString(formData, "method"), reference: formString(formData, "reference") };
  return runAction(
    async () => {
      const admin = await requirePlatformAdmin();
      await payoutService.markPaid(admin.id, formString(formData, "payoutId"), values);
      refresh();
      return "Payout marked paid.";
    },
    { values },
  );
}

export async function cancelPayoutAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const values = { reason: formString(formData, "reason") };
  return runAction(
    async () => {
      const admin = await requirePlatformAdmin();
      await payoutService.cancel(admin.id, formString(formData, "payoutId"), values);
      refresh();
      return "Payout cancelled. Its collections are free for the next payout.";
    },
    { values },
  );
}

export async function recordCollectionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    await payoutService.recordCollection(admin.id, { shopOrderId: formString(formData, "shopOrderId") });
    refresh();
    return "Cash collection recorded.";
  });
}
