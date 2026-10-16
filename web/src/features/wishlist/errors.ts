import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

/** A wishlist rule was broken. Maps to the standard `{ error: { code, message, fields? } }` JSON. */
export class WishlistError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 422,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "WishlistError";
  }
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

/** Known errors to { status, body }; anything else is rethrown. */
export function toErrorBody(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof WishlistError) {
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
      console.error("[wishlist]", err);
      return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
    }
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new WishlistError(400, "INVALID_JSON", "Send the request body as JSON");
  }
}
