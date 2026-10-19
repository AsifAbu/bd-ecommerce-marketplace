"use client";

import { useState, type ReactNode } from "react";
import { applyForShop } from "../actions";
import { SHOP_TYPE_LABELS, SHOP_TYPES } from "../shop-types";
import { ActionForm, Field } from "@/components/action-form";

const FILE_HINT = "PDF, JPG, PNG or WebP, up to 4 MB. In test mode any file is accepted.";

function Step({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="mb-1 text-xl font-semibold">{title}</legend>
      {hint && <p className="-mt-2 text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

/** US-010 / US-015 application form. Licence fields appear for medicine shops. */
export function ApplyForm() {
  const [type, setType] = useState("");
  return (
    <ActionForm action={applyForShop} submitLabel="Submit application" label="Shop application" className="flex flex-col gap-10">
      <Step title="1. Shop details">
        <Field name="name" label="Shop name" required />
        <Field name="slug" label="Shop link" hint="Your storefront will be at /s/<shop link>. Lowercase letters, numbers and hyphens, e.g. dhaka-books" required />
        <Field
          as="select"
          name="type"
          label="Shop type"
          required
          onChange={setType}
          options={SHOP_TYPES.map((t) => ({ value: t, label: SHOP_TYPE_LABELS[t] }))}
        />
      </Step>
      <Step title="2. Owner identity" hint="We check this once before your shop goes live.">
        <Field name="ownerNid" label="Owner NID number" hint="10, 13 or 17 digits" required />
        <Field name="ownerPhoto" label="Owner photo" type="file" accept="image/*" hint={FILE_HINT} required />
      </Step>
      {type === "medicine" && (
        <Step title="3. Drug licence" hint="Required for medicine shops. The Platform Admin verifies it before you can sell medicine.">
          <Field name="licenceNo" label="Licence number" required />
          <Field name="licenceExpiry" label="Expiry date" type="date" required />
          <Field name="licenceFile" label="Licence certificate" type="file" accept=".pdf,image/*" hint={FILE_HINT} required />
        </Step>
      )}
    </ActionForm>
  );
}
