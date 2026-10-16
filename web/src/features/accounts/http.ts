import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

/** Maps an error to the standard JSON error shape: { error: { code, message } }. */
export function errorResponse(err: unknown): Response {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}
