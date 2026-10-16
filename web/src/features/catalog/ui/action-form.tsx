"use client";

import type { ComponentProps, ReactNode } from "react";
import { ActionForm as SharedActionForm } from "@/components/action-form";

/**
 * The shared <ActionForm> with the catalog admin defaults: compact row layout, buttons in the
 * children, field errors listed under the message, browser validation, fields reset after submit.
 */
export function ActionForm({
  className = "flex flex-wrap items-end gap-2",
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
