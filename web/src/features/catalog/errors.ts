import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

/** A catalog rule was broken (e.g. non-leaf category). Maps to the standard error JSON. */
export class CatalogError extends Error {
  constructor(
    readonly status: 404 | 409 | 422,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

/** Known errors to { status, body }; anything else is rethrown. */
export function toErrorBody(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof CatalogError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, fields: err.fields } } };
  }
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  throw err;
}
