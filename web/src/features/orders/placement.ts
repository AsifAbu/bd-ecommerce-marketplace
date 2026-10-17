import { createHash } from "node:crypto";
import { cartReadyForCheckout, isInsideDhaka, type Cart, type CartOwner } from "@/features/cart";
import type { DeliveryZone } from "@/lib/delivery";
import type { OrderConfig } from "./config";
import { buildOrderDraft, type AddressSnapshot, type ItemFacts, type OrderDraft, type ShopFacts } from "./draft";
import { OrderError } from "./errors";
import { assertCodAllowed, assertShopsCanTakeOrders, type CodHistory } from "./limits";

/**
 * Cash-on-delivery order placement (US-051, guest checkout US-007), with every dependency
 * injected so the rules are unit-tested. The order of checks:
 *
 *  1. idempotency: the same form submitted twice returns the first order;
 *  2. verified mobile: an account needs its verified phone, a guest a fresh OTP proof for the
 *     contact mobile (test code 123456);
 *  3. the cart is re-read with the zone of the chosen address (inside Dhaka = Dhaka district)
 *     and must be ready (orderable lines, changed prices accepted);
 *  4. fake-order limits (D8) for the mobile, then the Basic-shop open-order limit (D14);
 *  5. the current Return and Delivery policies (+ Privacy for guests) must be accepted: a ticked
 *     box records the acceptance, and the versions are stored on the order;
 *  6. one transaction (store.place): conditional stock decrement per variant, the order with one
 *     shop order per shop and item snapshots, and the ordered cart lines removed;
 *  7. one notification job (one SMS + one email invoice for all shop orders). A failure to queue
 *     it is logged and never fails the order.
 */

export interface PlacedOrder {
  id: string;
  orderNo: string;
  userId: string | null;
}

/** The transaction found a variant without enough stock (or with a new price, or gone). */
export class StockConflictError extends Error {
  constructor(
    readonly variantId: string,
    readonly title: string,
    readonly available: number,
    readonly reason: "stock" | "price" | "gone",
  ) {
    super(`Stock conflict on ${variantId}`);
    this.name = "StockConflictError";
  }
}

/** The order number was taken (a new one is tried). */
export class OrderNoTakenError extends Error {}
/** Another request with the same idempotency key won the race. */
export class DuplicateSubmitError extends Error {}

export interface PlacementStore {
  findByIdempotencyKey(key: string): Promise<PlacedOrder | null>;
  codHistory(phone: string, userId: string | null): Promise<CodHistory>;
  /** Shop data with its open shop-order count and its tier's limit (null = no limit). */
  shopFacts(shopIds: string[]): Promise<Map<string, ShopFacts & { openOrders: number; maxOpenOrders: number | null }>>;
  itemFacts(variantIds: string[]): Promise<Map<string, ItemFacts>>;
  /** An account whose phone is this number AND verified (a guest order attaches to it). */
  findAccountByVerifiedPhone(phone: string): Promise<{ id: string } | null>;
  /** One transaction. Throws StockConflictError, OrderNoTakenError or DuplicateSubmitError. */
  place(draft: OrderDraft, owner: CartOwner, cartItemIds: string[]): Promise<PlacedOrder>;
}

export interface PlacementPolicies {
  /** Records acceptance of the current versions; throws an AppError if the shown versions are stale. */
  recordAcceptance(input: {
    userId?: string | null;
    guestPhone?: string | null;
    slugs: readonly string[];
    shownVersions: Record<string, number>;
    ip: string | null;
    userAgent: string | null;
  }): Promise<{ slug: string; version: number }[]>;
  /** Throws 422 POLICY_ACCEPTANCE_REQUIRED unless the user accepted every current version. */
  assertAcceptedCurrent(userId: string, slugs: readonly string[]): Promise<void>;
  getCurrentVersions(slugs: readonly string[]): Promise<{ slug: string; version: number }[]>;
}

export interface PlacementDeps {
  config: Pick<OrderConfig, "maxOpenCodOrdersWithoutDelivery" | "refusalsBlockingCod" | "handoverHours" | "vatRatePercent" | "launchOfferUntil">;
  now: () => Date;
  newOrderNo: (now: Date) => string;
  getCart: (owner: CartOwner, zone: DeliveryZone) => Promise<Cart>;
  store: PlacementStore;
  policies: PlacementPolicies;
  /** Policy slugs: Return + Delivery for accounts, + Privacy for guests. */
  slugs: { account: readonly string[]; guest: readonly string[] };
  /** Queues the confirmation SMS + email invoice. May throw; the service logs it. */
  enqueueNotification: (orderId: string) => Promise<unknown>;
  /** Stock changed for these products (search re-index). Must not throw. */
  onStockChanged?: (productIds: string[]) => void;
  log?: (message: string, err?: unknown) => void;
}

