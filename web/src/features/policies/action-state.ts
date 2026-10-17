import { toErrorBody, type ErrorBody } from "./errors";

/** Result of a policies server action, shown by <ActionForm>. Errors use the standard shape plus the HTTP status. */
export type ActionState = { ok?: string; error?: ErrorBody["error"] & { status: number } } | null;

/** Known errors (guards, PolicyError) become an error result; anything else (incl. redirect) is rethrown. */
export function toActionError(err: unknown): ActionState {
  const { status, body } = toErrorBody(err);
  return { error: { ...body.error, status } };
}
