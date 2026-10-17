import { requirePlatformAdmin, requireShopRole } from "@/lib/auth";
import { appUrl, sendMail } from "@/lib/mail";
import { createPayoutsApi } from "./api";
import { getPayoutConfig } from "./ledger";
import * as repo from "./repo";
import { createPayoutService, runPayoutDueCheck } from "./service";

/**
 * The payouts feature wired to Prisma, the guards and email. Pages, route handlers, the worker and
 * the order lifecycle (COD collection on delivery) use these.
 */

export const payoutService = createPayoutService({ store: repo, config: getPayoutConfig(), now: () => new Date() });

export const payoutsApi = createPayoutsApi({
  requireShopOwner: (shopId) => requireShopRole(shopId, ["owner"]),
  requireAdmin: requirePlatformAdmin,
  service: payoutService,
});

/** Admin page: delivered shop orders whose collection is not recorded yet (call after requirePlatformAdmin). */
export const deliveredWithoutCollection = () => repo.deliveredWithoutCollection();

export { getPayoutConfig };

/** The daily payouts.due-check job. */
export function checkPayoutsDue(now = new Date()) {
  return runPayoutDueCheck(now, getPayoutConfig(), {
    unpaidDueBefore: repo.unpaidCollectionsDueBefore,
    adminEmails: repo.adminEmails,
    sendMail,
    adminUrl: () => appUrl("/admin/payouts"),
  });
}

/**
 * Order lifecycle hook (in the "delivered" transaction): in auto mode, a delivered shop order's
 * cash is recorded as collected, due to the shop within 10 days. Manual mode leaves it to the admin.
 */
export async function recordCollectionOnDelivery(
  tx: repo.Tx,
  event: { shopOrderId: string; to: string; at: Date; actorId: string | null },
): Promise<void> {
  const config = getPayoutConfig();
  if (event.to !== "delivered" || config.collectionMode !== "auto") return;
  await repo.recordCollectionTx(tx, {
    shopOrderId: event.shopOrderId,
    collectedAt: event.at,
    recordedById: event.actorId,
    source: "auto_on_delivery",
    payoutDays: config.payoutDays,
  });
}
