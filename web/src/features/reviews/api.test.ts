import { describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { createReviewsApi } from "./api";
import { ReviewError } from "./errors";

// The JSON API: guests 401, customers can't moderate (403), shops act only through the guard's
// shopId, reviews can't be deleted (405), and errors use { error: { code, message, fields? } }.

type Role = "guest" | "customer" | "admin";

function setup(role: Role = "customer", member = true) {
  const service = {
    create: vi.fn(async () => ({ id: "r1", productId: "p1" })),
    update: vi.fn(async () => ({ id: "r1", productId: "p1" })),
    hide: vi.fn(async () => ({ id: "r1", status: "hidden" as const })),
    unhide: vi.fn(async () => ({ id: "r1", status: "visible" as const })),
    reply: vi.fn(async () => ({ id: "r1" })),
    productReviews: vi.fn(async () => ({ rating: { count: 0, average: null, histogram: [] }, reviews: [], page: 1, perPage: 10, total: 0, totalPages: 1 })),
  };
  const api = createReviewsApi({
    requireUser: async () => {
      if (role === "guest") throw new UnauthorizedError();
      return { id: role === "admin" ? "admin1" : "u1" };
    },
    requirePlatformAdmin: async () => {
      if (role === "guest") throw new UnauthorizedError();
      if (role !== "admin") throw new ForbiddenError();
      return { id: "admin1" };
    },
    requireShopRole: async (shopId) => {
      if (role === "guest") throw new UnauthorizedError();
      if (!member) throw new ForbiddenError("Not allowed for this shop");
      return { shopId, user: { id: "u1" } };
    },
    service,
    isLiveProduct: async (id) => id === "live",
  });
  return { api, service };
}

const json = (body: unknown, method = "POST") =>
  new Request("http://test/api/reviews", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("reviews JSON API", () => {
  it("POST /api/reviews: 201 for a customer, 401 for a guest", async () => {
    const { api, service } = setup();
    const res = await api.create(json({ orderItemId: "oi1", rating: 5 }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ review: { id: "r1", productId: "p1" } });
    expect(service.create).toHaveBeenCalledWith("u1", { orderItemId: "oi1", rating: 5 });

    const guest = setup("guest");
    const denied = await guest.api.create(json({ orderItemId: "oi1", rating: 5 }));
    expect(denied.status).toBe(401);
    expect(await denied.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "Login required" } });
    expect(guest.service.create).not.toHaveBeenCalled();
  });

  it("rule errors keep the standard shape (e.g. a shop member)", async () => {
    const { api, service } = setup();
    service.create.mockRejectedValueOnce(new ReviewError(403, "SHOP_MEMBER", "Shop owners and staff can't review products of their own shop"));
    const res = await api.create(json({ orderItemId: "oi1", rating: 5 }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "SHOP_MEMBER", message: "Shop owners and staff can't review products of their own shop" } });
  });

  it("writes must be JSON (a cross-site form post is refused)", async () => {
    const { api, service } = setup();
    const res = await api.create(new Request("http://test/api/reviews", { method: "POST", body: "rating=5", headers: { "content-type": "application/x-www-form-urlencoded" } }));
    expect(res.status).toBe(415);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("PATCH /api/reviews/[id] passes the user and the id; DELETE is always 405", async () => {
    const { api, service } = setup();
    expect((await api.update(json({ text: "x" }, "PATCH"), "r1")).status).toBe(200);
    expect(service.update).toHaveBeenCalledWith("u1", "r1", { text: "x" });
    const del = await api.remove();
    expect(del.status).toBe(405);
    expect((await del.json()).error.code).toBe("REVIEW_NOT_DELETABLE");
  });

  it("hide and unhide are for Platform Admins only", async () => {
    const customer = setup("customer");
    expect((await customer.api.hide(json({ reason: "Spam" }), "r1")).status).toBe(403);
    expect((await customer.api.unhide(json({ reason: "Fine" }), "r1")).status).toBe(403);
    expect(customer.service.hide).not.toHaveBeenCalled();
    expect((await setup("guest").api.hide(json({ reason: "Spam" }), "r1")).status).toBe(401);

    const admin = setup("admin");
    const res = await admin.api.hide(json({ reason: "Contains a phone number" }), "r1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ review: { id: "r1", status: "hidden" } });
    expect(admin.service.hide).toHaveBeenCalledWith("admin1", "r1", { reason: "Contains a phone number" });
  });

  it("a reply goes through the shop guard; non-members get 403", async () => {
    const member = setup("customer", true);
    expect((await member.api.reply(json({ text: "Thanks" }, "PUT"), "s1", "r1")).status).toBe(200);
    expect(member.service.reply).toHaveBeenCalledWith("s1", "u1", "r1", { text: "Thanks" });
    const outsider = setup("customer", false);
    expect((await outsider.api.reply(json({ text: "Thanks" }, "PUT"), "s1", "r1")).status).toBe(403);
    expect(outsider.service.reply).not.toHaveBeenCalled();
  });

  it("GET /api/products/[id]/reviews is public for live products, 404 otherwise", async () => {
    const { api, service } = setup("guest");
    const res = await api.listForProduct(new Request("http://test/api/products/live/reviews?page=2"), "live");
    expect(res.status).toBe(200);
    expect(service.productReviews).toHaveBeenCalledWith("live", "2");
    expect((await api.listForProduct(new Request("http://test/x"), "deleted")).status).toBe(404);
  });
});
