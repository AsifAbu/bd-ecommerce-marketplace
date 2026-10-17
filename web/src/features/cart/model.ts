import { listingState, type LiveCheck } from "@/features/products";
import {
  DEFAULT_DELIVERY_RATES,
  deliveryBreakdown,
  orderWeightGrams,
  type DeliveryBreakdown,
  type DeliveryRates,
  type DeliveryZone,
} from "@/lib/delivery";

/**
 * The cart as the customer sees it (US-050, US-056, US-058), built from stored rows and the
 * current listing data. Pure: the service, the /cart page, the API and checkout (US-051) all
 * use `buildCart` and `cartReadyForCheckout`, so they always agree on totals.
 *
 * - Lines are grouped by shop (decision A1: one order per shop), each group with its subtotal,
 *   weight, delivery charge for the zone (D9, src/lib/delivery.ts) and the shop's free-delivery
 *   threshold.
 * - Prices and stock are re-checked on every read: the current price is used; a price that
 *   differs from the one the customer last saw (`priceAtAdd`) is flagged, and checkout waits
 *   until the customer accepts it. A quantity above the stock is capped (with a notice).
 * - Lines that can't be ordered (listing no longer live, or out of stock) are listed apart and
 *   left out of the totals. "Saved for later" lines are listed apart and left out too.
 */

/** Prisma Decimal, number or numeric string. */
export type Money = { toString(): string } | number | string;

/** Highest quantity of one variant in the cart (on top of the stock cap). */
export const MAX_LINE_QUANTITY = 99;
/** Most rows (cart + saved for later) one cart can hold. */
export const MAX_CART_LINES = 100;

export interface CartRow {
  id: string;
  productId: string;
  variantId: string;
  shopId: string;
  quantity: number;
  savedForLater: boolean;
  priceAtAdd: Money;
  createdAt: Date;
  updatedAt: Date;
  variant: { id: string; price: Money; stock: number; options: unknown };
  product: LiveCheck & {
    id: string;
    title: string;
    categoryId: string;
    attributes: unknown;
    images: { id: string }[];
    shop: LiveCheck["shop"] & { id: string; name: string; slug: string; freeDeliveryThreshold: Money | null };
  };
}

export type LineStatus = "available" | "out_of_stock" | "unavailable";

export interface CartLine {
  id: string;
  productId: string;
  variantId: string;
  shopId: string;
  title: string;
  href: string;
  imageId: string | null;
  /** "Size: M, Colour: Black"; null for a product without variant options. */
  variantLabel: string | null;
  /** The quantity to order: the stored one, capped at the stock. */
  quantity: number;
  /** True when the stored quantity was above the stock and has been capped. */
  quantityCapped: boolean;
  stock: number;
  /** Current unit price (Tk). */
  unitPrice: number;
  /** The unit price the customer last saw (Tk). */
  priceAtAdd: number;
  priceChanged: boolean;
  /** unitPrice × quantity (Tk). */
  lineTotal: number;
  /** Weight of one unit in grams (attribute weight_g; 0 when missing). */
  unitWeightGrams: number;
  status: LineStatus;
  savedForLater: boolean;
  /** Messages to show on the line (price change, quantity capped, out of stock...). */
  notices: string[];
}

export interface ShopGroup {
  shop: { id: string; name: string; href: string };
  /** Orderable lines only. */
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  weightGrams: number;
  /** The D9 charge for the weight and zone, before any free-delivery threshold. */
  delivery: DeliveryBreakdown;
  /** Tk to pay for delivery: 0 when the free-delivery threshold is reached. */
  deliveryCharge: number;
  freeDelivery: boolean;
  freeDeliveryThreshold: number | null;
  /** Tk more needed for free delivery; null with no threshold or once reached. */
  amountForFreeDelivery: number | null;
  /** subtotal + deliveryCharge. */
  total: number;
}

export interface Cart {
  zone: DeliveryZone;
  /** One group per shop with at least one orderable line, in the order shops were added. */
  groups: ShopGroup[];
  /** Lines that can't be ordered now (not live or out of stock): not in any total. */
  unavailable: CartLine[];
  /** "Saved for later": not in any total. */
  saved: CartLine[];
  /** Units across all orderable lines. */
  itemCount: number;
  subtotal: number;
  deliveryTotal: number;
  grandTotal: number;
  /** Orderable lines whose price changed since the customer last saw it. */
  priceChangedCount: number;
  /** Stored quantities that must be lowered to the stock (the service saves them). */
  adjustments: { id: string; quantity: number }[];
}

