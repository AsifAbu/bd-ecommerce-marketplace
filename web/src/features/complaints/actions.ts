"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formString, runAction, type ActionResult } from "@/lib/actions";
import { requirePlatformAdmin, requireShopRole } from "@/lib/auth";
import * as repo from "./repo";
import { ComplaintError } from "./rules";
import { complaintsService, currentUserId, customerOrder } from "./server";

/*
 * Server actions behind the complaint pages. Each checks the caller first (order access through
 * the account or the guest order grant, shop membership, or Platform Admin).
 */

/** US-072: open a complaint about an order; goes to the ticket page. */
export async function openComplaintAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const order = await customerOrder(formString(formData, "orderNo").toUpperCase());
    if (!order) throw new ComplaintError(404, "NOT_FOUND", "Order not found");
    const ticket = await complaintsService.open(order.id, await currentUserId(), {
      shopOrderId: formString(formData, "shopOrderId"),
      subject: formString(formData, "subject"),
      category: formString(formData, "category"),
      message: formString(formData, "message"),
    });
    redirect(`/complaints/${ticket.id}?opened=1`);
  });
}

export async function customerReplyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const id = formString(formData, "ticketId");
    const orderNo = await repo.orderNoOf(id);
    const order = orderNo ? await customerOrder(orderNo) : null;
    if (!order) throw new ComplaintError(404, "NOT_FOUND", "Complaint not found");
    await complaintsService.reply({ kind: "order", orderId: order.id }, { role: "customer", id: await currentUserId() }, id, formString(formData, "text"));
    refresh();
    return "Message sent.";
  });
}

export async function shopReplyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const access = await requireShopRole(formString(formData, "shopId"), ["owner", "staff"]);
    await complaintsService.reply({ kind: "shop", shopId: access.shopId }, { role: "shop", id: access.user.id }, formString(formData, "ticketId"), formString(formData, "text"));
    refresh();
    return "Reply sent. The customer is informed.";
  });
}

/** Platform Admin: reply, start, resolve or close (resolve and close need the resolution). */
export async function adminComplaintAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const id = formString(formData, "ticketId");
    const action = formString(formData, "action");
    if (action === "reply") {
      await complaintsService.reply({ kind: "admin" }, { role: "admin", id: admin.id }, id, formString(formData, "text"));
      refresh();
      return "Reply sent. The customer is informed.";
    }
    if (action !== "start" && action !== "resolve" && action !== "close") throw new ComplaintError(422, "VALIDATION", "Unknown action");
    const { status } = await complaintsService.adminUpdate(admin.id, id, action, formString(formData, "resolution"));
    refresh();
    return status === "in_progress" ? "Marked as in progress. The customer is informed." : `Complaint ${status}. The customer is informed.`;
  });
}
