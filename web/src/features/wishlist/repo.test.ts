import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";

// User-scoped wishlist repository: calls for user A never read or remove user B's items.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const repo = await import("./repo");

const TODAY = new Date("2026-10-16T00:00:00Z");
let db: ReturnType<typeof createFakeDb<"wishlistItem" | "product" | "shop" | "category">>;

beforeEach(() => {
  db = createFakeDb({
    shop: [{ id: "s1", status: "approved", medicineSuspended: false }],
    category: [{ id: "c1", requiresLicence: false }],
    product: [
      { id: "p1", shopId: "s1", categoryId: "c1", status: "active", deletedAt: null, expiresOn: null },
      { id: "p-off", shopId: "s1", categoryId: "c1", status: "inactive", deletedAt: null, expiresOn: null },
    ],
    wishlistItem: [
      { id: "wA", userId: "A", productId: "p1", variantId: "v1", createdAt: new Date() },
      { id: "wA2", userId: "A", productId: "p1", variantId: null, createdAt: new Date() },
      { id: "wB", userId: "B", productId: "p1", variantId: "v1", createdAt: new Date() },
    ],
  });
  state.db = db;
});

describe("wishlist repo scoping", () => {
  it("listItems and countItems return only the user's items", async () => {
    expect((await repo.listItems("A")).map((i) => i.id).sort()).toEqual(["wA", "wA2"]);
    expect((await repo.listItems("B")).map((i) => i.id)).toEqual(["wB"]);
    expect(await repo.countItems("A")).toBe(2);
    expect(await repo.listItems("C")).toEqual([]);
  });

  it("getItem does not return another user's item", async () => {
    expect((await repo.getItem("A", "wA"))?.id).toBe("wA");
    expect(await repo.getItem("A", "wB")).toBeNull();
  });

  it("findSame and findForProduct are scoped and tell null variants apart", async () => {
    expect((await repo.findSame("A", "p1", "v1"))?.id).toBe("wA");
    expect((await repo.findSame("A", "p1", null))?.id).toBe("wA2");
    expect(await repo.findSame("B", "p1", null)).toBeNull();
    expect((await repo.findForProduct("B", "p1")).map((i) => i.id)).toEqual(["wB"]);
  });

  it("deleteItem can't remove another user's item", async () => {
    expect(await repo.deleteItem("A", "wB")).toBe(false);
    expect(db.wishlistItem.rows.map((r) => r.id)).toContain("wB");
    expect(await repo.deleteItem("B", "wB")).toBe(true);
    expect(db.wishlistItem.rows.map((r) => r.id)).toEqual(["wA", "wA2"]);
  });

  it("createItem stores the user id given", async () => {
    const created = await repo.createItem("B", "p1", null);
    expect(db.wishlistItem.rows.find((r) => r.id === created.id)).toMatchObject({ userId: "B", productId: "p1", variantId: null });
  });

  it("findLiveProduct only finds live listings", async () => {
    expect(await repo.findLiveProduct("p1", TODAY)).toMatchObject({ id: "p1" });
    expect(await repo.findLiveProduct("p-off", TODAY)).toBeNull();
  });
});
