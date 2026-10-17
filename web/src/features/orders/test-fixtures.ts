import { buildCart, type CartOwner, type CartRow } from "@/features/cart";
import type { DeliveryZone } from "@/lib/delivery";
import type { OrderConfig } from "./config";
import type { ItemFacts, OrderDraft, ShopFacts } from "./draft";
import { OrderError } from "./errors";
import type { CodHistory } from "./limits";
import { StockConflictError, type PlacementDeps, type PlacedOrder } from "./placement";

/**
 * Test helpers for the orders feature: a small catalogue, cart rows, and an in-memory
 * PlacementStore whose `place` is all-or-nothing like the database transaction.
 */

export const NOW = new Date("2026-10-17T06:00:00Z"); // 12:00 in Dhaka
export const TODAY = new Date("2026-10-17T00:00:00Z");

export const SHOPS = {
  tech: { id: "shop-tech", name: "Tech Shop", slug: "tech", freeDeliveryThreshold: "10000.00", tier: "verified" as const, registration: "Trade licence TL-1" },
  books: { id: "shop-books", name: "Book Shop", slug: "books", freeDeliveryThreshold: null, tier: "basic" as const, registration: null },
};

export interface FakeVariant {
  id: string;
  productId: string;
  shop: (typeof SHOPS)[keyof typeof SHOPS];
  title: string;
  price: string;
  stock: number;
  weightG: number;
  categoryId: string;
  commissionRate: number;
  warranty?: string;
  sku?: string;
}

export const VARIANTS: Record<string, FakeVariant> = {
  ram: { id: "v-ram", productId: "p-ram", shop: SHOPS.tech, title: "16GB RAM", price: "6800.00", stock: 25, weightG: 250, categoryId: "c-ram", commissionRate: 5, warranty: "Lifetime", sku: "RAM-16" },
  cpu: { id: "v-cpu", productId: "p-cpu", shop: SHOPS.tech, title: "Ryzen 5", price: "24500.00", stock: 2, weightG: 250, categoryId: "c-cpu", commissionRate: 5, warranty: "3 years", sku: "R5" },
  himu: { id: "v-himu", productId: "p-himu", shop: SHOPS.books, title: "Himu", price: "250.00", stock: 40, weightG: 250, categoryId: "c-fiction", commissionRate: 8, sku: "HIMU" },
  maths: { id: "v-maths", productId: "p-maths", shop: SHOPS.books, title: "Engineering Mathematics", price: "650.00", stock: 8, weightG: 600, categoryId: "c-academic", commissionRate: 8 },
};

let seq = 0;
export function row(v: FakeVariant, quantity = 1, over: Partial<Pick<CartRow, "priceAtAdd" | "savedForLater">> = {}): CartRow {
  seq++;
  return {
    id: `ci-${v.id}`,
    productId: v.productId,
    variantId: v.id,
    shopId: v.shop.id,
    quantity,
    savedForLater: false,
    priceAtAdd: v.price,
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, seq)),
    updatedAt: new Date(Date.UTC(2026, 9, 1, 0, 0, seq)),
    ...over,
    variant: { id: v.id, price: v.price, stock: v.stock, options: {} },
    product: {
      id: v.productId,
      title: v.title,
      categoryId: v.categoryId,
      attributes: { weight_g: v.weightG },
      status: "active",
      deletedAt: null,
      expiresOn: null,
      category: { requiresLicence: false },
      shop: { id: v.shop.id, name: v.shop.name, slug: v.shop.slug, freeDeliveryThreshold: v.shop.freeDeliveryThreshold, status: "approved", medicineSuspended: false },
      images: [],
    },
  };
}

export const CONFIG: PlacementDeps["config"] = {
  maxOpenCodOrdersWithoutDelivery: 3,
  refusalsBlockingCod: 2,
  handoverHours: 48,
  vatRatePercent: 0,
  launchOfferUntil: null,
} satisfies Partial<OrderConfig>;

export const USER_OWNER: CartOwner = { kind: "user", userId: "u-1" };
export const GUEST_OWNER: CartOwner = { kind: "guest", guestToken: "guest-hash" };

