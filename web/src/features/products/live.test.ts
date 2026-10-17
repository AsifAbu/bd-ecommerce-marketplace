import { describe, expect, it } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";
import { listingState, liveProductWhere, type LiveCheck } from "./live";
import { assertCanList, assertWithinTierLimit, type ListingShop } from "./rules";
import { NOW, TODAY } from "./test-fixtures";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const base: LiveCheck = {
  status: "active",
  deletedAt: null,
  expiresOn: null,
  shop: { status: "approved", medicineSuspended: false },
  category: { requiresLicence: false },
};

describe("listingState", () => {
  it("explains why a listing is hidden", () => {
    expect(listingState(base, TODAY)).toBe("live");
    expect(listingState({ ...base, expiresOn: TODAY }, TODAY)).toBe("live");
    expect(listingState({ ...base, expiresOn: day("2026-10-15") }, TODAY)).toBe("expired");
    expect(listingState({ ...base, status: "inactive" }, TODAY)).toBe("inactive");
    expect(listingState({ ...base, deletedAt: new Date() }, TODAY)).toBe("deleted");
    expect(listingState({ ...base, shop: { status: "suspended", medicineSuspended: false } }, TODAY)).toBe("shop_not_approved");
    const medicine = { ...base, category: { requiresLicence: true }, shop: { status: "approved" as const, medicineSuspended: true } };
    expect(listingState(medicine, TODAY)).toBe("medicine_suspended");
    // Medicine suspension does not hide the shop's other listings.
    expect(listingState({ ...medicine, category: { requiresLicence: false } }, TODAY)).toBe("live");
  });
});

describe("liveProductWhere", () => {
  it("selects the same products as listingState", async () => {
    const db = createFakeDb({
      shop: [
        { id: "ok", status: "approved", medicineSuspended: false },
        { id: "susp", status: "suspended", medicineSuspended: false },
        { id: "med", status: "approved", medicineSuspended: true },
      ],
      category: [
        { id: "plain", requiresLicence: false },
        { id: "medicine", requiresLicence: true },
      ],
      product: [
        { id: "live", shopId: "ok", categoryId: "plain", status: "active", deletedAt: null, expiresOn: null },
        { id: "live-today", shopId: "ok", categoryId: "plain", status: "active", deletedAt: null, expiresOn: TODAY },
        { id: "expired", shopId: "ok", categoryId: "plain", status: "active", deletedAt: null, expiresOn: day("2026-10-15") },
        { id: "inactive", shopId: "ok", categoryId: "plain", status: "inactive", deletedAt: null, expiresOn: null },
        { id: "deleted", shopId: "ok", categoryId: "plain", status: "active", deletedAt: new Date(), expiresOn: null },
        { id: "shop-suspended", shopId: "susp", categoryId: "plain", status: "active", deletedAt: null, expiresOn: null },
        { id: "med-suspended", shopId: "med", categoryId: "medicine", status: "active", deletedAt: null, expiresOn: null },
        { id: "med-shop-other", shopId: "med", categoryId: "plain", status: "active", deletedAt: null, expiresOn: null },
      ],
    });
    const found = (await db.product.findMany({ where: liveProductWhere(TODAY) as Record<string, unknown> })).map((p) => p.id);
    expect(found).toEqual(["live", "live-today", "med-shop-other"]);
  });
});

describe("listing rules", () => {
  const shop = (o: Partial<ListingShop> = {}): ListingShop => ({
    id: "s",
    status: "approved",
    type: "general",
    tier: "basic",
    medicineSuspended: false,
    licences: [],
    ...o,
  });
  const medicine = { name: "Pain Relief", requiresLicence: true };
  const plain = { name: "Processor", requiresLicence: false };

  it("requires an approved shop", () => {
    expect(() => assertCanList(shop({ status: "suspended" }), plain, NOW)).toThrow(/approved/);
    expect(() => assertCanList(shop(), plain, NOW)).not.toThrow();
  });

  it("allows licence categories only for medicine shops with a valid licence", () => {
    expect(() => assertCanList(shop(), medicine, NOW)).toThrow("Only medicine shops");
    const valid = [{ status: "verified" as const, expiryDate: day("2026-10-16") }];
    expect(() => assertCanList(shop({ type: "medicine", licences: valid }), medicine, NOW)).not.toThrow();
    expect(() => assertCanList(shop({ type: "medicine", licences: [{ ...valid[0], status: "pending" }] }), medicine, NOW)).toThrow(/licence/);
    expect(() => assertCanList(shop({ type: "medicine", licences: valid, medicineSuspended: true }), medicine, NOW)).toThrow(/licence/);
  });

  it("limits Basic shops to 100 live listings", () => {
    expect(() => assertWithinTierLimit("basic", 99)).not.toThrow();
    expect(() => assertWithinTierLimit("basic", 100)).toThrow(/at most 100/);
    expect(() => assertWithinTierLimit("basic", 90, 11)).toThrow(/room for 10 more/);
    expect(() => assertWithinTierLimit("verified", 10_000, 500)).not.toThrow();
  });
});
