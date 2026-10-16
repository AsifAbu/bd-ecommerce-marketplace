/**
 * A known, user-facing error with its HTTP status. Server actions (runAction) and route handlers
 * (toErrorBody) turn it into the standard `{ error: { code, message, fields? } }` shape.
 * Any other thrown value is a bug (or a Next redirect) and is rethrown.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

/** Known errors to { status, body }; anything else is rethrown. */
export function toErrorBody(err: unknown): { status: number; body: ErrorBody } {
  if (!(err instanceof AppError)) throw err;
  const error = { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) };
  return { status: err.status, body: { error } };
}
