import type { z } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { ShopRuleError } from "./rules";
import { fieldErrors } from "./schemas";

/** Result of a shops server action. Errors use the standard `{ error: { code, message, fields? } }` shape. */
export type ActionResult =
  | { ok: true; message: string }
  | { error: { code: string; message: string; fields?: Record<string, string> } }
  | undefined;

export class ValidationError extends Error {
  readonly status = 422;
  readonly code = "VALIDATION";
  constructor(readonly fields: Record<string, string>) {
    super("Check the highlighted fields");
    this.name = "ValidationError";
  }
}

/** Runs an action body; known errors become an error result, anything else (incl. redirect) is rethrown. */
export async function runAction(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { error: { code: err.code, message: err.message, fields: err.fields } };
    }
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError || err instanceof ShopRuleError) {
      return { error: { code: err.code, message: err.message } };
    }
    throw err;
  }
}

export function parseForm<S extends z.ZodType>(schema: S, formData: FormData): z.infer<S> {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) throw new ValidationError(fieldErrors(result.error));
  return result.data;
}

export const formString = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};
