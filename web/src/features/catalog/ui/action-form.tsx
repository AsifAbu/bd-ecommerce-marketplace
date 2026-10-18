"use client";

import type { ComponentProps, ReactNode } from "react";
import { ActionForm as SharedActionForm } from "@/components/action-form";
import { buttonStyles } from "@/components/ui";

/**
 * The shared <ActionForm> with the catalog admin defaults: compact row layout, buttons in the
 * children, field errors listed under the message, browser validation, fields reset after submit.
 */
export function ActionForm({
  className = "flex flex-wrap items-end gap-x-3 gap-y-4",
  ...props
}: Omit<ComponentProps<typeof SharedActionForm>, "submitLabel" | "variant">) {
  return <SharedActionForm className={className} listFieldErrors resetOnSubmit nativeValidation {...props} />;
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
  return (
    <button type="submit" name={name} value={value} className={buttonStyles({ variant })}>
      {children}
    </button>
  );
}
