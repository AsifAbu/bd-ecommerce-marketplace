import { AppError, toErrorBody } from "./errors";

/**
 * Small helpers for JSON route handlers (returns, complaints): run the body, answer known errors
 * in the standard `{ error: { code, message, fields? } }` shape, log anything else as a 500.
 */
export async function jsonRoute(fn: () => Promise<unknown>, status = 200, tag = "api"): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return Response.json(result ?? { ok: true }, { status });
  } catch (err) {
    if (err instanceof AppError) {
      const { status: code, body } = toErrorBody(err);
      return Response.json(body, { status: code });
    }
    console.error(`[${tag}]`, err);
    return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
  }
}

/**
 * The body of a write as a plain object. JSON needs `application/json`; with `allowMultipart`,
 * `multipart/form-data` is read too (files under their field names as arrays). A cross-site page
 * can post a form, but without the SameSite=Lax session or order cookies it reaches nothing.
 */
export async function readBody(req: Request, opts: { allowMultipart?: boolean } = {}): Promise<{ fields: Record<string, unknown>; files: Record<string, File[]> }> {
  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  if (opts.allowMultipart && type.includes("multipart/form-data")) {
    const form = await req.formData();
    const fields: Record<string, unknown> = {};
    const files: Record<string, File[]> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") fields[key] = value;
      else (files[key] ??= []).push(value);
    }
    return { fields, files };
  }
  const text = await req.text();
  if (text.trim() === "") return { fields: {}, files: {} };
  if (!type.includes("application/json")) throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as JSON");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError(400, "INVALID_JSON", "Send the request body as JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new AppError(400, "INVALID_JSON", "Send a JSON object");
  return { fields: parsed as Record<string, unknown>, files: {} };
}
