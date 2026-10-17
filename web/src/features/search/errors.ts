/** A search request problem. Maps to the standard `{ error: { code, message, fields? } }` JSON. */
export class SearchError extends Error {
  constructor(
    readonly status: 400 | 404 | 503,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "SearchError";
  }
}

export interface SearchErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

/** JSON error response in the standard shape; unexpected errors become a 500 without details. */
export function searchErrorResponse(err: unknown): Response {
  if (err instanceof SearchError) {
    const body: SearchErrorBody = { error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } };
    return Response.json(body, { status: err.status });
  }
  console.error("[search]", err);
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
}
