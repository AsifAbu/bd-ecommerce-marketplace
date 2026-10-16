import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

/** Maps a guard error to the standard JSON error shape { error: { code, message } }; rethrows anything else. */
export function errorResponse(err: unknown): Response {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  throw err;
}
