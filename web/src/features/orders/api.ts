import { z } from "zod";
import { addressSchema, bdMobile, email as emailSchema, type AddressInput } from "@/features/accounts";
import type { CartOwner } from "@/features/cart";
import { fieldErrors } from "@/lib/actions";
import type { AddressSnapshot } from "./draft";
import { OrderError, readJson, respond } from "./errors";
import type { OrderOtp } from "./otp";
import type { PlacementService } from "./placement";
import { toOrderView, type OrderRowLike, type OrderView } from "./views";

/**
 * JSON API of checkout and orders (standard error shape `{ error: { code, message, fields? } }`):
 *
 *   POST /api/checkout           place a COD order (logged in or guest) -> 201 { orderNo, orderId, replayed, attachedToAccount, url }
 *        logged in: { idempotencyKey, addressId | address, acceptPolicies, policyVersions? }
 *        guest:     { idempotencyKey, contact: { name, phone, email }, address: { division, district, upazila, area, line1 },
 *                     acceptPolicies, policyVersions? }  (needs the phone proof cookie from /api/checkout/otp)
 *   POST /api/checkout/otp       { action: "send", phone } | { action: "verify", phone, code } -> sets the phone proof cookie
 *   GET  /api/orders             (logged in) -> { orders: OrderView[] }
 *   GET  /api/orders/[orderNo]   the user's own order, or one this browser may open (grant) -> { order }
 *   POST /api/track              { orderNo } sends a code to the order's mobile; { orderNo, code } -> { order } + grant cookie
 *
 * The cart owner, user and cookies come from the session, never from the body.
 */

export const PHONE_PROOF_COOKIE = "checkout_phone";
export const ORDER_ACCESS_COOKIE = "order_access";

export interface ApiUser {
  id: string;
  name: string | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  email: string | null;
}

export interface OrdersApiDeps {
  currentUser(): Promise<ApiUser | null>;
  /** The cart of this request: the user's, or this guest device's (null without one). */
  cartOwner(): Promise<CartOwner | null>;
  addresses: {
    get(userId: string, id: string): Promise<AddressSnapshot | null>;
    create(userId: string, input: AddressInput): Promise<unknown>;
  };
  placement: Pick<PlacementService, "place">;
  otp: OrderOtp;
  cookies: {
    get(name: string): Promise<string | undefined>;
    set(name: string, value: string, maxAgeSec: number): Promise<void>;
  };
  meta(): Promise<{ ip: string | null; userAgent: string | null }>;
  readPhoneProof(value: string | undefined): { phone: string; verifiedAt: Date } | null;
  hasGrant(value: string | undefined, orderNo: string): boolean;
  addGrant(value: string | undefined, orderNo: string): string;
  phoneProofMaxAgeSec: number;
  orderAccessMaxAgeSec: number;
  orders: {
    listForUser(userId: string): Promise<OrderRowLike[]>;
    getForUser(userId: string, orderNo: string): Promise<OrderRowLike | null>;
    getByNo(orderNo: string): Promise<OrderRowLike | null>;
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const accepted = (v: unknown) => v === true || v === "on" || v === "true";

function shownVersions(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => Number.isInteger(v) && (v as number) > 0)) as Record<string, number>;
}

const guestContact = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  phone: bdMobile,
  email: emailSchema,
});

function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown, prefix = ""): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    const fields = Object.fromEntries(Object.entries(fieldErrors(r.error)).map(([k, v]) => [`${prefix}${k}`, v]));
    throw new OrderError(422, "VALIDATION", "Check the highlighted fields", fields);
  }
  return r.data;
}

const snapshot = (a: AddressInput): AddressSnapshot => ({
  name: a.name,
  phone: a.phone,
  division: a.division,
  district: a.district,
  upazila: a.upazila,
  area: a.area,
  line1: a.line1,
});