export type CheckoutCustomer =
  | {
      kind: "user";
      userId: string;
      name: string | null;
      phone: string | null;
      phoneVerifiedAt: Date | null;
      email: string | null;
    }
  | {
      kind: "guest";
      name: string;
      phone: string;
      email: string;
      /** The mobile this browser verified by OTP (phone proof cookie), if any. */
      verifiedPhone: { phone: string; verifiedAt: Date } | null;
    };

export interface PlaceOrderCommand {
  owner: CartOwner;
  customer: CheckoutCustomer;
  address: AddressSnapshot;
  consent: { accepted: boolean; shownVersions: Record<string, number> };
  idempotencyKey: unknown;
  meta: { ip: string | null; userAgent: string | null };
}

export interface PlaceOrderResult {
  orderId: string;
  orderNo: string;
  /** True when the same submit was already placed (idempotent replay). */
  replayed: boolean;
  /** Guest order attached to the account with the same verified mobile. */
  attachedToAccount: boolean;
  /** Present when the order was placed now (not on a replay). */
  shopOrderCount?: number;
  grandTotal?: string;
}

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;
const ORDER_NO_ATTEMPTS = 3;

/** The stored key: SHA-256 of the owner and the form's key, so keys of different customers never meet. */
export function scopedIdempotencyKey(owner: CartOwner, key: string): string {
  const scope = owner.kind === "user" ? `u:${owner.userId}` : `g:${owner.guestToken}`;
  return createHash("sha256").update(`${scope}:${key}`).digest("hex");
}

