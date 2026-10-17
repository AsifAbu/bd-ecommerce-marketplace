import { toErrorBody } from "@/lib/errors";

/** Maps a known error (e.g. a guard's 401 / 403) to the standard JSON error shape; rethrows anything else. */
export function errorResponse(err: unknown): Response {
  const { status, body } = toErrorBody(err);
  return Response.json(body, { status });
}
