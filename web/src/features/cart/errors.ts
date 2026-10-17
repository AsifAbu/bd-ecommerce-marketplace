import { WishlistError } from "@/features/wishlist";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

/** A cart rule was broken. Maps to the standard `{ error: { code, message, fields? } }` JSON. */
export class CartError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 415 | 422,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "CartError";
  }
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

/** Known errors (cart, wishlist for move-to-cart, auth) to { status, body }; anything else is rethrown. */
export function toErrorBody(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof CartError || err instanceof WishlistError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, fields: err.fields } } };
  }
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  throw err;
}

/** Runs a route handler body: the result is sent as JSON, errors in the standard shape. */
export async function respond(fn: () => Promise<unknown>, status = 200): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return Response.json(result ?? { ok: true }, { status });
  } catch (err) {
    try {
      const { status: code, body } = toErrorBody(err);
      return Response.json(body, { status: code });
    } catch {
      console.error("[cart]", err);
      return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
    }
  }
}

/**
 * The JSON body of a write. Requiring `application/json` means a cross-site HTML form can't
 * post to the cart (it can only send form encodings); an empty body counts as `{}`.
 */
export async function readJson(req: Request): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (text.trim() === "") return {};
  if (!type.toLowerCase().includes("application/json")) {
    throw new CartError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as JSON");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new CartError(400, "INVALID_JSON", "Send the request body as JSON");
  }
}
