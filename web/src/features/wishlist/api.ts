import { readJson, respond } from "./errors";
import type { WishlistService } from "./service";

/**
 * JSON API of the wishlist (logged-in customers only; guests get 401):
 *   GET    /api/wishlist           -> { items: WishlistItemView[] }
 *   POST   /api/wishlist           { productId, variantId? } -> 201 { item, created: true } | 200 if already saved
 *   DELETE /api/wishlist/[itemId]  -> { ok: true } | 404
 * Errors use { error: { code, message, fields? } }.
 */
export function createWishlistApi(deps: {
  requireUser: () => Promise<{ id: string }>;
  service: Pick<WishlistService, "listItems" | "addItem" | "removeItem">;
}) {
  return {
    list: () =>
      respond(async () => {
        const user = await deps.requireUser();
        return { items: await deps.service.listItems(user.id) };
      }),

    add: (req: Request) =>
      respond(async () => {
        const user = await deps.requireUser();
        const { item, created } = await deps.service.addItem(user.id, await readJson(req));
        return Response.json({ item: { id: item.id, variantId: item.variantId }, created }, { status: created ? 201 : 200 });
      }),

    remove: (itemId: string) =>
      respond(async () => {
        const user = await deps.requireUser();
        await deps.service.removeItem(user.id, itemId);
        return { ok: true };
      }),
  };
}
