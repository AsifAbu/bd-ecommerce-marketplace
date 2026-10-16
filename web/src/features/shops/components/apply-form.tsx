"use client";

import { useState } from "react";
import { applyForShop } from "../actions";
import { SHOP_TYPE_LABELS, SHOP_TYPES } from "../schemas";
import { ActionForm, Field } from "./action-form";

const FILE_HINT = "PDF, JPG, PNG or WebP, up to 4 MB. In test mode any file is accepted.";

/** US-010 / US-015 application form. Licence fields appear for medicine shops. */
export function ApplyForm() {
  const [type, setType] = useState("");
  return (
    <ActionForm action={applyForShop} submitLabel="Submit application">
      <Field name="name" label="Shop name" required />
      <Field name="slug" label="Shop link" hint="Lowercase letters, numbers and hyphens, e.g. dhaka-books" required />
      <Field
        as="select"
        name="type"
        label="Shop type"
        required
        onChange={setType}
        options={SHOP_TYPES.map((t) => ({ value: t, label: SHOP_TYPE_LABELS[t] }))}
      />
      <Field name="ownerNid" label="Owner NID number" hint="10, 13 or 17 digits" required />
      <Field name="ownerPhoto" label="Owner photo" type="file" accept="image/*" hint={FILE_HINT} required />
      {type === "medicine" && (
        <fieldset className="flex flex-col gap-3 rounded border border-gray-400 p-3">
          <legend className="px-1 font-semibold">Drug licence (required for medicine shops)</legend>
          <Field name="licenceNo" label="Licence number" required />
          <Field name="licenceExpiry" label="Expiry date" type="date" required />
          <Field name="licenceFile" label="Licence certificate" type="file" accept=".pdf,image/*" hint={FILE_HINT} required />
        </fieldset>
      )}
    </ActionForm>
  );
}
