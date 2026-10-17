import { CatalogError } from "@/features/catalog";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

/** One problem in a CSV import, by file line number (the header is line 1). */
export interface ImportRowError {
  row: number;
  column?: string;
  message: string;
}

/** A products rule was broken. Maps to the standard `{ error: { code, message, fields? } }` JSON. */
export class ProductError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 422 | 503,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly rows?: ImportRowError[],
  ) {
    super(message);
    this.name = "ProductError";
  }
}

export const notFound = (what = "Product") => new ProductError(404, "NOT_FOUND", `${what} not found`);

export function validationError(fields: Record<string, string>, message?: string) {
  const keys = Object.keys(fields);
  return new ProductError(422, "VALIDATION", message ?? (keys.length === 1 ? fields[keys[0]] : "Check the highlighted fields"), fields);
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string>; rows?: ImportRowError[] };
}

/** Known errors to { status, body }; anything else is rethrown. */
export function toErrorBody(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof ProductError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, fields: err.fields, rows: err.rows } },
    };
  }
  if (err instanceof CatalogError) {
    // e.g. a non-leaf or archived category: the field that caused it is the category.
    const fields = err.fields ?? (err.status === 422 ? { categoryId: err.message } : undefined);
    return { status: err.status, body: { error: { code: err.code, message: err.message, fields } } };
  }
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  throw err;
}
