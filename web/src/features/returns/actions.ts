"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formString, runAction, type ActionResult } from "@/lib/actions";
import { requirePlatformAdmin, requireShopRole } from "@/lib/auth";
import { ReturnError } from "./errors";
import type { PhotoFile } from "./photos";
import * as repo from "./repo";
import type { ReturnScope } from "./service";
import { currentUserId, customerOrder, returnsService } from "./server";

/*
 * Server actions behind the return pages. Each checks the caller first (order access through the
 * order grant or the account, shop membership, or Platform Admin); ids from the form are only
 * looked up inside that scope.
 */

const photosOf = (formData: FormData): PhotoFile[] =>
  formData
    .getAll("photos")
    .filter((v): v is File => typeof v !== "string")
    .map((f) => ({ name: f.name, type: f.type, size: f.size, bytes: async () => new Uint8Array(await f.arrayBuffer()) }));

async function customerScope(returnId: string): Promise<ReturnScope> {
  const orderNo = await repo.orderNoOf(returnId);
  const order = orderNo ? await customerOrder(orderNo) : null;
  if (!order) throw new ReturnError(404, "NOT_FOUND", "Return request not found");
  return { kind: "order", orderId: order.id };
}

/** US-070: ask for a return from the order page (account or guest with the order open). */
export async function requestReturnAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const order = await customerOrder(formString(formData, "orderNo").toUpperCase());
    if (!order) throw new ReturnError(404, "NOT_FOUND", "Order not found");
    const result = await returnsService.request(order.id, await currentUserId(), {
      orderItemId: formString(formData, "orderItemId"),
      quantity: formString(formData, "quantity"),
      reason: formString(formData, "reason"),
      details: formString(formData, "details"),
      photos: photosOf(formData),
    });
    redirect(`/orders/${order.orderNo}?return=requested${result.warning ? "&photos=unsaved" : ""}#returns`);
  });
}

export async function cancelReturnAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const id = formString(formData, "returnId");
    await returnsService.cancel(await customerScope(id), await currentUserId(), id);
    refresh();
    return "Return request cancelled.";
  });
}

export async function disputeReturnAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const id = formString(formData, "returnId");
    await returnsService.dispute(await customerScope(id), await currentUserId(), id, formString(formData, "note"));
    refresh();
    return "Sent to the marketplace admin, who will decide.";
  });
}

const refundInput = (formData: FormData) => ({
  method: formString(formData, "method"),
  reference: formString(formData, "reference"),
  amount: formString(formData, "amount"),
  restock: formString(formData, "restock"),
});

/** US-071: the shop accepts, rejects, marks received or records the refund. */
export async function shopReturnAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const access = await requireShopRole(formString(formData, "shopId"), ["owner", "staff"]);
    const id = formString(formData, "returnId");
    const scope: ReturnScope = { kind: "shop", shopId: access.shopId };
    const action = formString(formData, "action");
    let message: string;
    if (action === "accept") {
      await returnsService.accept(access.shopId, access.user.id, id, formString(formData, "note"));
      message = "Return accepted. Collect the item, then record the refund.";
    } else if (action === "reject") {
      await returnsService.reject(access.shopId, access.user.id, id, formString(formData, "note"));
      message = "Return rejected. The customer can ask the admin to decide.";
    } else if (action === "receive") {
      await returnsService.receive(scope, access.user.id, id, formString(formData, "restock"));
      message = "Marked as received.";
    } else if (action === "refund") {
      const money = await returnsService.refund(scope, access.user.id, id, refundInput(formData));
      message = `Refund of Tk ${money.amount} recorded. The customer is notified.`;
    } else {
      throw new ReturnError(422, "VALIDATION", "Unknown action");
    }
    refresh();
    return message;
  });
}

/** The admin decides escalated returns (and may record a refund: the platform holds COD money). */
export async function adminReturnAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const id = formString(formData, "returnId");
    const action = formString(formData, "action");
    let message: string;
    if (action === "approve" || action === "deny") {
      await returnsService.decide(admin.id, id, action, formString(formData, "note"));
      message = action === "approve" ? "Return approved. The shop collects the item and refunds." : "Return denied.";
    } else if (action === "receive") {
      await returnsService.receive({ kind: "admin" }, admin.id, id, formString(formData, "restock"));
      message = "Marked as received.";
    } else if (action === "refund") {
      const money = await returnsService.refund({ kind: "admin" }, admin.id, id, refundInput(formData));
      message = `Refund of Tk ${money.amount} recorded. The customer is notified.`;
    } else {
      throw new ReturnError(422, "VALIDATION", "Unknown action");
    }
    refresh();
    return message;
  });
}
