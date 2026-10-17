import type { z } from "zod";
import { AppError, toErrorBody } from "@/lib/errors";

/**
 * Shared server-action helpers (shops, catalog, accounts). An action body runs inside runAction();
 * known errors (AppError: guard 401/403, rule conflicts, validation) become an error result in the
 * standard `{ error: { code, message, fields? } }` shape. Anything else, including Next's redirect,
 * is rethrown. The client reads results with resultFields() / resultValues().
 */
export type FieldErrors = Record<string, string>;

export type ActionResult =
  | { ok: true; message: string }
  | {
      error: { code: string; message: string; fields?: FieldErrors };
      /** Submitted values (never passwords) so a form can keep them after an error. */
      values?: Record<string, string>;
    }
  | undefined;

export class ValidationError extends AppError {
  constructor(fields: FieldErrors, message = "Check the highlighted fields") {
    super(422, "VALIDATION", message, fields);
    this.name = "ValidationError";
  }
}

/** Runs an action body; known errors become an error result (with `values` if given), anything else is rethrown. */
export async function runAction(
  fn: () => Promise<string>,
  options: { values?: Record<string, string> } = {},
): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() };
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    const { body } = toErrorBody(err);
    return options.values ? { ...body, values: options.values } : body;
  }
}

/** First message per top-level field. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Parses form input with a Zod schema or throws a ValidationError with per-field messages. */
export function parseForm<S extends z.ZodType>(schema: S, data: FormData | Record<string, unknown>): z.infer<S> {
  const result = schema.safeParse(data instanceof FormData ? Object.fromEntries(data) : data);
  if (!result.success) throw new ValidationError(fieldErrors(result.error));
  return result.data;
}

export const formString = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

/** Per-field errors of a result ({} when none). */
export const resultFields = (result: ActionResult): FieldErrors =>
  result && "error" in result ? (result.error.fields ?? {}) : {};

/** Submitted values kept by an error result ({} when none). */
export const resultValues = (result: ActionResult): Record<string, string> =>
  result && "error" in result ? (result.values ?? {}) : {};
