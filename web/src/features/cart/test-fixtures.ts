import type { CartRow } from "./model";
import type { CartOwner, CartRepo, StoredItem, VariantForCart } from "./service";

/** Test helper: a catalogue of variants and an in-memory CartRepo with the same owner scoping as repo.ts. */

export const TODAY = new Date("2026-10-16T00:00:00Z");

export interface FakeShop {
  id: string;
  name: string;
  slug: string;
  freeDeliveryThreshold: string | null;
  status?: "approved" | "suspended";
}

export interface FakeVariant {
  id: string;
  productId: string;
  shop: FakeShop;
  title: string;
  price: string;
  stock: number;
  weightG?: number;
  options?: Record<string, string>;
  live?: boolean;
}

export const techShop: FakeShop = { id: "shop-tech", name: "Tech Shop", slug: "tech", freeDeliveryThreshold: "10000.00" };
export const bookShop: FakeShop = { id: "shop-book", name: "Book Shop", slug: "books", freeDeliveryThreshold: null };

export function variantRow(v: FakeVariant) {
  return {
    variant: { id: v.id, price: v.price, stock: v.stock, options: v.options ?? {} },
    product: {
      id: v.productId,
      title: v.title,
      categoryId: "cat-1",
      attributes: v.weightG === undefined ? {} : { weight_g: v.weightG },
      status: v.live === false ? ("inactive" as const) : ("active" as const),
      deletedAt: null,
      expiresOn: null,
      category: { requiresLicence: false },
      shop: { ...v.shop, status: v.shop.status ?? ("approved" as const), medicineSuspended: false },
      images: [],
    },
  };
}

let seq = 0;
/** A stored cart row joined with its variant, for buildCart tests. */
export function cartRow(v: FakeVariant, over: Partial<Omit<CartRow, "variant" | "product">> = {}): CartRow {
  seq++;
  return {
    id: over.id ?? `ci-${seq}`,
    productId: v.productId,
    variantId: v.id,
    shopId: v.shop.id,
    quantity: 1,
    savedForLater: false,
    priceAtAdd: v.price,
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, seq)),
    updatedAt: new Date(Date.UTC(2026, 9, 1, 0, 0, seq)),
    ...over,
    ...variantRow(v),
  };
}

interface Stored extends StoredItem {
  userId: string | null;
  guestToken: string | null;
  createdAt: Date;
}

const owns = (owner: CartOwner, r: Stored) =>
  owner.kind === "user" ? r.userId === owner.userId : r.userId === null && r.guestToken === owner.guestToken;

export function createMemoryRepo(variants: FakeVariant[], clock: () => Date = () => new Date()) {
  const rows: Stored[] = [];
  const catalogue = new Map(variants.map((v) => [v.id, v]));
  let n = 0;

  const join = (r: Stored): CartRow => {
    const v = catalogue.get(r.variantId)!;
    return { ...r, ...variantRow(v) };
  };
  const touch = (r: Stored) => {
    r.updatedAt = new Date(Math.max(clock().getTime(), r.updatedAt.getTime() + 1));
  };

  const repo: CartRepo = {
    listItems: async (owner) => rows.filter((r) => owns(owner, r)).map(join),
    getItem: async (owner, id) => {
      const r = rows.find((x) => x.id === id && owns(owner, x));
      return r ? join(r) : null;
    },
    findByVariant: async (owner, variantId) => {
      const r = rows.find((x) => x.variantId === variantId && owns(owner, x));
      return r ? { ...r } : null;
    },
    countLines: async (owner) => rows.filter((r) => owns(owner, r)).length,
    sumQuantity: async (owner) => rows.filter((r) => owns(owner, r) && !r.savedForLater).reduce((s, r) => s + r.quantity, 0),
    createItem: async (owner, data) => {
      if (rows.some((r) => owns(owner, r) && r.variantId === data.variantId)) throw new Error("unique violation");
      const now = clock();
      const row: Stored = {
        id: `row-${++n}`,
        userId: owner.kind === "user" ? owner.userId : null,
        guestToken: owner.kind === "guest" ? owner.guestToken : null,
        savedForLater: false,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      rows.push(row);
      return { ...row };
    },
    updateItem: async (owner, id, data) => {
      const r = rows.find((x) => x.id === id && owns(owner, x));
      if (!r) return false;
      Object.assign(r, data);
      touch(r);
      return true;
    },
    deleteItem: async (owner, id) => {
      const i = rows.findIndex((x) => x.id === id && owns(owner, x));
      if (i < 0) return false;
      rows.splice(i, 1);
      return true;
    },
    deleteItems: async (owner, ids) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (ids.includes(rows[i].id) && owns(owner, rows[i])) rows.splice(i, 1);
      return before - rows.length;
    },
    reassignToUser: async (guestToken, id, userId) => {
      const r = rows.find((x) => x.id === id && x.guestToken === guestToken && x.userId === null);
      if (!r) return false;
      if (rows.some((x) => x.userId === userId && x.variantId === r.variantId)) throw new Error("unique violation");
      r.userId = userId;
      r.guestToken = null;
      return true;
    },
    findLiveVariant: async (variantId) => {
      const v = catalogue.get(variantId);
      if (!v || v.live === false || (v.shop.status ?? "approved") !== "approved") return null;
      return { id: v.id, productId: v.productId, shopId: v.shop.id, price: v.price, stock: v.stock } satisfies VariantForCart;
    },
  };

  /** Inserts a row directly (as if added earlier). */
  function insert(owner: CartOwner, variantId: string, over: Partial<Stored> = {}): Stored {
    const v = catalogue.get(variantId)!;
    const now = clock();
    const row: Stored = {
      id: `row-${++n}`,
      userId: owner.kind === "user" ? owner.userId : null,
      guestToken: owner.kind === "guest" ? owner.guestToken : null,
      productId: v.productId,
      variantId,
      shopId: v.shop.id,
      quantity: 1,
      savedForLater: false,
      priceAtAdd: v.price,
      createdAt: now,
      updatedAt: now,
      ...over,
    };
    rows.push(row);
    return row;
  }

  return { repo, rows, catalogue, insert };
}