export function createPlacementService(deps: PlacementDeps) {
  const log = deps.log ?? ((message: string, err?: unknown) => console.error(`[orders] ${message}`, err ?? ""));

  function verifiedContact(customer: CheckoutCustomer, address: AddressSnapshot) {
    if (customer.kind === "user") {
      if (!customer.phone) {
        throw new OrderError(422, "PHONE_REQUIRED", "Add your mobile number to your profile and verify it before you order.");
      }
      if (!customer.phoneVerifiedAt) {
        throw new OrderError(422, "PHONE_NOT_VERIFIED", "Verify your mobile number with the code we send by SMS before you order.");
      }
      return {
        name: customer.name?.trim() || address.name,
        phone: customer.phone,
        email: customer.email,
        verifiedAt: customer.phoneVerifiedAt,
      };
    }
    const proof = customer.verifiedPhone;
    if (!proof || proof.phone !== customer.phone) {
      throw new OrderError(422, "PHONE_NOT_VERIFIED", "Verify your mobile number with the code we send by SMS before you order.", {
        phone: "Verify this mobile number first",
      });
    }
    return { name: customer.name, phone: customer.phone, email: customer.email, verifiedAt: proof.verifiedAt };
  }

  async function acceptPolicies(cmd: PlaceOrderCommand, phone: string) {
    const { customer, consent, meta } = cmd;
    if (customer.kind === "user") {
      const slugs = deps.slugs.account;
      if (consent.accepted) {
        return deps.policies.recordAcceptance({ userId: customer.userId, slugs, shownVersions: consent.shownVersions, ...meta });
      }
      await deps.policies.assertAcceptedCurrent(customer.userId, slugs);
      return deps.policies.getCurrentVersions(slugs);
    }
    const slugs = deps.slugs.guest;
    if (!consent.accepted) {
      throw new OrderError(422, "POLICY_ACCEPTANCE_REQUIRED", "Accept the Return and Delivery policies and the Privacy Policy to place your order.", {
        acceptPolicies: "Tick the box to accept the policies",
      });
    }
    return deps.policies.recordAcceptance({ guestPhone: phone, slugs, shownVersions: consent.shownVersions, ...meta });
  }

  async function place(cmd: PlaceOrderCommand): Promise<PlaceOrderResult> {
    if (typeof cmd.idempotencyKey !== "string" || !KEY_PATTERN.test(cmd.idempotencyKey)) {
      throw new OrderError(422, "VALIDATION", "The checkout form is out of date. Reload the page and try again.", {
        idempotencyKey: "Missing or invalid",
      });
    }
    const key = scopedIdempotencyKey(cmd.owner, cmd.idempotencyKey);
    const previous = await deps.store.findByIdempotencyKey(key);
    if (previous) return { orderId: previous.id, orderNo: previous.orderNo, replayed: true, attachedToAccount: false };

    const contact = verifiedContact(cmd.customer, cmd.address);

    const zone: DeliveryZone = isInsideDhaka(cmd.address) ? "inside_dhaka" : "outside_dhaka";
    const cart = await deps.getCart(cmd.owner, zone);
    const readiness = cartReadyForCheckout(cart);
    if (!readiness.ready) throw new OrderError(409, "CART_NOT_READY", readiness.reasons.join(" "));

    const userId = cmd.customer.kind === "user" ? cmd.customer.userId : null;
    assertCodAllowed(await deps.store.codHistory(contact.phone, userId), deps.config);

    const shopIds = cart.groups.map((g) => g.shop.id);
    const shops = await deps.store.shopFacts(shopIds);
    assertShopsCanTakeOrders(
      shopIds.map((id) => {
        const s = shops.get(id);
        return { id, name: s?.name ?? "A shop", maxOpenOrders: s?.maxOpenOrders ?? null, openOrders: s?.openOrders ?? 0 };
      }),
    );

    const policyVersions = (await acceptPolicies(cmd, contact.phone)).map((p) => ({ slug: p.slug, version: p.version }));

    // A guest who verified the mobile of an account (whose own phone is verified) orders into it.
    let ownerId = userId;
    let linkedVia: string | null = null;
    if (cmd.customer.kind === "guest") {
      const account = await deps.store.findAccountByVerifiedPhone(contact.phone);
      if (account) {
        ownerId = account.id;
        linkedVia = "checkout_phone";
      }
    }

    const lines = cart.groups.flatMap((g) => g.lines);
    const facts = await deps.store.itemFacts([...new Set(lines.map((l) => l.variantId))]);
    const cartItemIds = lines.map((l) => l.id);

    let placed: PlacedOrder | null = null;
    let draft: OrderDraft | null = null;
    for (let attempt = 1; !placed; attempt++) {
      const now = deps.now();
      draft = buildOrderDraft({
        cart,
        facts,
        shops,
        config: deps.config,
        now,
        orderNo: deps.newOrderNo(now),
        userId: ownerId,
        linkedVia,
        contact: { name: contact.name, phone: contact.phone, email: contact.email },
        phoneVerifiedAt: contact.verifiedAt,
        address: cmd.address,
        policyVersions,
        idempotencyKey: key,
      });
      try {
        placed = await deps.store.place(draft, cmd.owner, cartItemIds);
      } catch (err) {
        if (err instanceof OrderNoTakenError && attempt < ORDER_NO_ATTEMPTS) continue;
        if (err instanceof DuplicateSubmitError) {
          const winner = await deps.store.findByIdempotencyKey(key);
          if (winner) return { orderId: winner.id, orderNo: winner.orderNo, replayed: true, attachedToAccount: false };
        }
        if (err instanceof StockConflictError) throw stockError(err);
        throw err;
      }
    }

    try {
      await deps.enqueueNotification(placed.id);
    } catch (err) {
      log(`confirmation for ${placed.orderNo} not queued; the order is placed`, err);
    }
    deps.onStockChanged?.([...new Set(lines.map((l) => l.productId))]);

    return {
      orderId: placed.id,
      orderNo: placed.orderNo,
      replayed: false,
      attachedToAccount: linkedVia !== null,
      shopOrderCount: draft!.shopOrders.length,
      grandTotal: draft!.grandTotal,
    };
  }

  return { place };
}

function stockError(err: StockConflictError): OrderError {
  const message =
    err.reason === "price"
      ? `The price of ${err.title} changed just now. Check your cart and try again.`
      : err.reason === "gone" || err.available <= 0
        ? `${err.title} sold out just now. Remove it from your cart to order the rest.`
        : `Only ${err.available} of ${err.title} left now. Lower the quantity in your cart and try again.`;
  return new OrderError(409, err.reason === "price" ? "PRICE_CHANGED" : "OUT_OF_STOCK", message, { [err.variantId]: message });
}

export type PlacementService = ReturnType<typeof createPlacementService>;
