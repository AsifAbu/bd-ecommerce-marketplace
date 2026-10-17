"use client";

import { useId } from "react";
import { createDraftAction, publishAction, saveDraftAction } from "../actions";
import { ActionForm, inputClass, SubmitButton, useFieldError } from "./action-form";

function Field({
  name,
  label,
  hint,
  defaultValue,
  as = "input",
  type = "text",
  rows,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  as?: "input" | "textarea";
  type?: string;
  rows?: number;
}) {
  const id = useId();
  const error = useFieldError(name);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name,
    defaultValue,
    className: inputClass,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-gray-700">
          {hint}
        </p>
      )}
      {as === "textarea" ? <textarea {...common} rows={rows} className={`${inputClass} font-mono text-sm`} /> : <input {...common} type={type} />}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function NewDraftForm({ slug, nextVersion }: { slug: string; nextVersion: number }) {
  return (
    <ActionForm action={createDraftAction} label="Draft a new version">
      <input type="hidden" name="slug" value={slug} />
      <p className="text-sm">The draft starts as a copy of the latest published text. Published versions never change.</p>
      <SubmitButton>Draft version {nextVersion}</SubmitButton>
    </ActionForm>
  );
}

export function DraftEditor({
  draft,
}: {
  draft: { id: string; version: number; title: string; body: string; changeSummary: string | null };
}) {
  return (
    <div className="flex flex-col gap-6">
      <ActionForm action={saveDraftAction} label={`Edit draft version ${draft.version}`}>
        <input type="hidden" name="id" value={draft.id} />
        <Field name="title" label="Title" defaultValue={draft.title} />
        <Field
          name="changeSummary"
          label="What changed (optional)"
          hint="Shown in the version history, e.g. “Updated the delivery charges”."
          defaultValue={draft.changeSummary ?? ""}
        />
        <Field
          name="body"
          label="Policy text"
          as="textarea"
          rows={22}
          hint="Use ## for headings, - for bullet points, 1. for numbered steps and **bold**. {{DBID}} shows the DBID."
          defaultValue={draft.body}
        />
        <SubmitButton variant="secondary">Save draft</SubmitButton>
      </ActionForm>

      <ActionForm action={publishAction} label={`Publish version ${draft.version}`} className="flex flex-col gap-3 rounded border border-gray-300 p-4">
        <h4 className="text-lg font-semibold">Publish version {draft.version}</h4>
        <p className="text-sm">
          Save the draft first. Publishing is final: the version can no longer be edited, and it replaces the current version
          from its effective date. Users accept the new version at their next sign-up or checkout.
        </p>
        <input type="hidden" name="id" value={draft.id} />
        <Field
          name="effectiveAt"
          label="Effective from (optional)"
          type="datetime-local"
          hint="Bangladesh time. Leave empty to make it effective now."
        />
        <SubmitButton>Publish version {draft.version}</SubmitButton>
      </ActionForm>
    </div>
  );
}
