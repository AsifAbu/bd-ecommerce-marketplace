import { describe, expect, it, vi } from "vitest";
import { CatalogError } from "@/features/catalog";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { ProductError } from "./errors";
import { readJson, respond } from "./http";

const json = async (res: Response) => ({ status: res.status, body: await res.json() });

describe("respond (standard error shape)", () => {
  it("sends results as JSON with the given status", async () => {
    expect(await json(await respond(async () => ({ id: "p1" }), 201))).toEqual({ status: 201, body: { id: "p1" } });
    expect(await json(await respond(async () => undefined))).toEqual({ status: 200, body: { ok: true } });
  });

  it("maps known errors to { error: { code, message, fields? } }", async () => {
    const fields = { "attributes.isbn": "Not an attribute of Processor" };
    expect(await json(await respond(async () => { throw new ProductError(422, "VALIDATION", "isbn is not an attribute of Processor", fields); }))).toEqual({
      status: 422,
      body: { error: { code: "VALIDATION", message: "isbn is not an attribute of Processor", fields } },
    });
    expect((await json(await respond(async () => { throw new CatalogError(422, "CATEGORY_NOT_LEAF", "Leaf only"); }))).body).toEqual({
      error: { code: "CATEGORY_NOT_LEAF", message: "Leaf only", fields: { categoryId: "Leaf only" } },
    });
    expect((await respond(async () => { throw new ForbiddenError(); })).status).toBe(403);
    expect((await respond(async () => { throw new UnauthorizedError(); })).status).toBe(401);
  });

  it("maps a unique-key race to 409 and hides unexpected errors behind a 500", async () => {
    expect((await respond(async () => { throw Object.assign(new Error("dup"), { code: "P2002" }); })).status).toBe(409);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await json(await respond(async () => { throw new Error("db password in message"); }));
    expect(res).toEqual({ status: 500, body: { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } } });
    log.mockRestore();
  });

  it("rejects a body that is not JSON with a 400", async () => {
    const err = await readJson(new Request("http://x", { method: "POST", body: "{nope" })).catch((e) => e);
    expect(err).toMatchObject({ status: 400, code: "INVALID_JSON" });
  });
});
