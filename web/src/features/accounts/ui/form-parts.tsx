"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, inputClass } from "@/components/form-styles";
import type { ActionResult } from "@/lib/actions";

export { inputClass };

/** Labelled input with its error message linked by aria-describedby. */
export function Field({
  label,
  name,
  error,
  hint,
  ...props
}: { label: string; name: string; error?: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="font-medium">
        {label}
      </label>
      <input id={name} name={name} className={inputClass} aria-invalid={!!error} aria-describedby={describedBy} {...props} />
      {hint && (
        <p id={`${name}-hint`} className="text-sm text-gray-700">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${buttonClass} ${className}`}
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

/**
 * Form-level error or success message, announced to screen readers.
 * Validation errors are shown next to their fields instead.
 */
export function FormMessage({ state }: { state: ActionResult }) {
  if (state && "error" in state && state.error.code !== "VALIDATION") {
    return (
      <p role="alert" className="rounded border border-red-700 bg-red-50 px-3 py-2 text-red-800">
        {state.error.message}
      </p>
    );
  }
  if (state && "ok" in state && state.message) {
    return (
      <p role="status" className="rounded border border-green-700 bg-green-50 px-3 py-2 text-green-900">
        {state.message}
      </p>
    );
  }
  return null;
}
