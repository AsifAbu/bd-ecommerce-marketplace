"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "../actions";

/** A form bound to a catalog server action; shows its success or error message. */
export function ActionForm({
  action,
  children,
  className = "flex flex-wrap items-end gap-2",
  label,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className} aria-label={label} aria-busy={pending}>
      {children}
      {state?.ok && (
        <p role="status" className="w-full text-sm text-green-800">
          {state.ok}
        </p>
      )}
      {state?.error && (
        <div role="alert" className="w-full text-sm text-red-700">
          <p>{state.error.message}</p>
          {state.error.fields && (
            <ul className="list-disc pl-5">
              {Object.entries(state.error.fields).map(([field, message]) => (
                <li key={field}>
                  {field}: {message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  name,
  value,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  name?: string;
  value?: string;
}) {
  const styles = {
    primary: "bg-blue-700 text-white hover:bg-blue-800",
    secondary: "border border-gray-400 bg-white text-gray-900 hover:bg-gray-100",
    danger: "border border-red-700 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={`rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${styles}`}
    >
      {children}
    </button>
  );
}