export function createOrdersApi(deps: OrdersApiDeps) {
  /** The order this request may see: the user's own, else one this browser holds a grant for. */
  async function viewableOrder(orderNo: string): Promise<OrderView | null> {
    const user = await deps.currentUser();
    if (user) {
      const own = await deps.orders.getForUser(user.id, orderNo);
      if (own) return toOrderView(own);
    }
    if (!deps.hasGrant(await deps.cookies.get(ORDER_ACCESS_COOKIE), orderNo)) return null;
    const row = await deps.orders.getByNo(orderNo);
    return row ? toOrderView(row) : null;
  }

  async function grant(orderNo: string) {
    const value = deps.addGrant(await deps.cookies.get(ORDER_ACCESS_COOKIE), orderNo);
    await deps.cookies.set(ORDER_ACCESS_COOKIE, value, deps.orderAccessMaxAgeSec);
  }

  async function checkout(body: Record<string, unknown>) {
    const user = await deps.currentUser();
    const owner = await deps.cartOwner();
    if (!owner) throw new OrderError(409, "CART_NOT_READY", "Your cart has no items that can be ordered.");
    const consent = { accepted: accepted(body.acceptPolicies), shownVersions: shownVersions(body.policyVersions) };
    const meta = await deps.meta();

    if (user) {
      let address: AddressSnapshot | null = null;
      let toSave: AddressInput | null = null;
      if (typeof body.addressId === "string" && body.addressId) {
        address = await deps.addresses.get(user.id, body.addressId);
        if (!address) throw new OrderError(422, "VALIDATION", "Choose a delivery address", { addressId: "Choose one of your addresses" });
      } else if (isRecord(body.address)) {
        toSave = parseOrThrow(addressSchema, { ...body.address, isDefault: false }, "address.");
        address = snapshot(toSave);
      } else {
        throw new OrderError(422, "VALIDATION", "Choose a delivery address", { addressId: "Choose an address or add a new one" });
      }
      const result = await deps.placement.place({
        owner,
        customer: { kind: "user", userId: user.id, name: user.name, phone: user.phone, phoneVerifiedAt: user.phoneVerifiedAt, email: user.email },
        address,
        consent,
        idempotencyKey: body.idempotencyKey,
        meta,
      });
      if (toSave && !result.replayed) {
        // The address book is a convenience: the order already holds its own copy.
        await deps.addresses.create(user.id, toSave).catch((err: unknown) => console.error("[orders] new address not saved", err));
      }
      return { ...result, url: `/orders/${result.orderNo}` };
    }

    const contact = parseOrThrow(guestContact, isRecord(body.contact) ? body.contact : {}, "contact.");
    const addressInput = parseOrThrow(
      addressSchema,
      { ...(isRecord(body.address) ? body.address : {}), name: contact.name, phone: contact.phone.replace(/^\+88/, ""), isDefault: false },
      "address.",
    );
    const result = await deps.placement.place({
      owner,
      customer: {
        kind: "guest",
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        verifiedPhone: deps.readPhoneProof(await deps.cookies.get(PHONE_PROOF_COOKIE)),
      },
      address: snapshot(addressInput),
      consent,
      idempotencyKey: body.idempotencyKey,
      meta,
    });
    await grant(result.orderNo);
    return { ...result, url: `/orders/${result.orderNo}` };
  }

  return {
    viewableOrder,

    checkout: (req: Request) =>
      respond(async () => Response.json(await checkout(await readJson(req)), { status: 201 })),

    checkoutOtp: (req: Request) =>
      respond(async () => {
        const body = await readJson(req);
        const { ip } = await deps.meta();
        if (body.action === "send") return deps.otp.sendCheckoutCode(body.phone, ip);
        if (body.action === "verify") {
          const user = await deps.currentUser();
          const res = await deps.otp.verifyCheckoutCode(body.phone, body.code, user ? { id: user.id, phone: user.phone } : null);
          await deps.cookies.set(PHONE_PROOF_COOKIE, res.proof, deps.phoneProofMaxAgeSec);
          return { verified: true, phone: res.phone.replace(/^\+88/, ""), accountExists: res.accountExists, message: res.message };
        }
        throw new OrderError(422, "VALIDATION", 'Send action "send" or "verify"', { action: 'Use "send" or "verify"' });
      }),

    listOrders: () =>
      respond(async () => {
        const user = await deps.currentUser();
        if (!user) throw new OrderError(401, "UNAUTHORIZED", "Login required");
        return { orders: (await deps.orders.listForUser(user.id)).map(toOrderView) };
      }),

    getOrder: (orderNo: string) =>
      respond(async () => {
        const order = await viewableOrder(orderNo.toUpperCase());
        if (!order) throw new OrderError(404, "NOT_FOUND", "Order not found");
        return { order };
      }),

    track: (req: Request) =>
      respond(async () => {
        const body = await readJson(req);
        const { ip } = await deps.meta();
        if (body.code === undefined) return deps.otp.sendTrackCode(body.orderNo, ip);
        const res = await deps.otp.verifyTrackCode(body.orderNo, body.code, await deps.cookies.get(ORDER_ACCESS_COOKIE));
        await deps.cookies.set(ORDER_ACCESS_COOKIE, res.grants, deps.orderAccessMaxAgeSec);
        const row = await deps.orders.getByNo(res.orderNo);
        if (!row) throw new OrderError(404, "NOT_FOUND", "Order not found");
        return { order: toOrderView(row), url: `/orders/${res.orderNo}` };
      }),
  };
}

export type OrdersApi = ReturnType<typeof createOrdersApi>;
