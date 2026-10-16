import { AppError } from "./errors";

/** Result of a form server action. Errors use the standard `{ error: { code, message, fields? } }` shape. */
export type ActionResult =
  | { ok: true; message: string }
  | { error: { code: string; message: string; fields?: Record<string, string> } }
  | undefined;

/** Runs an action body; an AppError becomes an error result, anything else (incl. redirect) is rethrown. */
export async function runAction(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() };
  } catch (err) {
    if (err instanceof AppError) return { error: { code: err.code, message: err.message, fields: err.fields } };
    throw err;
  }
}

export const formString = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};
