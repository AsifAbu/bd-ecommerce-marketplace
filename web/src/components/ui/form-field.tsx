import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

/** Shared look of text controls. Also used by ActionForm's Field and the legacy `inputClass`. */
export const controlStyles =
  "block w-full min-h-11 rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink placeholder:text-muted/80 focus-visible:border-jade disabled:bg-surface disabled:text-muted aria-invalid:border-vermilion";

/** A text input (any `type`). Style only; wrap in <FormField> for label, hint and error. */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlStyles, className)} {...rest} />;
}

/** A multi-line text input. Style only; wrap in <FormField>. */
export function Textarea({ className, rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(controlStyles, className)} {...rest} />;
}

/** A native select (best on phones). Style only; wrap in <FormField>. Options go in as children. */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlStyles, "appearance-auto pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

/** What <FormField> hands to its control so label, hint and error are wired for assistive tech. */
export interface FieldControlProps {
  id: string;
  required?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

export interface FormFieldProps {
  /** Visible label (sentence case). Always required: placeholders are not labels. */
  label: string;
  /** Short help shown under the label. */
  hint?: string;
  /** Error message; sets aria-invalid on the control and is announced via aria-describedby. */
  error?: string;
  required?: boolean;
  className?: string;
  /** Render the control with the props given, e.g. `{(p) => <Input name="phone" {...p} />}`. */
  children: (control: FieldControlProps) => ReactNode;
}

/** Label + hint + control + error with correct ids. The control is a render function so it works with Input, Textarea, Select or anything else. */
export function FormField({ label, hint, error, required, className, children }: FormFieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children({ id, required, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error && (
        <p id={`${id}-error`} className="text-sm text-vermilion">
          {error}
        </p>
      )}
    </div>
  );
}
