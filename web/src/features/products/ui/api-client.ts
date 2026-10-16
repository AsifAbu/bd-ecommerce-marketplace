import type { ErrorBody } from "../errors";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ErrorBody["error"] };

/** Calls a products route handler from the browser; network and server errors become an error result. */
export async function callApi<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<ApiResult<T>> {
  const { json, ...rest } = init;
  try {
    const res = await fetch(url, {
      ...rest,
      ...(json !== undefined ? { body: JSON.stringify(json), headers: { "content-type": "application/json" } } : {}),
    });
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: body as T };
    return {
      ok: false,
      error: (body as ErrorBody | null)?.error ?? { code: "HTTP_ERROR", message: `Request failed (${res.status})` },
    };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Could not reach the server. Check your connection and try again." } };
  }
}
