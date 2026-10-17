"use client";

import { createContext, startTransition, use, useActionState, useId, type ReactNode } from "react";
import { resultFields, type ActionResult } from "@/lib/actions";
import { buttonClass, dangerButtonClass, inputClass } from "./form-styles";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const FieldErrors = createContext<Record<string, string>>({});

/**
 * A form bound to a server action that returns an ActionResult (see @/lib/actions), with a status
 * message and per-field errors (shown by <Field>, or as a list with `listFieldErrors`).
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  className = "flex flex-col gap-3",
  variant = "primary",
  label,
  listFieldErrors = false,
  resetOnSubmit = false,
  nativeValidation = false,
}: {
  action: Action;
  /** Renders the submit button. Leave it out when the children have their own buttons. */
  submitLabel?: string;
  children?: ReactNode;
  className?: string;
  variant?: "primary" | "danger";
  /** Accessible name of the form. */
  label?: string;
  /** List field errors under the message (for forms without <Field>). */
  listFieldErrors?: boolean;
  /** Let React reset the fields after each submit (default: keep what was typed). */
  resetOnSubmit?: boolean;
  /** Let the browser check `required` etc. before submitting (default: the server validates). */
  nativeValidation?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const fields = resultFields(state);
  return (
    <form
      action={formAction}
      // Submit manually so React does not reset the fields after an error.
      onSubmit={
        resetOnSubmit
          ? undefined
          : (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
              startTransition(() => formAction(formData));
            }
      }
      className={className}
      aria-label={label}
      aria-busy={pending}
      noValidate={!nativeValidation}
    >
      <FieldErrors value={fields}>{children}</FieldErrors>
      {submitLabel && (
        <div>
          <button type="submit" disabled={pending} className={variant === "danger" ? dangerButtonClass : buttonClass}>
            {pending ? "Please wait…" : submitLabel}
          </button>
        </div>
      )}
      {state && "error" in state && (
        <div role="alert" className="w-full text-sm font-medium text-red-700">
          <p>{state.error.message}</p>
          {listFieldErrors && Object.keys(fields).length > 0 && (
            <ul className="list-disc pl-5 font-normal">
              {Object.entries(fields).map(([field, message]) => (
                <li key={field}>
                  {field}: {message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state && "ok" in state && (
        <p role="status" className="w-full text-sm font-medium text-green-800">
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

/** Labelled input inside an <ActionForm>, with its error message (aria-invalid / aria-describedby). */
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
