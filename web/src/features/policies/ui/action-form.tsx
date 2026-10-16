"use client";

import { createContext, startTransition, use, useActionState, type ReactNode } from "react";
import type { ActionState } from "../action-state";

const FieldErrors = createContext<Record<string, string>>({});

/** Field error for `name` from the surrounding <ActionForm>, if any. */
export function useFieldError(name: string): string | undefined {
  return use(FieldErrors)[name];
}

/** A form bound to a policies server action; shows its success or error message. */
export function ActionForm({
  action,
  children,
  className = "flex flex-col gap-3",
  label,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      // Submit manually so React does not reset the fields after an error.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className={className}
      aria-label={label}
      aria-busy={pending}
      noValidate
    >
      <FieldErrors value={state?.error?.fields ?? {}}>{children}</FieldErrors>
      {state?.ok && (
        <p role="status" className="text-sm font-medium text-green-800">
          {state.ok}
        </p>
      )}
      {state?.error && (
        <div role="alert" className="text-sm text-red-700">
          <p className="font-medium">{state.error.message}</p>
          {state.error.fields && (
            <ul className="list-disc pl-5">
              {Object.entries(state.error.fields).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

export function SubmitButton({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-blue-700 text-white hover:bg-blue-800"
      : "border border-gray-500 bg-white text-gray-900 hover:bg-gray-100";
  return (
    <button
      type="submit"
      className={`self-start rounded px-4 py-2 text-sm font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 ${styles}`}
    >
      {children}
    </button>
  );
}

export const inputClass =
  "w-full rounded border border-gray-400 px-3 py-2 text-base focus:outline-2 focus:outline-offset-1 focus:outline-blue-700 aria-invalid:border-red-700";
