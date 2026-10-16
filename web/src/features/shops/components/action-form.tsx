"use client";

import { createContext, startTransition, use, useActionState, useId, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";
import { inputClass } from "@/components/form-styles";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const FieldErrors = createContext<Record<string, string>>({});

const buttonClass =
  "rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 disabled:opacity-60";

/** A form bound to a shops server action, with a status message and per-field errors. */
export function ActionForm({
  action,
  submitLabel,
  children,
  className = "flex flex-col gap-3",
  variant = "primary",
}: {
  action: Action;
  submitLabel: string;
  children?: ReactNode;
  className?: string;
  variant?: "primary" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const fields = state && "error" in state ? (state.error.fields ?? {}) : {};
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
      noValidate
    >
      <FieldErrors value={fields}>{children}</FieldErrors>
      <div>
        <button
          type="submit"
          disabled={pending}
          className={variant === "danger" ? buttonClass.replace(/blue-(700|800)/g, "red-$1") : buttonClass}
        >
          {pending ? "Please wait…" : submitLabel}
        </button>
      </div>
      {state && "error" in state && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error.message}
        </p>
      )}
      {state && "ok" in state && (
        <p role="status" className="text-sm font-medium text-green-800">
          {state.message}
        </p>
      )}
    </form>
  );
}

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
} & (
  | { as?: "input"; type?: string; defaultValue?: string; accept?: string; placeholder?: string }
  | { as: "textarea"; defaultValue?: string; rows?: number }
  | { as: "select"; options: { value: string; label: string }[]; defaultValue?: string; onChange?: (v: string) => void }
);

/** Labelled input with its error message (aria-invalid / aria-describedby). */
export function Field(props: FieldProps) {
  const id = useId();
  const error = use(FieldErrors)[props.name];
  const describedBy = [props.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: props.name,
    required: props.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: inputClass,
  };
  let control: ReactNode;
  if (props.as === "textarea") {
    control = <textarea {...common} rows={props.rows ?? 4} defaultValue={props.defaultValue} />;
  } else if (props.as === "select") {
    const { onChange } = props;
    control = (
      <select {...common} defaultValue={props.defaultValue ?? ""} onChange={onChange && ((e) => onChange(e.target.value))}>
        <option value="" disabled>
          Choose…
        </option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        {...common}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        accept={props.accept}
        placeholder={props.placeholder}
      />
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {props.label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      {props.hint && (
        <p id={`${id}-hint`} className="text-sm text-gray-700">
          {props.hint}
        </p>
      )}
      {control}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
