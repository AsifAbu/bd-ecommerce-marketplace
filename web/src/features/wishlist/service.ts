import type { CategorySchema } from "@/features/catalog";
import { listingState, priceRange, variantLabel, type LiveCheck } from "@/features/products";
import { dhakaToday } from "@/features/shops";
import { WishlistError } from "./errors";

/**
 * Wishlist use cases (US-057) with injected dependencies. The caller passes the guard-checked
 * user id (requireUser); every repo call is scoped by it.
 *
 * Acceptance criteria:
 * - a guest is sent to log in first and the item is saved after login (see intent.ts);
 * - moving to the cart needs a chosen, in-stock variant, adds it and removes the wishlist item;
 * - an item whose variant (or every variant) has no stock, or whose listing is no longer live,
 *   shows "Out of stock" and can't be moved.
 */

export const MAX_WISHLIST_ITEMS = 200;

interface VariantRow {
  id: string;
  price: { toString(): string } | number;
  stock: number;
  options: unknown;
}

export interface WishlistRow {
  id: string;
  userId: string;
  productId: string;
  variantId: string | null;
  createdAt: Date;
  product: LiveCheck & {
    id: string;
    title: string;
    categoryId: string;
    shop: LiveCheck["shop"] & { name: string };
    variants: VariantRow[];
    images: { id: string }[];
  };
}

export interface WishlistRepo {
  listItems(userId: string): Promise<WishlistRow[]>;
  getItem(userId: string, itemId: string): Promise<WishlistRow | null>;
  countItems(userId: string): Promise<number>;
  findForProduct(userId: string, productId: string): Promise<{ id: string; variantId: string | null }[]>;
  findSame(userId: string, productId: string, variantId: string | null): Promise<{ id: string; variantId: string | null } | null>;
  createItem(userId: string, productId: string, variantId: string | null): Promise<{ id: string; variantId: string | null }>;
  deleteItem(userId: string, itemId: string): Promise<boolean>;
  findLiveProduct(productId: string, today: Date): Promise<{ id: string; variants: { id: string }[] } | null>;
}

export interface WishlistDeps {
  repo: WishlistRepo;
  getCategorySchema: (categoryId: string) => Promise<CategorySchema>;
  now: () => Date;
}

/** One line to add to the cart. The cart feature (Sprint 6) provides the adder. */
export interface CartLine {
  userId: string;
  productId: string;
  variantId: string;
  quantity: number;
}
export type CartAdder = (line: CartLine) => Promise<unknown>;

export type StockStatus = "in_stock" | "out_of_stock";

export interface WishlistItemView {
  id: string;
  productId: string;
  variantId: string | null;
  title: string;
  href: string;
  shopName: string;
  imageId: string | null;
  /** "Size: M, Colour: Black"; null when no variant was chosen or the product has none. */
  variantLabel: string | null;
  /** "Tk 1,850" or a range when no variant is chosen. */
  priceText: string;
  status: StockStatus;
  statusLabel: "In stock" | "Out of stock";
  /** True only for a live listing with a chosen, in-stock variant. */
  canMoveToCart: boolean;
  /** Why it can't be moved (shown next to the disabled button), or null. */
  moveHint: string | null;
  createdAt: Date;
}

const ID_MAX = 64;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= ID_MAX;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The variant to use: the saved one, or the only one of a product without variant options. */
function chosenVariant(row: WishlistRow): VariantRow | null {
  const { variants } = row.product;
  if (row.variantId) return variants.find((v) => v.id === row.variantId) ?? null;
  return variants.length === 1 ? variants[0] : null;
}

/** Stock and move rules for one item (pure). */
export function itemState(row: WishlistRow, today: Date): { status: StockStatus; canMoveToCart: boolean; moveHint: string | null } {
  const live = listingState(row.product, today) === "live";
  const variant = chosenVariant(row);
  const inStock = live && (variant ? variant.stock > 0 : row.product.variants.some((v) => v.stock > 0));
  if (!inStock) return { status: "out_of_stock", canMoveToCart: false, moveHint: live ? "Out of stock" : "No longer available" };
  if (!variant) return { status: "in_stock", canMoveToCart: false, moveHint: "Choose a variant on the product page first" };
  return { status: "in_stock", canMoveToCart: true, moveHint: null };
}

