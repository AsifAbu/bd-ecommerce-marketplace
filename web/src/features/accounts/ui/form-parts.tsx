"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonStyles, controlStyles, cn, Notice } from "@/components/ui";
import { inputClass } from "@/components/form-styles";
import type { ActionResult } from "@/lib/actions";

export { inputClass };

/**
 * Labelled input with its hint and error linked by aria-describedby. Password fields get a
 * Show/Hide button (the field keeps type=password until the user asks).
 */
export function Field({
  label,
  name,
  error,
  hint,
  className,
  type,
  ...props
}: { label: string; name: string; error?: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const uid = useId();
  const [shown, setShown] = useState(false);
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  const isPassword = type === "password";
  const input = (
    <input
      id={name}
      name={name}
      type={isPassword && shown ? "text" : type}
      className={cn(controlStyles, isPassword && "pr-16", className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...props}
    />
  );
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-ink">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {isPassword ? (
        <div className="relative">
          {input}
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            aria-controls={name}
            className="absolute inset-y-0 right-0 flex min-w-14 items-center justify-center rounded-md px-3 text-sm font-medium text-jade hover:text-jade-hover"
          >
            {shown ? "Hide" : "Show"}
          </button>
        </div>
      ) : (
        input
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-vermilion">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({
  children,
  className = "",
  block = false,
  variant = "primary",
  pendingLabel = "Please wait…",
}: {
  children: ReactNode;
  className?: string;
  /** Full width (auth forms). */
  block?: boolean;
  variant?: "primary" | "secondary";
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={cn(buttonStyles({ variant, size: "lg", block }), className)}>
      {pending ? (
        <>
          <span aria-hidden="true" className="spinner" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Form-level error or success message, announced to screen readers.
 * Validation errors are shown next to their fields instead.
 */
export function FormMessage({ state }: { state: ActionResult }) {
  if (state && "error" in state && state.error.code !== "VALIDATION") {
    return <Notice tone="error">{state.error.message}</Notice>;
  }
  if (state && "ok" in state && state.message) {
    return <Notice tone="success">{state.message}</Notice>;
  }
  return null;
}