export function createWorld(cartRows: CartRow[]) {
  const stock = new Map(Object.values(VARIANTS).map((v) => [v.id, v.stock]));
  const prices = new Map(Object.values(VARIANTS).map((v) => [v.id, v.price]));
  const state = {
    rows: cartRows,
    history: { openOrders: 0, delivered: 0, refused: 0 } as CodHistory,
    openByShop: {} as Record<string, number>,
    /** phone -> account id, for accounts whose phone is verified. */
    verifiedAccounts: new Map<string, string>(),
    placed: [] as OrderDraft[],
    cleared: [] as { owner: CartOwner; ids: string[] }[],
    zonesAsked: [] as DeliveryZone[],
    notifications: [] as string[],
    accepted: new Set<string>(),
    acceptances: [] as { userId?: string | null; guestPhone?: string | null; slugs: readonly string[] }[],
    historyAsked: [] as { phone: string; userId: string | null }[],
    takenOrderNos: new Set<string>(),
    stock,
    prices,
    /** Called inside place() before the stock check (simulate another checkout winning). */
    beforePlace: null as null | (() => void),
  };

  const store: PlacementDeps["store"] = {
    async findByIdempotencyKey(key) {
      const d = state.placed.find((p) => p.idempotencyKey === key);
      return d ? { id: `o-${d.orderNo}`, orderNo: d.orderNo, userId: d.userId } : null;
    },
    async codHistory(phone, userId) {
      state.historyAsked.push({ phone, userId });
      return state.history;
    },
    async shopFacts(ids) {
      const map = new Map<string, ShopFacts & { openOrders: number; maxOpenOrders: number | null }>();
      for (const s of Object.values(SHOPS)) {
        if (!ids.includes(s.id)) continue;
        map.set(s.id, {
          name: s.name,
          tier: s.tier,
          registration: s.registration,
          openOrders: state.openByShop[s.id] ?? 0,
          maxOpenOrders: s.tier === "basic" ? 20 : null,
        });
      }
      return map;
    },
    async itemFacts(ids) {
      const map = new Map<string, ItemFacts>();
      for (const v of Object.values(VARIANTS)) {
        if (ids.includes(v.id)) map.set(v.id, { sku: v.sku ?? null, warranty: v.warranty ?? null, categoryId: v.categoryId, commissionRate: v.commissionRate });
      }
      return map;
    },
    async findAccountByVerifiedPhone(phone) {
      const id = state.verifiedAccounts.get(phone);
      return id ? { id } : null;
    },
    async place(draft, owner, ids): Promise<PlacedOrder> {
      state.beforePlace?.();
      // All or nothing, like the transaction: check every line first.
      const items = draft.shopOrders.flatMap((s) => s.items);
      for (const i of items) {
        const left = state.stock.get(i.variantId) ?? 0;
        if (left < i.quantity) throw new StockConflictError(i.variantId, i.title, left, "stock");
        if (state.prices.get(i.variantId) !== i.unitPrice) throw new StockConflictError(i.variantId, i.title, left, "price");
      }
      for (const i of items) state.stock.set(i.variantId, (state.stock.get(i.variantId) ?? 0) - i.quantity);
      state.placed.push(draft);
      state.cleared.push({ owner, ids });
      state.rows = state.rows.filter((r) => !ids.includes(r.id));
      return { id: `o-${draft.orderNo}`, orderNo: draft.orderNo, userId: draft.userId };
    },
  };

  let n = 0;
  const deps: PlacementDeps = {
    config: CONFIG,
    now: () => NOW,
    newOrderNo: () => `BD-261017-${"ABCDEFGHJK"[n++ % 10]}AAAA`,
    getCart: async (_owner, zone) => {
      state.zonesAsked.push(zone);
      return buildCart(state.rows, { zone, today: TODAY });
    },
    store,
    slugs: { account: ["returns", "delivery"], guest: ["returns", "delivery", "privacy"] },
    policies: {
      async recordAcceptance(input) {
        state.acceptances.push(input);
        if (input.userId) state.accepted.add(input.userId);
        return input.slugs.map((slug) => ({ slug, version: 1 }));
      },
      async assertAcceptedCurrent(userId) {
        if (!state.accepted.has(userId)) {
          throw new OrderError(422, "POLICY_ACCEPTANCE_REQUIRED", "Please accept the current policies", { returns: "Accept the Return policy" });
        }
      },
      getCurrentVersions: async (slugs) => slugs.map((slug) => ({ slug, version: 1 })),
    },
    enqueueNotification: async (orderId) => {
      state.notifications.push(orderId);
    },
    log: () => {},
  };
  return { state, store, deps };
}

export const HOME_DHAKA = {
  name: "Rahim",
  phone: "+8801711111111",
  division: "Dhaka",
  district: "Dhaka",
  upazila: "Dhanmondi",
  area: "Dhanmondi 27",
  line1: "House 1",
};

export const HOME_CTG = { ...HOME_DHAKA, division: "Chattogram", district: "Chattogram", upazila: "Panchlaish", area: "GEC" };

export const verifiedUser = {
  kind: "user" as const,
  userId: "u-1",
  name: "Rahim",
  phone: "+8801711111111",
  phoneVerifiedAt: new Date("2026-10-01T00:00:00Z"),
  email: "rahim@ecom.test",
};

export const KEY = "key-0123456789abcdef";
