import type { CartAdder } from "@/features/wishlist";
import type { DeliveryZone } from "@/lib/delivery";
import { CartError, readJson, respond } from "./errors";
import { buildCart, cartReadyForCheckout, type ZoneSource } from "./model";
import type { CartOwner, CartService, ItemResult, MergeResult } from "./service";

/**
 * JSON API of the cart (guests and logged-in customers; the owner always comes from the session
 * or the guest cookie, never from the request):
 *   GET    /api/cart?zone=inside_dhaka|outside_dhaka -> { cart, readiness, zone: { zone, source } }
 *   POST   /api/cart/items         { variantId, quantity? } -> 201 { item, capped, message, count } (200 if it was already there)
 *   PATCH  /api/cart/items/[id]    { quantity?, savedForLater?, acknowledgePrice? } -> { item, capped, message, count }
 *   DELETE /api/cart/items/[id]    -> { ok: true, count }
 *   POST   /api/cart/merge         (logged in) -> { moved, combined, messages, count }
 *   POST   /api/wishlist/[itemId]/move-to-cart { variantId?, quantity? } (logged in) -> { productId, variantId, item, capped, message, count }
 * Errors use { error: { code, message, fields? } }; another owner's row is a 404.
 */

type MoveToCart = (
  userId: string,
  itemId: string,
  addToCart: CartAdder,
  opts?: { variantId?: string; quantity?: number },
) => Promise<{ productId: string; variantId: string }>;

export interface CartApiDeps {
  resolveOwner: (opts: { create?: boolean; writable: boolean }) => Promise<CartOwner | null>;
  requireUser: () => Promise<{ id: string }>;
  resolveZone: (owner: CartOwner | null, override?: unknown) => Promise<{ zone: DeliveryZone; source: ZoneSource }>;
  mergeGuestCart: (userId: string) => Promise<MergeResult | null>;
  moveToCart: MoveToCart;
  service: Pick<CartService, "getCart" | "addItem" | "updateItem" | "removeItem" | "countItems">;
}

const notFound = () => new CartError(404, "NOT_FOUND", "Cart item not found");
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function createCartApi(deps: CartApiDeps) {
  const { service } = deps;

  return {
    get: (req: Request) =>
      respond(async () => {
        const owner = await deps.resolveOwner({ writable: true });
        const param = new URL(req.url).searchParams.get("zone");
        const zone = await deps.resolveZone(owner, param ?? undefined);
        const cart = owner ? await service.getCart(owner, zone.zone) : buildCart([], { zone: zone.zone, today: new Date() });
        return { cart, readiness: cartReadyForCheckout(cart), zone };
      }),

    add: (req: Request) =>
      respond(async () => {
        const body = await readJson(req);
        const owner = (await deps.resolveOwner({ create: true, writable: true }))!;
        const result = await service.addItem(owner, body);
        return Response.json(
          { item: result.item, capped: result.capped, message: result.message, count: await service.countItems(owner) },
          { status: result.created ? 201 : 200 },
        );
      }),

    update: (req: Request, itemId: string) =>
      respond(async () => {
        const body = await readJson(req);
        const owner = await deps.resolveOwner({ writable: true });
        if (!owner) throw notFound();
        const result = await service.updateItem(owner, itemId, body);
        return { ...result, count: await service.countItems(owner) };
      }),

    remove: (itemId: string) =>
      respond(async () => {
        const owner = await deps.resolveOwner({ writable: true });
        if (!owner) throw notFound();
        await service.removeItem(owner, itemId);
        return { ok: true, count: await service.countItems(owner) };
      }),

    merge: () =>
      respond(async () => {
        const user = await deps.requireUser();
        const result = (await deps.mergeGuestCart(user.id)) ?? { moved: 0, combined: 0, messages: [] };
        return { ...result, count: await service.countItems({ kind: "user", userId: user.id }) };
      }),

    moveToCart: (req: Request, wishlistItemId: string) =>
      respond(async () => {
        const user = await deps.requireUser();
        const body = await readJson(req);
        const input = isRecord(body) ? body : {};
        const opts: { variantId?: string; quantity?: number } = {};
        if (input.variantId !== undefined) {
          if (typeof input.variantId !== "string") {
            throw new CartError(422, "VALIDATION", "Invalid variant", { variantId: "Invalid variant" });
          }
          opts.variantId = input.variantId;
        }
        if (input.quantity !== undefined) {
          if (typeof input.quantity !== "number") {
            throw new CartError(422, "VALIDATION", "Quantity must be a number", { quantity: "Quantity must be a number" });
          }
          opts.quantity = input.quantity;
        }
        const owner: CartOwner = { kind: "user", userId: user.id };
        const box: { added?: ItemResult } = {};
        const moved = await deps.moveToCart(
          user.id,
          wishlistItemId,
          async (line) => {
            // The adder only ever writes to the logged-in user's own cart.
            const result = await service.addItem(owner, { variantId: line.variantId, quantity: line.quantity });
            box.added = { item: result.item, capped: result.capped, message: result.message };
          },
          opts,
        );
        const { added } = box;
        return {
          ...moved,
          item: added?.item,
          capped: added?.capped ?? false,
          message: added?.capped ? `Moved to your cart. ${added.message}` : "Moved to your cart.",
          count: await service.countItems(owner),
        };
      }),
  };
}
