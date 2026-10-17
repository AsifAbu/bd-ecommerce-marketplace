import type { CategorySchema } from "@/features/catalog";
import { variantLabel } from "@/features/products";
import { dhakaToday } from "@/features/shops";
import type { DeliveryRates, DeliveryZone } from "@/lib/delivery";
import { CartError } from "./errors";
import {
  buildCart,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  quantityLimit,
  rawVariantLabel,
  type Cart,
  type CartRow,
  type Money,
} from "./model";

/**
 * Cart use cases (US-050, US-056, US-058; US-057 move-to-cart) with injected dependencies.
 * Every repo call is scoped by the owner: the guard-checked user, or the guest device whose
 * token comes from the httpOnly cookie. Callers never pass an owner taken from the request body.
 *
 * Acceptance criteria covered here:
 * - add needs a live listing with stock; the quantity is capped at the stock with a message;
 * - change quantity (capped), remove, save for later and move back;
 * - accept a changed price (acknowledgePrice) so checkout can continue;
 * - a guest cart merges into the user's cart at login (quantities added, capped at stock).
 */

export type CartOwner = { kind: "user"; userId: string } | { kind: "guest"; guestToken: string };

/** A stored row without the joined listing data. */
export interface StoredItem {
  id: string;
  productId: string;
  variantId: string;
  shopId: string;
  quantity: number;
  savedForLater: boolean;
  priceAtAdd: Money;
  updatedAt: Date;
}

/** A variant of a live listing, for adding to the cart. */
export interface VariantForCart {
  id: string;
  productId: string;
  shopId: string;
  price: Money;
  stock: number;
}

export interface NewItem {
  productId: string;
  variantId: string;
  shopId: string;
  quantity: number;
  priceAtAdd: string;
  savedForLater?: boolean;
}

export type ItemChanges = Partial<{ quantity: number; savedForLater: boolean; priceAtAdd: string }>;

export interface CartRepo {
  listItems(owner: CartOwner): Promise<CartRow[]>;
  getItem(owner: CartOwner, itemId: string): Promise<CartRow | null>;
  findByVariant(owner: CartOwner, variantId: string): Promise<StoredItem | null>;
  countLines(owner: CartOwner): Promise<number>;
  /** Units in the cart (not saved for later), for the header. */
  sumQuantity(owner: CartOwner): Promise<number>;
  createItem(owner: CartOwner, data: NewItem): Promise<StoredItem>;
  /** False when the row isn't the owner's. */
  updateItem(owner: CartOwner, itemId: string, data: ItemChanges): Promise<boolean>;
  deleteItem(owner: CartOwner, itemId: string): Promise<boolean>;
  deleteItems(owner: CartOwner, itemIds: string[]): Promise<number>;
  /** Moves one guest row to the user (login merge). False when it isn't that guest's. */
  reassignToUser(guestToken: string, itemId: string, userId: string): Promise<boolean>;
  /** The variant when its listing is live (public data); null otherwise. */
  findLiveVariant(variantId: string, today: Date): Promise<VariantForCart | null>;
}

export interface CartDeps {
  repo: CartRepo;
  getCategorySchema: (categoryId: string) => Promise<CategorySchema>;
  now: () => Date;
  rates?: DeliveryRates;
}

export interface ItemResult {
  item: { id: string; variantId: string; quantity: number; savedForLater: boolean };
  /** True when the quantity was lowered to the stock (or the per-item limit). */
  capped: boolean;
  message: string;
}

export interface MergeResult {
  /** Guest rows moved to the user as they were. */
  moved: number;
  /** Guest rows added to a row the user already had. */
  combined: number;
  /** One per row whose quantity was capped. */
  messages: string[];
}

const ID_MAX = 64;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= ID_MAX;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const priceText = (m: Money) => Number(m.toString()).toFixed(2);

function parseQuantity(value: unknown, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new CartError(422, "VALIDATION", "Quantity must be a whole number of at least 1", {
      quantity: "Quantity must be a whole number of at least 1",
    });
  }
  // Very large numbers are capped like any other quantity above the stock.
  return Math.min(value, 1_000_000);
}

/** The message for a quantity that had to be lowered. */
function capMessage(stock: number, quantity: number): string {
  return quantity === stock
    ? `Only ${stock} in stock. Quantity set to ${quantity}.`
    : `You can buy up to ${MAX_LINE_QUANTITY} of one item. Quantity set to ${quantity}.`;
}

