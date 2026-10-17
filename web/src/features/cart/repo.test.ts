import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";

// Owner-scoped cart repository: a user's calls never touch another user's or a guest device's
// rows, and a guest device's calls never touch another device's or a user's rows.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const repo = await import("./repo");
const { guestCartCutoff } = await import("./purge");

const TODAY = new Date("2026-10-16T00:00:00Z");
const A = { kind: "user", userId: "A" } as const;
const B = { kind: "user", userId: "B" } as const;
const G = { kind: "guest", guestToken: "hash-g" } as const;
const H = { kind: "guest", guestToken: "hash-h" } as const;

let db: ReturnType<typeof createFakeDb<"cartItem" | "productVariant" | "product" | "shop" | "category" | "address">>;

const item = (id: string, owner: { userId?: string; guestToken?: string }, variantId: string, over: Record<string, unknown> = {}) => ({
  id,
  userId: owner.userId ?? null,
  guestToken: owner.guestToken ?? null,
  variantId,
  productId: "p1",
  shopId: "s1",
  quantity: 1,
  savedForLater: false,
  priceAtAdd: "100.00",
  ...over,
});

beforeEach(() => {
  db = createFakeDb({
    shop: [{ id: "s1", status: "approved", medicineSuspended: false }],
    category: [{ id: "c1", requiresLicence: false }],
    product: [
      { id: "p1", shopId: "s1", categoryId: "c1", status: "active", deletedAt: null, expiresOn: null },
      { id: "p-off", shopId: "s1", categoryId: "c1", status: "inactive", deletedAt: null, expiresOn: null },
    ],
    productVariant: [
      { id: "v1", productId: "p1", shopId: "s1", price: "100.00", stock: 5 },
      { id: "v2", productId: "p1", shopId: "s1", price: "200.00", stock: 5 },
      { id: "v-off", productId: "p-off", shopId: "s1", price: "50.00", stock: 5 },
    ],
    cartItem: [
      item("a1", { userId: "A" }, "v1", { quantity: 2 }),
      item("a2", { userId: "A" }, "v2", { savedForLater: true, quantity: 4 }),
      item("b1", { userId: "B" }, "v1"),
      item("g1", { guestToken: "hash-g" }, "v1", { quantity: 3 }),
      item("h1", { guestToken: "hash-h" }, "v1"),
      // A row that was merged to a user keeps no guest token; this odd one has both and must
      // only ever be treated as the user's.
      item("odd", { userId: "B", guestToken: "hash-g" }, "v2"),
    ],
    address: [
      { id: "addr-a", userId: "A", division: "Dhaka", district: "Dhaka", isDefault: true },
      { id: "addr-b", userId: "B", division: "Chattogram", district: "Chattogram", isDefault: true },
    ],
  });
  state.db = db;
});

const ids = (rows: { id?: unknown }[]) => rows.map((r) => String(r.id)).sort();

describe("cart repo scoping", () => {
  it("listItems and counts return only the owner's rows", async () => {
    expect(ids(await repo.listItems(A))).toEqual(["a1", "a2"]);
    expect(ids(await repo.listItems(B))).toEqual(["b1", "odd"]);
    expect(ids(await repo.listItems(G))).toEqual(["g1"]);
    expect(ids(await repo.listItems(H))).toEqual(["h1"]);
    expect(await repo.countLines(A)).toBe(2);
    expect(await repo.sumQuantity(A)).toBe(2); // the saved line is not counted
    expect(await repo.sumQuantity(G)).toBe(3);
  });

  it("getItem and findByVariant don't return another owner's row", async () => {
    expect((await repo.getItem(A, "a1"))?.id).toBe("a1");
    expect(await repo.getItem(A, "b1")).toBeNull();
    expect(await repo.getItem(G, "h1")).toBeNull();
    expect(await repo.getItem(G, "odd")).toBeNull();
    expect((await repo.findByVariant(G, "v1"))?.id).toBe("g1");
    expect(await repo.findByVariant(G, "v2")).toBeNull();
    expect(await repo.findByVariant(H, "v2")).toBeNull();
  });

  it("updateItem can't change another owner's row", async () => {
    expect(await repo.updateItem(A, "b1", { quantity: 9 })).toBe(false);
    expect(await repo.updateItem(G, "h1", { quantity: 9 })).toBe(false);
    expect(await repo.updateItem(G, "a1", { quantity: 9 })).toBe(false);
    expect(db.cartItem.rows.filter((r) => r.quantity === 9)).toEqual([]);
    expect(await repo.updateItem(G, "g1", { quantity: 4 })).toBe(true);
    expect(db.cartItem.rows.find((r) => r.id === "g1")?.quantity).toBe(4);
  });

  it("deleteItem and deleteItems can't remove another owner's rows", async () => {
    expect(await repo.deleteItem(A, "b1")).toBe(false);
    expect(await repo.deleteItem(H, "g1")).toBe(false);
    expect(await repo.deleteItems(A, ["a1", "b1", "g1"])).toBe(1);
    expect(ids(db.cartItem.rows)).toEqual(["a2", "b1", "g1", "h1", "odd"]);
  });

  it("createItem stores exactly one owner", async () => {
    const created = await repo.createItem(G, { productId: "p1", variantId: "v2", shopId: "s1", quantity: 1, priceAtAdd: "200.00" });
    expect(db.cartItem.rows.find((r) => r.id === created.id)).toMatchObject({ guestToken: "hash-g", userId: null, savedForLater: false });
    const forUser = await repo.createItem(A, { productId: "p1", variantId: "v-off", shopId: "s1", quantity: 1, priceAtAdd: "50.00" });
    expect(db.cartItem.rows.find((r) => r.id === forUser.id)).toMatchObject({ guestToken: null, userId: "A" });
  });

  it("reassignToUser moves only that guest's row and clears its token", async () => {
    expect(await repo.reassignToUser("hash-g", "h1", "A")).toBe(false);
    expect(await repo.reassignToUser("hash-g", "odd", "A")).toBe(false);
    expect(await repo.reassignToUser("hash-g", "g1", "A")).toBe(true);
    expect(db.cartItem.rows.find((r) => r.id === "g1")).toMatchObject({ userId: "A", guestToken: null });
  });

  it("findLiveVariant only finds variants of live listings", async () => {
    expect(await repo.findLiveVariant("v1", TODAY)).toMatchObject({ id: "v1", productId: "p1", shopId: "s1" });
    expect(await repo.findLiveVariant("v-off", TODAY)).toBeNull();
    expect(await repo.findLiveVariant("missing", TODAY)).toBeNull();
  });

  it("findDefaultAddress is scoped by user", async () => {
    expect(await repo.findDefaultAddress("A")).toMatchObject({ district: "Dhaka" });
    expect(await repo.findDefaultAddress("B")).toMatchObject({ district: "Chattogram" });
    expect(await repo.findDefaultAddress("C")).toBeNull();
  });
});

describe("guest cart purge", () => {
  it("removes guest carts untouched for 30 days", () => {
    expect(guestCartCutoff(new Date("2026-10-31T00:00:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
