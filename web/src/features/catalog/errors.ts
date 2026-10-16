import { AppError } from "@/lib/errors";

/** A catalog rule was broken (e.g. non-leaf category). Maps to the standard error JSON. */
export class CatalogError extends AppError {
  constructor(status: 404 | 409 | 422, code: string, message: string, fields?: Record<string, string>) {
    super(status, code, message, fields);
    this.name = "CatalogError";
  }
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

/** Known errors to { status, body }; anything else is rethrown. */
export function toErrorBody(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof AppError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, fields: err.fields } } };
  }
  throw err;
}
