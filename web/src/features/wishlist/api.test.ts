import { describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/auth/errors";
import { createWishlistApi } from "./api";
import { WishlistError } from "./errors";

const json = async (res: Response) => ({ status: res.status, body: await res.json() });
const post = (body: string) => new Request("http://x/api/wishlist", { method: "POST", body, headers: { "content-type": "application/json" } });

function api(user: { id: string } | null) {
  const service = {
    listItems: vi.fn(async () => []),
    addItem: vi.fn(async (_userId: string, body: unknown) => {
      const created = (body as { productId: string }).productId === "new";
      return { item: { id: "w1", variantId: null }, created };
    }),
    removeItem: vi.fn(async (_userId: string, itemId: string) => {
      if (itemId !== "w1") throw new WishlistError(404, "NOT_FOUND", "Wishlist item not found");
    }),
  };
  const requireUser = vi.fn(async () => {
    if (!user) throw new UnauthorizedError();
    return user;
  });
  return { routes: createWishlistApi({ requireUser, service }), service };
}

describe("wishlist JSON API", () => {
  it("is for logged-in customers only (401 with the standard error shape)", async () => {
    const { routes, service } = api(null);
    expect(await json(await routes.list())).toEqual({ status: 401, body: { error: { code: "UNAUTHORIZED", message: "Login required" } } });
    expect((await routes.add(post('{"productId":"new"}'))).status).toBe(401);
    expect((await routes.remove("w1")).status).toBe(401);
    expect(service.addItem).not.toHaveBeenCalled();
    expect(service.removeItem).not.toHaveBeenCalled();
  });

  it("scopes every call to the session user", async () => {
    const { routes, service } = api({ id: "u1" });
    expect(await json(await routes.list())).toEqual({ status: 200, body: { items: [] } });
    expect(service.listItems).toHaveBeenCalledWith("u1");
    await routes.add(post('{"productId":"new","userId":"someone-else"}'));
    expect(service.addItem).toHaveBeenCalledWith("u1", { productId: "new", userId: "someone-else" });
    await routes.remove("w1");
    expect(service.removeItem).toHaveBeenCalledWith("u1", "w1");
  });

  it("answers 201 when added and 200 when already saved", async () => {
    const { routes } = api({ id: "u1" });
    expect(await json(await routes.add(post('{"productId":"new"}')))).toEqual({
      status: 201,
      body: { item: { id: "w1", variantId: null }, created: true },
    });
    expect((await routes.add(post('{"productId":"old"}'))).status).toBe(200);
  });

  it("maps errors: 400 bad JSON, 404 not the user's item", async () => {
    const { routes } = api({ id: "u1" });
    expect(await json(await routes.add(post("{nope")))).toEqual({
      status: 400,
      body: { error: { code: "INVALID_JSON", message: "Send the request body as JSON" } },
    });
    expect(await json(await routes.remove("w-other"))).toEqual({
      status: 404,
      body: { error: { code: "NOT_FOUND", message: "Wishlist item not found" } },
    });
    expect(await json(await routes.remove("w1"))).toEqual({ status: 200, body: { ok: true } });
  });

  it("hides unexpected errors behind a 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const routes = createWishlistApi({
      requireUser: async () => ({ id: "u1" }),
      service: { listItems: async () => Promise.reject(new Error("db down: secret")), addItem: vi.fn(), removeItem: vi.fn() },
    });
    expect(await json(await routes.list())).toEqual({
      status: 500,
      body: { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
    });
    log.mockRestore();
  });
});
