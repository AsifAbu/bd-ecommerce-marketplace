import { cartReadyForCheckout, type Cart } from "@/features/cart";
import { describeDelivery, type DeliveryZone } from "@/lib/delivery";

/**
 * What the checkout page shows before "Place order" (US-051): one block per future shop order
 * with its items, ONE delivery charge for the zone of the chosen address, and its total, then the
 * grand total. Built from the same cart model the placement uses, so the page and the order agree.
 */

export interface ReviewShop {
  shopId: string;
  shopName: string;
  lines: { id: string; title: string; variantLabel: string | null; quantity: number; unitPrice: number; lineTotal: number }[];
  itemCount: number;
  subtotal: number;
  deliveryCharge: number;
  /** "Tk 130 (up to 1 kg)" or "Free delivery (orders of Tk 10,000 or more)". */
  deliveryLabel: string;
  total: number;
}

export interface Review {
  zone: DeliveryZone;
  shops: ReviewShop[];
  itemCount: number;
  subtotal: number;
  deliveryTotal: number;
  grandTotal: number;
  ready: boolean;
  reasons: string[];
  /** Lines left out because they can't be ordered (out of stock, not live). */
  leftOut: string[];
}

const tk = (n: number) => `Tk ${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function toReview(cart: Cart): Review {
  const readiness = cartReadyForCheckout(cart);
  return {
    zone: cart.zone,
    shops: cart.groups.map((g) => ({
      shopId: g.shop.id,
      shopName: g.shop.name,
      lines: g.lines.map((l) => ({
        id: l.id,
        title: l.title,
        variantLabel: l.variantLabel,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
      itemCount: g.itemCount,
      subtotal: g.subtotal,
      deliveryCharge: g.deliveryCharge,
      deliveryLabel:
        g.freeDelivery && g.freeDeliveryThreshold !== null
          ? `Free delivery (orders of ${tk(g.freeDeliveryThreshold)} or more)`
          : describeDelivery(g.delivery),
      total: g.total,
    })),
    itemCount: cart.itemCount,
    subtotal: cart.subtotal,
    deliveryTotal: cart.deliveryTotal,
    grandTotal: cart.grandTotal,
    ready: readiness.ready,
    reasons: readiness.reasons,
    leftOut: cart.unavailable.map((l) => l.title),
  };
}