export function createWishlistService(deps: WishlistDeps) {
  const { repo } = deps;
  const today = () => dhakaToday(deps.now());

  /** POST /api/wishlist: saves { productId, variantId? } for the user. Idempotent. */
  async function addItem(userId: string, body: unknown): Promise<{ item: { id: string; variantId: string | null }; created: boolean }> {
    const input = isRecord(body) ? body : {};
    if (!isId(input.productId)) throw new WishlistError(422, "VALIDATION", "Choose a product", { productId: "Choose a product" });
    const rawVariant = input.variantId ?? null;
    if (rawVariant !== null && !isId(rawVariant)) {
      throw new WishlistError(422, "VALIDATION", "Invalid variant", { variantId: "Invalid variant" });
    }

    const product = await repo.findLiveProduct(input.productId, today());
    if (!product) throw new WishlistError(404, "NOT_FOUND", "Product not found");
    let variantId = rawVariant as string | null;
    if (variantId && !product.variants.some((v) => v.id === variantId)) {
      throw new WishlistError(422, "VALIDATION", "This variant is not part of the product", {
        variantId: "This variant is not part of the product",
      });
    }
    // A product without variant options has one variant: save it, so the item can move to the cart.
    if (!variantId && product.variants.length === 1) variantId = product.variants[0].id;

    const existing = await repo.findSame(userId, product.id, variantId);
    if (existing) return { item: existing, created: false };
    if ((await repo.countItems(userId)) >= MAX_WISHLIST_ITEMS) {
      throw new WishlistError(409, "WISHLIST_FULL", `Your wishlist can hold up to ${MAX_WISHLIST_ITEMS} items. Remove some first.`);
    }
    try {
      return { item: await repo.createItem(userId, product.id, variantId), created: true };
    } catch (err) {
      // Saved twice at once (unique user + product + variant): return the row that won.
      const again = await repo.findSame(userId, product.id, variantId);
      if (again) return { item: again, created: false };
      throw err;
    }
  }

  /** GET /api/wishlist and the /account/wishlist page: newest first, with price and stock. */
  async function listItems(userId: string): Promise<WishlistItemView[]> {
    const rows = await repo.listItems(userId);
    const day = today();
    const schemas = new Map<string, Promise<CategorySchema | null>>();
    const schemaOf = (categoryId: string) => {
      if (!schemas.has(categoryId)) schemas.set(categoryId, deps.getCategorySchema(categoryId).catch(() => null));
      return schemas.get(categoryId)!;
    };
    return Promise.all(
      rows.map(async (row) => {
        const state = itemState(row, day);
        const variant = chosenVariant(row);
        let label: string | null = null;
        if (variant && isRecord(variant.options) && Object.keys(variant.options).length) {
          const schema = await schemaOf(row.product.categoryId);
          const axes = schema?.fields.filter((f) => f.isVariantAxis) ?? [];
          label = axes.length
            ? variantLabel(variant.options, axes)
            : Object.entries(variant.options).map(([k, v]) => `${k}: ${String(v)}`).join(", ");
        }
        return {
          id: row.id,
          productId: row.productId,
          variantId: row.variantId,
          title: row.product.title,
          href: `/products/${row.productId}${row.variantId ? `?variant=${encodeURIComponent(row.variantId)}` : ""}`,
          shopName: row.product.shop.name,
          imageId: row.product.images[0]?.id ?? null,
          variantLabel: label,
          priceText: priceRange(variant ? [variant.price] : row.product.variants.map((v) => v.price)),
          status: state.status,
          statusLabel: state.status === "in_stock" ? "In stock" : "Out of stock",
          canMoveToCart: state.canMoveToCart,
          moveHint: state.moveHint,
          createdAt: row.createdAt,
        } satisfies WishlistItemView;
      }),
    );
  }

  /** The user's saved items of one product ({ id, variantId }), for the product page heart. */
  function savedForProduct(userId: string, productId: string) {
    return repo.findForProduct(userId, productId);
  }

  /** DELETE /api/wishlist/[itemId]: 404 when the item isn't the user's. */
  async function removeItem(userId: string, itemId: string): Promise<void> {
    if (!isId(itemId) || !(await repo.deleteItem(userId, itemId))) {
      throw new WishlistError(404, "NOT_FOUND", "Wishlist item not found");
    }
  }

  /**
   * US-057 "move to cart": needs a live listing, a chosen variant (the saved one, the only one,
   * or `opts.variantId` picked now) with stock. Calls `addToCart` first and removes the wishlist
   * item only when that succeeds. Errors: 404 not the user's item, 409 OUT_OF_STOCK or
   * UNAVAILABLE, 422 VARIANT_REQUIRED.
   */
  async function moveToCart(
    userId: string,
    itemId: string,
    addToCart: CartAdder,
    opts: { variantId?: string; quantity?: number } = {},
  ): Promise<{ productId: string; variantId: string }> {
    const row = isId(itemId) ? await repo.getItem(userId, itemId) : null;
    if (!row) throw new WishlistError(404, "NOT_FOUND", "Wishlist item not found");
    if (listingState(row.product, today()) !== "live") {
      throw new WishlistError(409, "UNAVAILABLE", "This product is no longer available");
    }
    let variant = chosenVariant(row);
    if (opts.variantId !== undefined) {
      variant = row.product.variants.find((v) => v.id === opts.variantId) ?? null;
      if (!variant) {
        throw new WishlistError(422, "VALIDATION", "This variant is not part of the product", {
          variantId: "This variant is not part of the product",
        });
      }
    }
    if (!variant) {
      throw new WishlistError(422, "VARIANT_REQUIRED", "Choose a variant (for example size or colour) first", {
        variantId: "Choose a variant",
      });
    }
    if (variant.stock <= 0) throw new WishlistError(409, "OUT_OF_STOCK", "This item is out of stock");
    const quantity = opts.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new WishlistError(422, "VALIDATION", "Quantity must be at least 1", { quantity: "Quantity must be at least 1" });
    }

    await addToCart({ userId, productId: row.productId, variantId: variant.id, quantity });
    await repo.deleteItem(userId, row.id);
    return { productId: row.productId, variantId: variant.id };
  }

  return { addItem, listItems, savedForProduct, removeItem, moveToCart };
}

export type WishlistService = ReturnType<typeof createWishlistService>;
