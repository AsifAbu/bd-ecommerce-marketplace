import { describe, expect, it } from "vitest";
import { buildCart } from "@/features/cart";
import { buildOrderDraft, commissionOn, includedVat, launchOfferActive, MissingFactsError, type DraftInput } from "./draft";
import { generateOrderNo, parseOrderNo, shopOrderNo } from "./order-no";
import { CONFIG, HOME_DHAKA, NOW, row, SHOPS, TODAY, VARIANTS } from "./test-fixtures";

// Money logic of the order snapshot (US-051): paisa arithmetic, VAT included, commission (D10, D15).

function input(over: Partial<DraftInput> = {}): DraftInput {
  const cart = buildCart([row(VARIANTS.ram, 1), row(VARIANTS.himu, 3)], { zone: "inside_dhaka", today: TODAY });
  return {
    cart,
    facts: new Map(
      Object.values(VARIANTS).map((v) => [v.id, { sku: v.sku ?? null, warranty: v.warranty ?? null, categoryId: v.categoryId, commissionRate: v.commissionRate }]),
    ),
    shops: new Map(Object.values(SHOPS).map((s) => [s.id, { name: s.name, tier: s.tier, registration: s.registration }])),
    config: CONFIG,
    now: NOW,
    orderNo: "BD-261017-ABCDE",
    userId: "u-1",
    linkedVia: null,
    contact: { name: "Rahim", phone: "+8801711111111", email: null },
    phoneVerifiedAt: NOW,
    address: HOME_DHAKA,
    policyVersions: [{ slug: "returns", version: 1 }],
    idempotencyKey: "k",
    ...over,
  };
}

describe("buildOrderDraft", () => {
  it("snapshots every item with SKU, warranty, weight and commission rate", () => {
    const draft = buildOrderDraft(input());
    expect(draft.shopOrders[0].items[0]).toEqual({
      cartItemId: "ci-v-ram",
      productId: "p-ram",
      variantId: "v-ram",
      categoryId: "c-ram",
      title: "16GB RAM",
      variantLabel: null,
      sku: "RAM-16",
      unitPrice: "6800.00",
      quantity: 1,
      lineTotal: "6800.00",
      unitWeightGrams: 250,
      warranty: "Lifetime",
      commissionRate: "5.00",
    });
    expect(draft.shopOrders[1]).toMatchObject({ seq: 2, shopName: "Book Shop", shopRegistration: null, itemsSubtotal: "750.00", weightGrams: 750 });
    expect(draft.shopOrders[0]).toMatchObject({ seq: 1, shopRegistration: "Trade licence TL-1" });
  });

  it("adds commission per line: 5% of Tk 6,800 and 8% of Tk 750", () => {
    const [tech, books] = buildOrderDraft(input()).shopOrders;
    expect([tech.commissionAmount, books.commissionAmount]).toEqual(["340.00", "60.00"]);
    expect(tech.launchOffer).toBe(false);
  });

  it("records 0% commission while the launch offer runs (D15)", () => {
    const draft = buildOrderDraft(input({ config: { ...CONFIG, launchOfferUntil: new Date("2027-01-17T00:00:00Z") } }));
    expect(draft.shopOrders.every((s) => s.launchOffer && s.commissionAmount === "0.00")).toBe(true);
    expect(draft.shopOrders.flatMap((s) => s.items.map((i) => i.commissionRate))).toEqual(["0.00", "0.00"]);
    expect(launchOfferActive({ launchOfferUntil: NOW }, NOW)).toBe(false);
  });

  it("shows the VAT contained in the item subtotal (0 in testing; e.g. 15% of a VAT-inclusive Tk 6,800)", () => {
    expect(buildOrderDraft(input()).shopOrders[0]).toMatchObject({ vatRate: "0.00", vatAmount: "0.00" });
    const [tech] = buildOrderDraft(input({ config: { ...CONFIG, vatRatePercent: 15 } })).shopOrders;
    expect([tech.vatRate, tech.vatAmount, tech.total]).toEqual(["15.00", "886.96", "6870.00"]);
  });

  it("adds totals in paisa without floating-point dust", () => {
    const cheap = { ...VARIANTS.himu, id: "v-cheap", price: "0.10" };
    const cart = buildCart([row(cheap, 3), row({ ...VARIANTS.maths, price: "0.20" }, 1)], { zone: "inside_dhaka", today: TODAY });
    const facts = new Map([
      ["v-cheap", { sku: null, warranty: null, categoryId: "c", commissionRate: 8 }],
      ["v-maths", { sku: null, warranty: null, categoryId: "c", commissionRate: 8 }],
    ]);
    const draft = buildOrderDraft(input({ cart, facts }));
    expect(draft.itemsSubtotal).toBe("0.50");
    expect(draft.grandTotal).toBe("90.50"); // 1.35 kg: Tk 70 + 1 extra kg
  });

  it("refuses to build without the listing data of a line", () => {
    expect(() => buildOrderDraft(input({ facts: new Map() }))).toThrow(MissingFactsError);
    expect(() => buildOrderDraft(input({ shops: new Map() }))).toThrow(MissingFactsError);
  });

  it("rounds VAT and commission to the paisa", () => {
    expect(includedVat(100, 15)).toBe(13);
    expect(includedVat(100, 0)).toBe(0);
    expect(commissionOn(333, 12)).toBe(40);
  });
});

describe("order numbers", () => {
  it("are BD-YYMMDD-XXXXX with the Bangladesh date", () => {
    // 20:00 UTC on 16 Oct is 02:00 on 17 Oct in Dhaka.
    const no = generateOrderNo(new Date("2026-10-16T20:00:00Z"), () => 0);
    expect(no).toBe("BD-261017-22222");
    expect(parseOrderNo(no)).toBe(no);
  });

  it("use no look-alike characters", () => {
    let i = 0;
    const no = generateOrderNo(NOW, (max) => i++ % max);
    expect(no).toMatch(/^BD-261017-[2-9A-HJKMNP-TV-Z]{5}$/);
    for (let n = 0; n < 200; n++) expect(generateOrderNo(NOW).slice(10)).not.toMatch(/[01ILOU]/);
  });

  it("parse what a customer types, and reject anything else", () => {
    expect(parseOrderNo(" bd-261017-7kq2m ")).toBe("BD-261017-7KQ2M");
    for (const bad of ["", "BD-261017-7KQ2", "BD-2610-7KQ2M", "BD-261017-7KQ2O", 12, null]) expect(parseOrderNo(bad)).toBeNull();
    expect(shopOrderNo("BD-261017-7KQ2M", 2)).toBe("BD-261017-7KQ2M-2");
  });
});
