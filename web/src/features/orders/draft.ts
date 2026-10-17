import type { Cart } from "@/features/cart";
import type { DeliveryZone } from "@/lib/delivery";
import type { OrderConfig } from "./config";

/**
 * The order to write, built from the cart the server just re-read (never from client prices).
 * Pure money logic, unit-tested: amounts are added in paisa (integers) and written as Tk with
 * 2 decimals. One shop order per cart group (A1), each with the group's own delivery charge
 * (D9, already 0 when the free-delivery threshold is reached), the VAT contained in the
 * VAT-inclusive item prices, and the platform commission per item (D10, 0 under the D15 offer).
 */

export interface AddressSnapshot {
  name: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  area: string;
  line1: string;
}

/** Listing data the cart does not carry: per variant. */
export interface ItemFacts {
  sku: string | null;
  warranty: string | null;
  categoryId: string;
  /** Category commission rate in percent (D10). */
  commissionRate: number;
}

export interface ShopFacts {
  name: string;
  tier: "basic" | "verified";
  /** "Trade licence TEST-TL-0001"; null without a registration (Basic shops). */
  registration: string | null;
}

export interface DraftItem {
  cartItemId: string;
  productId: string;
  variantId: string;
  categoryId: string;
  title: string;
  variantLabel: string | null;
  sku: string | null;
  /** Tk with 2 decimals, e.g. "1850.00". */
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  unitWeightGrams: number;
  warranty: string | null;
  commissionRate: string;
}

export interface DraftShopOrder {
  shopId: string;
  seq: number;
  shopName: string;
  shopRegistration: string | null;
  itemsSubtotal: string;
  weightGrams: number;
  deliveryCharge: string;
  freeDelivery: boolean;
  total: string;
  vatRate: string;
  vatAmount: string;
  commissionAmount: string;
  launchOffer: boolean;
  handoverDueAt: Date;
  items: DraftItem[];
}

export interface OrderDraft {
  orderNo: string;
  userId: string | null;
  linkedVia: string | null;
  contactName: string;
  contactPhone: string;
  phoneVerifiedAt: Date;
  contactEmail: string | null;
  address: AddressSnapshot;
  zone: DeliveryZone;
  itemsSubtotal: string;
  deliveryTotal: string;
  grandTotal: string;
  policyVersions: { slug: string; version: number }[];
  idempotencyKey: string;
  placedAt: Date;
  shopOrders: DraftShopOrder[];
}

export interface DraftInput {
  cart: Pick<Cart, "zone" | "groups">;
  facts: ReadonlyMap<string, ItemFacts>;
  shops: ReadonlyMap<string, ShopFacts>;
  config: Pick<OrderConfig, "handoverHours" | "vatRatePercent" | "launchOfferUntil">;
  now: Date;
  orderNo: string;
  userId: string | null;
  linkedVia: string | null;
  contact: { name: string; phone: string; email: string | null };
  phoneVerifiedAt: Date;
  address: AddressSnapshot;
  policyVersions: { slug: string; version: number }[];
  idempotencyKey: string;
}

export const toPaisa = (tk: number | string) => Math.round(Number(tk) * 100);
export const paisaToTk = (paisa: number) => (paisa / 100).toFixed(2);

/** VAT contained in a VAT-inclusive amount: amount × rate / (100 + rate), rounded to the paisa. */
export function includedVat(amountPaisa: number, ratePercent: number): number {
  if (ratePercent <= 0) return 0;
  return Math.round((amountPaisa * ratePercent) / (100 + ratePercent));
}

/** Commission on one line, rounded to the paisa. */
export function commissionOn(linePaisa: number, ratePercent: number): number {
  return Math.round((linePaisa * ratePercent) / 100);
}

/** True while the D15 launch offer (0% commission) runs. */
export function launchOfferActive(config: Pick<OrderConfig, "launchOfferUntil">, now: Date): boolean {
  return config.launchOfferUntil !== null && now.getTime() < config.launchOfferUntil.getTime();
}

export class MissingFactsError extends Error {
  constructor(readonly what: string) {
    super(`Missing listing data for ${what}`);
  }
}

export function buildOrderDraft(input: DraftInput): OrderDraft {
  const { cart, config, now } = input;
  const offer = launchOfferActive(config, now);
  const handoverDueAt = new Date(now.getTime() + config.handoverHours * 3_600_000);
  let itemsPaisa = 0;
  let deliveryPaisa = 0;

  const shopOrders = cart.groups.map((group, i): DraftShopOrder => {
    const shop = input.shops.get(group.shop.id);
    if (!shop) throw new MissingFactsError(`shop ${group.shop.id}`);
    let subtotal = 0;
    let commission = 0;
    const items = group.lines.map((line): DraftItem => {
      const facts = input.facts.get(line.variantId);
      if (!facts) throw new MissingFactsError(`variant ${line.variantId}`);
      const unit = toPaisa(line.unitPrice);
      const lineTotal = unit * line.quantity;
      const rate = offer ? 0 : facts.commissionRate;
      subtotal += lineTotal;
      commission += commissionOn(lineTotal, rate);
      return {
        cartItemId: line.id,
        productId: line.productId,
        variantId: line.variantId,
        categoryId: facts.categoryId,
        title: line.title,
        variantLabel: line.variantLabel,
        sku: facts.sku,
        unitPrice: paisaToTk(unit),
        quantity: line.quantity,
        lineTotal: paisaToTk(lineTotal),
        unitWeightGrams: Math.round(line.unitWeightGrams),
        warranty: facts.warranty,
        commissionRate: rate.toFixed(2),
      };
    });
    const delivery = toPaisa(group.deliveryCharge);
    itemsPaisa += subtotal;
    deliveryPaisa += delivery;
    return {
      shopId: group.shop.id,
      seq: i + 1,
      shopName: shop.name,
      shopRegistration: shop.registration,
      itemsSubtotal: paisaToTk(subtotal),
      weightGrams: Math.round(group.weightGrams),
      deliveryCharge: paisaToTk(delivery),
      freeDelivery: group.freeDelivery,
      total: paisaToTk(subtotal + delivery),
      vatRate: config.vatRatePercent.toFixed(2),
      vatAmount: paisaToTk(includedVat(subtotal, config.vatRatePercent)),
      commissionAmount: paisaToTk(commission),
      launchOffer: offer,
      handoverDueAt,
      items,
    };
  });

  return {
    orderNo: input.orderNo,
    userId: input.userId,
    linkedVia: input.linkedVia,
    contactName: input.contact.name,
    contactPhone: input.contact.phone,
    phoneVerifiedAt: input.phoneVerifiedAt,
    contactEmail: input.contact.email,
    address: input.address,
    zone: cart.zone,
    itemsSubtotal: paisaToTk(itemsPaisa),
    deliveryTotal: paisaToTk(deliveryPaisa),
    grandTotal: paisaToTk(itemsPaisa + deliveryPaisa),
    policyVersions: input.policyVersions,
    idempotencyKey: input.idempotencyKey,
    placedAt: now,
    shopOrders,
  };
}
