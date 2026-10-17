import { AppError, toErrorBody } from "@/lib/errors";

/** A review rule was broken. Standard `{ error: { code, message, fields? } }` shape. */
export class ReviewError extends AppError {
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(status, code, message, fields);
    this.name = "ReviewError";
  }
}

/** Runs a route handler body: the result is sent as JSON, known errors in the standard shape. */
export async function respond(fn: () => Promise<unknown>, status = 200): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return Response.json(result ?? { ok: true }, { status });
  } catch (err) {
    if (err instanceof AppError) {
      const { status: code, body } = toErrorBody(err);
      return Response.json(body, { status: code });
    }
    console.error("[reviews]", err);
    return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
  }
}

/**
 * The JSON body of a write. Requiring `application/json` means a cross-site HTML form can't post
 * here (forms can only send form encodings).
 */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (!type.toLowerCase().includes("application/json")) {
    throw new ReviewError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as JSON");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text || "{}");
  } catch {
    throw new ReviewError(400, "INVALID_JSON", "Send the request body as JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ReviewError(400, "INVALID_JSON", "Send a JSON object");
  }
  return parsed as Record<string, unknown>;
}
