import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

/** A policy rule was broken. Maps to the standard `{ error: { code, message, fields? } }` shape. */
export class PolicyError extends Error {
  constructor(
    readonly status: 404 | 409 | 422,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "PolicyError";
  }
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

/** Known errors to { status, body }; anything else is rethrown. */
export function toErrorBody(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof PolicyError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, fields: err.fields } } };
  }
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  throw err;
}

/** For route handlers: known errors become a JSON error response. */
export function errorResponse(err: unknown): Response {
  const { status, body } = toErrorBody(err);
  return Response.json(body, { status });
}