export interface BuildCartOptions {
  zone: DeliveryZone;
  /** Today in Bangladesh (dhakaToday), for listing liveness (expiry). */
  today: Date;
  rates?: DeliveryRates;
  /** Variant label for a row ("Size: M, Colour: Black"); default: the raw options. */
  labelOf?: (row: CartRow) => string | null;
}

// Money is added in paisa (integers) so totals never pick up floating-point dust.
const toPaisa = (m: Money) => Math.round(Number(m.toString()) * 100);
const toTk = (paisa: number) => paisa / 100;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Raw "size: m, colour: black", or null for the single default variant. */
export function rawVariantLabel(options: unknown): string | null {
  if (!isRecord(options) || Object.keys(options).length === 0) return null;
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(", ");
}

/** Weight of one unit from the product attributes (weight_g), 0 when missing. */
export function unitWeight(attributes: unknown): number {
  const w = isRecord(attributes) ? attributes.weight_g : undefined;
  return typeof w === "number" && Number.isFinite(w) && w >= 0 ? w : 0;
}

/** The highest quantity allowed for a variant with this stock (never below 1). */
export function quantityLimit(stock: number): number {
  return Math.max(1, Math.min(stock, MAX_LINE_QUANTITY));
}

/** "Tk 1,850" (two decimals only when needed). */
export function tk(value: number): string {
  return `Tk ${value.toLocaleString("en-US", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function buildLine(row: CartRow, opts: BuildCartOptions): CartLine {
  const live = listingState(row.product, opts.today) === "live";
  const stock = Math.max(0, row.variant.stock);
  const status: LineStatus = !live ? "unavailable" : stock <= 0 ? "out_of_stock" : "available";
  const unitPaisa = toPaisa(row.variant.price);
  const atAddPaisa = toPaisa(row.priceAtAdd);

  let quantity = row.quantity;
  let quantityCapped = false;
  if (status === "available" && !row.savedForLater && quantity > quantityLimit(stock)) {
    quantity = quantityLimit(stock);
    quantityCapped = true;
  }

  const notices: string[] = [];
  if (status === "unavailable") notices.push("No longer available. It won't be ordered.");
  else if (status === "out_of_stock") notices.push("Out of stock. It won't be ordered.");
  if (quantityCapped) {
    notices.push(
      quantity === stock
        ? `Only ${stock} left in stock. We changed the quantity to ${quantity}.`
        : `You can buy up to ${MAX_LINE_QUANTITY} of one item. We changed the quantity to ${quantity}.`,
    );
  }
  const priceChanged = unitPaisa !== atAddPaisa;
  if (priceChanged && status === "available" && !row.savedForLater) {
    notices.push(
      `The price ${unitPaisa > atAddPaisa ? "went up" : "went down"} from ${tk(toTk(atAddPaisa))} to ${tk(toTk(unitPaisa))} since you added it.`,
    );
  }

  return {
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    shopId: row.shopId,
    title: row.product.title,
    href: `/products/${encodeURIComponent(row.productId)}?variant=${encodeURIComponent(row.variantId)}`,
    imageId: row.product.images[0]?.id ?? null,
    variantLabel: opts.labelOf ? opts.labelOf(row) : rawVariantLabel(row.variant.options),
    quantity,
    quantityCapped,
    stock,
    unitPrice: toTk(unitPaisa),
    priceAtAdd: toTk(atAddPaisa),
    priceChanged,
    lineTotal: toTk(unitPaisa * quantity),
    unitWeightGrams: unitWeight(row.product.attributes),
    status,
    savedForLater: row.savedForLater,
    notices,
  };
}

function buildGroup(rows: CartRow[], lines: CartLine[], opts: BuildCartOptions): ShopGroup {
  const shop = rows[0].product.shop;
  const subtotalPaisa = lines.reduce((sum, l) => sum + toPaisa(l.unitPrice) * l.quantity, 0);
  const weightGrams = orderWeightGrams(lines.map((l) => ({ weightGrams: l.unitWeightGrams, quantity: l.quantity })));
  const delivery = deliveryBreakdown({ insideDhaka: opts.zone === "inside_dhaka", weightGrams }, opts.rates ?? DEFAULT_DELIVERY_RATES);
  const thresholdPaisa = shop.freeDeliveryThreshold == null ? null : toPaisa(shop.freeDeliveryThreshold);
  const freeDelivery = thresholdPaisa !== null && subtotalPaisa >= thresholdPaisa;
  const deliveryCharge = freeDelivery ? 0 : delivery.total;
  return {
    shop: { id: shop.id, name: shop.name, href: `/s/${shop.slug}` },
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: toTk(subtotalPaisa),
    weightGrams,
    delivery,
    deliveryCharge,
    freeDelivery,
    freeDeliveryThreshold: thresholdPaisa === null ? null : toTk(thresholdPaisa),
    amountForFreeDelivery: thresholdPaisa === null || freeDelivery ? null : toTk(thresholdPaisa - subtotalPaisa),
    total: toTk(subtotalPaisa + deliveryCharge * 100),
  };
}

/** The cart view of stored rows (any order; lines are shown oldest first). */
export function buildCart(rows: readonly CartRow[], opts: BuildCartOptions): Cart {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const byShop = new Map<string, { rows: CartRow[]; lines: CartLine[] }>();
  const unavailable: CartLine[] = [];
  const saved: CartLine[] = [];
  const adjustments: { id: string; quantity: number }[] = [];

  for (const row of sorted) {
    const line = buildLine(row, opts);
    if (line.quantityCapped) adjustments.push({ id: line.id, quantity: line.quantity });
    if (row.savedForLater) saved.push(line);
    else if (line.status !== "available") unavailable.push(line);
    else {
      const entry = byShop.get(row.shopId) ?? { rows: [], lines: [] };
      entry.rows.push(row);
      entry.lines.push(line);
      byShop.set(row.shopId, entry);
    }
  }

  const groups = [...byShop.values()].map((g) => buildGroup(g.rows, g.lines, opts));
  const subtotalPaisa = groups.reduce((sum, g) => sum + toPaisa(g.subtotal), 0);
  const deliveryTotal = groups.reduce((sum, g) => sum + g.deliveryCharge, 0);
  return {
    zone: opts.zone,
    groups,
    unavailable,
    saved,
    itemCount: groups.reduce((n, g) => n + g.itemCount, 0),
    subtotal: toTk(subtotalPaisa),
    deliveryTotal,
    grandTotal: toTk(subtotalPaisa + deliveryTotal * 100),
    priceChangedCount: groups.reduce((n, g) => n + g.lines.filter((l) => l.priceChanged).length, 0),
    adjustments,
  };
}

export interface Readiness {
  ready: boolean;
  /** Why checkout can't continue yet (shown next to the disabled Checkout button). */
  reasons: string[];
}

/**
 * Whether checkout (US-051) may continue: at least one orderable line, and every changed price
 * accepted (PATCH acknowledgePrice). Unavailable and saved lines don't block: they aren't ordered.
 */
export function cartReadyForCheckout(cart: Pick<Cart, "groups">): Readiness {
  const reasons: string[] = [];
  if (cart.groups.length === 0) reasons.push("Your cart has no items that can be ordered.");
  const changed = cart.groups.reduce((n, g) => n + g.lines.filter((l) => l.priceChanged).length, 0);
  if (changed > 0) {
    reasons.push(
      changed === 1
        ? "The price of 1 item changed. Accept the new price to continue."
        : `The prices of ${changed} items changed. Accept the new prices to continue.`,
    );
  }
  return { ready: reasons.length === 0, reasons };
}

// ---- Delivery zone -------------------------------------------------------------------------

export const DELIVERY_ZONES: readonly DeliveryZone[] = ["inside_dhaka", "outside_dhaka"];
export const ZONE_LABELS: Record<DeliveryZone, string> = {
  inside_dhaka: "Inside Dhaka",
  outside_dhaka: "Outside Dhaka",
};

export function parseZone(value: unknown): DeliveryZone | null {
  return typeof value === "string" && (DELIVERY_ZONES as readonly string[]).includes(value) ? (value as DeliveryZone) : null;
}

/**
 * Inside Dhaka = an address in Dhaka district (Dhaka division). Couriers' "inside Dhaka" rate
 * covers the city; the district is the closest field our addresses have. Other districts of
 * Dhaka division (Gazipur, Narayanganj...) are outside Dhaka.
 */
export function isInsideDhaka(address: { division?: string | null; district?: string | null } | null | undefined): boolean {
  return (address?.district ?? "").trim().toLowerCase() === "dhaka";
}

export type ZoneSource = "chosen" | "address" | "default";

/**
 * The zone to price delivery with: the customer's choice on the cart page (cookie) wins, then the
 * logged-in customer's default address, then inside Dhaka (the cart page asks to choose).
 */
export function resolveZone(input: {
  chosen?: unknown;
  defaultAddress?: { division?: string | null; district?: string | null } | null;
}): { zone: DeliveryZone; source: ZoneSource } {
  const chosen = parseZone(input.chosen);
  if (chosen) return { zone: chosen, source: "chosen" };
  if (input.defaultAddress) return { zone: isInsideDhaka(input.defaultAddress) ? "inside_dhaka" : "outside_dhaka", source: "address" };
  return { zone: "inside_dhaka", source: "default" };
}
