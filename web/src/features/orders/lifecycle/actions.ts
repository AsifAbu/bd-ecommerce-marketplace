"use server";

import { refresh } from "next/cache";
import { currentUserOrNull } from "@/features/cart/server";
import { formString, runAction, type ActionResult } from "@/lib/actions";
import { requirePlatformAdmin, requireShopRole } from "@/lib/auth";
import { viewableOrder } from "../server";
import { parseAction, type LifecycleAction } from "./machine";
import { lifecycle } from "./server";
import type { ShopOrderTransitionEvent } from "./service";

/*
 * Server actions behind the lifecycle buttons. Every action runs its guard first; the shop order
 * id from the form is only looked up inside the checked scope (shop, order or admin).
 */

const DONE: Record<LifecycleAction, string> = {
  confirm: "Order confirmed.",
  pack: "Marked packed.",
  hand_over: "Handed over to the courier. The customer gets an SMS with the tracking number.",
  deliver: "Marked delivered.",
  refuse: "Marked refused. Mark it returned when the parcel is back.",
  cancel: "Order cancelled. The items are back in stock.",
  mark_returned: "Marked returned.",
};

function message(event: ShopOrderTransitionEvent): string {
  if (event.action === "mark_returned") return event.restocked ? "Marked returned. The items are back in stock." : DONE.mark_returned;
  return DONE[event.action];
}

const input = (formData: FormData) => ({
  reason: formString(formData, "reason"),
  courierName: formString(formData, "courierName"),
  trackingNo: formString(formData, "trackingNo"),
});

const values = (formData: FormData) => ({ courierName: formString(formData, "courierName"), trackingNo: formString(formData, "trackingNo"), reason: formString(formData, "reason") });

/** Shop owner or staff: confirm, pack, hand over, deliver/refuse (test mode), cancel, mark returned. */
export async function shopOrderAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      const access = await requireShopRole(formString(formData, "shopId"), ["owner", "staff"]);
      const event = await lifecycle.asShop(
        { shopId: access.shopId, role: access.role, userId: access.user.id },
        formString(formData, "shopOrderId"),
        parseAction(formString(formData, "action")),
        input(formData),
      );
      refresh();
      return message(event);
    },
    { values: values(formData) },
  );
}

/** Platform Admin: any transition the machine allows (records deliveries until a courier feed exists). */
export async function adminOrderAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      const admin = await requirePlatformAdmin();
      const event = await lifecycle.asAdmin(admin.id, formString(formData, "shopOrderId"), parseAction(formString(formData, "action")), input(formData));
      refresh();
      return message(event);
    },
    { values: values(formData) },
  );
}

/** The customer (own order, or a guest holding the order's OTP grant) cancels before the shop confirms. */
export async function customerCancelAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const order = await viewableOrder(formString(formData, "orderNo"));
    const user = await currentUserOrNull();
    await lifecycle.cancelAsCustomer(order, user?.id ?? null, formString(formData, "shopOrderId"), formString(formData, "reason"));
    refresh();
    return "Your order is cancelled. Nothing to pay.";
  });
}
