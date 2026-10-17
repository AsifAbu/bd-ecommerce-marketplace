"use client";

import { useEffect } from "react";

/**
 * Progressive enhancement for the GET filter forms: ticking a checkbox or changing a select
 * submits right away (without JS the "Apply" button does it), empty inputs are left out of the
 * URL, and focus returns to the control the shopper used after the panel re-renders.
 */

let pendingFocus: { formId: string; name: string; value: string } | null = null;

export function AutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    if (pendingFocus?.formId === formId) {
      const { name, value } = pendingFocus;
      pendingFocus = null;
      const target = [...form.elements].find(
        (el): el is HTMLInputElement | HTMLSelectElement =>
          (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.name === name && (el instanceof HTMLSelectElement || el.value === value),
      );
      target?.focus();
    }

    const onChange = (event: Event) => {
      const t = event.target;
      const isCheckbox = t instanceof HTMLInputElement && t.type === "checkbox";
      if (!isCheckbox && !(t instanceof HTMLSelectElement)) return;
      pendingFocus = { formId, name: t.name, value: t.value };
      form.requestSubmit();
    };
    // Capture phase: runs before the form's own submit handler reads the form data.
    const onSubmit = () => {
      const empty = [...form.elements].filter(
        (el): el is HTMLInputElement => el instanceof HTMLInputElement && !!el.name && el.type !== "checkbox" && el.value.trim() === "",
      );
      for (const el of empty) el.disabled = true;
      setTimeout(() => {
        for (const el of empty) el.disabled = false;
      }, 0);
    };
    form.addEventListener("change", onChange);
    form.addEventListener("submit", onSubmit, true);
    return () => {
      form.removeEventListener("change", onChange);
      form.removeEventListener("submit", onSubmit, true);
    };
  }, [formId]);
  return null;
}
