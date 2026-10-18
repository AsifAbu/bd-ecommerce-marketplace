"use client";

import { createContext, startTransition, use, useActionState, type ReactNode } from "react";
import { buttonStyles, controlStyles } from "@/components/ui";
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
        <p role="status" className="status-in text-sm font-medium text-jade">
          {state.ok}
        </p>
      )}
      {state?.error && (
        <div role="alert" className="status-in text-sm text-vermilion">
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
  return (
    <button type="submit" className={`${buttonStyles({ variant })} self-start`}>
      {children}
    </button>
  );
}

export const inputClass = controlStyles;