export function createCartService(deps: CartDeps) {
  const { repo } = deps;
  const today = () => dhakaToday(deps.now());

  /** Variant labels ("Size: M, Colour: Black") from each category's schema, cached per call. */
  async function labeller(rows: CartRow[]): Promise<(row: CartRow) => string | null> {
    const schemas = new Map<string, CategorySchema | null>();
    for (const categoryId of new Set(rows.map((r) => r.product.categoryId))) {
      schemas.set(categoryId, await deps.getCategorySchema(categoryId).catch(() => null));
    }
    return (row) => {
      const options = row.variant.options;
      if (!isRecord(options) || Object.keys(options).length === 0) return null;
      const axes = schemas.get(row.product.categoryId)?.fields.filter((f) => f.isVariantAxis) ?? [];
      return axes.length ? variantLabel(options, axes) : rawVariantLabel(options);
    };
  }

  /**
   * GET /api/cart and the /cart page: re-checks every line against the current price and stock.
   * Quantities above the stock are lowered and saved (the line shows why).
   */
  async function getCart(owner: CartOwner, zone: DeliveryZone): Promise<Cart> {
    const rows = await repo.listItems(owner);
    const cart = buildCart(rows, { zone, today: today(), rates: deps.rates, labelOf: await labeller(rows) });
    for (const { id, quantity } of cart.adjustments) await repo.updateItem(owner, id, { quantity });
    return cart;
  }

  /** POST /api/cart/items { variantId, quantity? = 1 }: adds to the cart (or adds to the quantity). */
  async function addItem(owner: CartOwner, body: unknown): Promise<ItemResult & { created: boolean }> {
    const input = isRecord(body) ? body : {};
    if (!isId(input.variantId)) {
      throw new CartError(422, "VARIANT_REQUIRED", "Choose a variant (for example size or colour) first", {
        variantId: "Choose a variant",
      });
    }
    const wanted = parseQuantity(input.quantity, 1);
    const variant = await repo.findLiveVariant(input.variantId, today());
    if (!variant) throw new CartError(404, "NOT_FOUND", "This product is not available");
    if (variant.stock <= 0) throw new CartError(409, "OUT_OF_STOCK", "This item is out of stock");

    const limit = quantityLimit(variant.stock);
    const existing = await repo.findByVariant(owner, variant.id);
    const before = existing ? existing.quantity : 0;
    const quantity = Math.min(before + wanted, limit);
    const capped = quantity < before + wanted;
    // The customer just saw the current price on the product page.
    const priceAtAdd = priceText(variant.price);

    let message: string;
    if (capped && existing && quantity <= before) {
      message = `You already have ${quantity} in your cart, the most you can buy now.`;
    } else if (capped) {
      message = `${capMessage(variant.stock, quantity)} Added to your cart.`;
    } else {
      message = existing && !existing.savedForLater ? `Added. You now have ${quantity} in your cart.` : "Added to your cart.";
    }

    if (existing) {
      await repo.updateItem(owner, existing.id, { quantity, savedForLater: false, priceAtAdd });
      return { item: { id: existing.id, variantId: variant.id, quantity, savedForLater: false }, capped, message, created: false };
    }
    if ((await repo.countLines(owner)) >= MAX_CART_LINES) {
      throw new CartError(409, "CART_FULL", `Your cart can hold up to ${MAX_CART_LINES} items. Remove some first.`);
    }
    try {
      const item = await repo.createItem(owner, {
        productId: variant.productId,
        variantId: variant.id,
        shopId: variant.shopId,
        quantity,
        priceAtAdd,
      });
      return { item: { id: item.id, variantId: variant.id, quantity, savedForLater: false }, capped, message, created: true };
    } catch (err) {
      // Added twice at once (unique owner + variant): add to the row that won.
      const again = await repo.findByVariant(owner, variant.id);
      if (!again) throw err;
      const total = Math.min(again.quantity + wanted, limit);
      await repo.updateItem(owner, again.id, { quantity: total, savedForLater: false, priceAtAdd });
      return { item: { id: again.id, variantId: variant.id, quantity: total, savedForLater: false }, capped, message, created: false };
    }
  }

  /**
   * PATCH /api/cart/items/[id] { quantity?, savedForLater?, acknowledgePrice? }.
   * 404 when the row isn't the owner's.
   */
  async function updateItem(owner: CartOwner, itemId: string, body: unknown): Promise<ItemResult> {
    const input = isRecord(body) ? body : {};
    const hasQuantity = input.quantity !== undefined;
    const hasSaved = input.savedForLater !== undefined;
    const acknowledge = input.acknowledgePrice === true;
    if (hasSaved && typeof input.savedForLater !== "boolean") {
      throw new CartError(422, "VALIDATION", "savedForLater must be true or false", { savedForLater: "Must be true or false" });
    }
    if (input.acknowledgePrice !== undefined && typeof input.acknowledgePrice !== "boolean") {
      throw new CartError(422, "VALIDATION", "acknowledgePrice must be true or false", { acknowledgePrice: "Must be true or false" });
    }
    if (!hasQuantity && !hasSaved && !acknowledge) {
      throw new CartError(422, "VALIDATION", "Nothing to change: send quantity, savedForLater or acknowledgePrice");
    }
    const requested = hasQuantity ? parseQuantity(input.quantity) : undefined;

    const row = isId(itemId) ? await repo.getItem(owner, itemId) : null;
    if (!row) throw new CartError(404, "NOT_FOUND", "Cart item not found");

    const changes: ItemChanges = {};
    let quantity = row.quantity;
    let capped = false;
    const messages: string[] = [];
    const savedForLater = hasSaved ? (input.savedForLater as boolean) : row.savedForLater;
    const stock = Math.max(0, row.variant.stock);

    if (requested !== undefined) {
      if (stock <= 0) throw new CartError(409, "OUT_OF_STOCK", "This item is out of stock");
      quantity = Math.min(requested, quantityLimit(stock));
      capped = quantity < requested;
      changes.quantity = quantity;
      messages.push(capped ? capMessage(stock, quantity) : `Quantity set to ${quantity}.`);
    }
    if (hasSaved && savedForLater !== row.savedForLater) {
      changes.savedForLater = savedForLater;
      if (!savedForLater && stock > 0 && quantity > quantityLimit(stock)) {
        // Moving back to the cart: the quantity has to fit the stock again.
        quantity = quantityLimit(stock);
        capped = true;
        changes.quantity = quantity;
        messages.push(capMessage(stock, quantity));
      }
      messages.push(savedForLater ? "Saved for later. It is no longer in your cart totals." : "Moved back to your cart.");
    }
    if (acknowledge) {
      changes.priceAtAdd = priceText(row.variant.price);
      messages.push("New price accepted.");
    }

    if (Object.keys(changes).length > 0 && !(await repo.updateItem(owner, row.id, changes))) {
      throw new CartError(404, "NOT_FOUND", "Cart item not found");
    }
    return {
      item: { id: row.id, variantId: row.variantId, quantity, savedForLater },
      capped,
      message: messages.join(" ") || "No changes.",
    };
  }

  /** DELETE /api/cart/items/[id]: 404 when the row isn't the owner's. */
  async function removeItem(owner: CartOwner, itemId: string): Promise<void> {
    if (!isId(itemId) || !(await repo.deleteItem(owner, itemId))) {
      throw new CartError(404, "NOT_FOUND", "Cart item not found");
    }
  }

  /** Checkout (US-051): removes the lines that were ordered. Ids that aren't the owner's are ignored. */
  async function clearItems(owner: CartOwner, itemIds: string[]): Promise<number> {
    const ids = itemIds.filter(isId);
    return ids.length ? repo.deleteItems(owner, ids) : 0;
  }

  /** Units in the cart (not saved for later), for the header link. */
  function countItems(owner: CartOwner): Promise<number> {
    return repo.sumQuantity(owner);
  }

  /**
   * At login: the guest device's rows join the user's cart. A variant already in the user's cart
   * gets the quantities added (capped at the stock) and the price the customer saw most recently,
   * so a price change still shows its notice. A row in the cart on either side stays in the cart.
   */
  async function mergeGuestCart(guestToken: string, userId: string): Promise<MergeResult> {
    const guest: CartOwner = { kind: "guest", guestToken };
    const user: CartOwner = { kind: "user", userId };
    const result: MergeResult = { moved: 0, combined: 0, messages: [] };

    for (const row of await repo.listItems(guest)) {
      let existing = await repo.findByVariant(user, row.variantId);
      if (!existing) {
        try {
          if (await repo.reassignToUser(guestToken, row.id, userId)) result.moved++;
          continue;
        } catch (err) {
          // The user got this variant meanwhile (another tab): combine below.
          existing = await repo.findByVariant(user, row.variantId);
          if (!existing) throw err;
        }
      }
      const stock = Math.max(0, row.variant.stock);
      const sum = existing.quantity + row.quantity;
      const quantity = stock > 0 ? Math.min(sum, quantityLimit(stock)) : Math.min(sum, MAX_LINE_QUANTITY);
      if (quantity < sum) result.messages.push(`${row.product.title}: ${capMessage(stock, quantity)}`);
      const newest = existing.updatedAt.getTime() >= row.updatedAt.getTime() ? existing.priceAtAdd : row.priceAtAdd;
      await repo.updateItem(user, existing.id, {
        quantity,
        savedForLater: existing.savedForLater && row.savedForLater,
        priceAtAdd: priceText(newest),
      });
      await repo.deleteItem(guest, row.id);
      result.combined++;
    }
    return result;
  }

  return { getCart, addItem, updateItem, removeItem, clearItems, countItems, mergeGuestCart };
}

export type CartService = ReturnType<typeof createCartService>;
