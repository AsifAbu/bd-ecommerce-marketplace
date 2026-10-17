import { readJson, respond } from "./errors";
import type { PayoutService } from "./service";

/**
 * JSON API of the payout ledger (standard error shape `{ error: { code, message, fields? } }`):
 *
 *   GET  /api/shops/[shopId]/payouts             shop owner only -> { collections, payouts, totals, deliveryChargesTo }
 *   GET  /api/admin/payouts                      admin -> { due, pending, recent }
 *   POST /api/admin/payouts                      admin { shopId } -> 201 { payout }  (batch of the shop's unpaid collections)
 *   POST /api/admin/payouts/[payoutId]/paid      admin { method, reference } -> { ok }
 *   POST /api/admin/payouts/[payoutId]/cancel    admin { reason } -> { ok }
 *   POST /api/admin/cod-collections              admin { shopOrderId } -> 201 { collection }  (record by hand)
 *
 * Amounts are in paisa. Every handler runs its guard before touching data.
 */

export interface PayoutsApiDeps {
  /** requireShopRole(shopId, ["owner"]): staff and other shops get 403. */
  requireShopOwner(shopId: string): Promise<{ shopId: string }>;
  /** requirePlatformAdmin(): 401/403 otherwise. */
  requireAdmin(): Promise<{ id: string }>;
  service: PayoutService;
}

export function createPayoutsApi(deps: PayoutsApiDeps) {
  return {
    shopLedger: (shopId: string) =>
      respond(async () => {
        const access = await deps.requireShopOwner(shopId);
        return deps.service.shopLedger(access.shopId);
      }),

    adminOverview: () =>
      respond(async () => {
        await deps.requireAdmin();
        return deps.service.adminOverview();
      }),

    createBatch: (req: Request) =>
      respond(async () => {
        const admin = await deps.requireAdmin();
        return Response.json({ payout: await deps.service.createBatch(admin.id, await readJson(req)) }, { status: 201 });
      }),

    markPaid: (req: Request, payoutId: string) =>
      respond(async () => {
        const admin = await deps.requireAdmin();
        await deps.service.markPaid(admin.id, payoutId, await readJson(req));
        return { ok: true };
      }),

    cancel: (req: Request, payoutId: string) =>
      respond(async () => {
        const admin = await deps.requireAdmin();
        await deps.service.cancel(admin.id, payoutId, await readJson(req));
        return { ok: true };
      }),

    recordCollection: (req: Request) =>
      respond(async () => {
        const admin = await deps.requireAdmin();
        return Response.json({ collection: await deps.service.recordCollection(admin.id, await readJson(req)) }, { status: 201 });
      }),
  };
}

export type PayoutsApi = ReturnType<typeof createPayoutsApi>;
