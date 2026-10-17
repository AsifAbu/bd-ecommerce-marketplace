import { ProductError, toErrorBody } from "./errors";
import type { UploadedFile } from "./service";

/** Helpers for the thin products route handlers: JSON in, JSON out, standard error shape. */

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";

export function errorResponse(err: unknown): Response {
  try {
    const { status, body } = toErrorBody(err);
    return Response.json(body, { status });
  } catch {
    if (isUniqueViolation(err)) {
      // Raced with another save (e.g. the same SKU saved twice at once).
      return Response.json(
        { error: { code: "CONFLICT", message: "This SKU or variant is already used in your shop. Reload and try again." } },
        { status: 409 },
      );
    }
    console.error("[products]", err);
    return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
  }
}

/** Runs a handler body; a returned Response is passed through, anything else is sent as JSON. */
export async function respond(fn: () => Promise<unknown>, status = 200): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return Response.json(result ?? { ok: true }, { status });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ProductError(400, "INVALID_JSON", "Send the request body as JSON");
  }
}

export async function readForm(req: Request): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw new ProductError(400, "INVALID_FORM", "Send the request as multipart/form-data");
  }
}

export async function formFile(form: FormData, name: string): Promise<(UploadedFile & { text(): Promise<string> }) | null> {
  const value = form.get(name);
  if (!value || typeof value === "string") return null;
  const bytes = new Uint8Array(await value.arrayBuffer());
  return { name: value.name, size: value.size, bytes, text: async () => new TextDecoder().decode(bytes) };
}
