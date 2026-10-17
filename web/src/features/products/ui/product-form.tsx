"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { CategorySchema, FieldDef } from "@/features/catalog";
import { callApi } from "./api-client";
import { buttonClass, errorTextClass, inputClass, secondaryButtonClass } from "./styles";

/**
 * The listing form generated from a leaf category's schema (US-030, US-031): product fields in
 * display order, then one row per variant (variant axes + price, stock, SKU). The server
 * validates with the same schema; its field errors are shown next to each field.
 */

export interface VariantValues {
  id?: string;
  sku: string;
  price: string;
  stock: string;
  options: Record<string, string>;
}

export interface ProductValues {
  title: string;
  bengaliName?: string;
  description: string;
  attributes: Record<string, unknown>;
  variants: VariantValues[];
}

type Errors = Record<string, string>;

const EMPTY_VARIANT: VariantValues = { sku: "", price: "", stock: "", options: {} };

function Label({ htmlFor, children, required }: { htmlFor: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="font-medium">
      {children}
      {required && <span aria-hidden="true"> *</span>}
    </label>
  );
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className={errorTextClass}>
      {error}
    </p>
  ) : null;
}

const fieldLabel = (f: FieldDef) => `${f.name}${f.unit ? ` (${f.unit})` : ""}`;

/** One schema field, named `name`, with its label and error. */
function SchemaField({ field, name, error, value, label }: { field: FieldDef; name: string; error?: string; value: unknown; label?: string }) {
  const id = useId();
  const errorId = `${id}-error`;
  const common = {
    id,
    name,
    required: field.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    className: inputClass,
  };
  const text = label ?? fieldLabel(field);

  if (field.type === "multi_enum") {
    const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
    return (
      <fieldset className="flex flex-col gap-1" aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}>
        <legend className="font-medium">
          {text}
          {field.required && <span aria-hidden="true"> *</span>}
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {field.options.map((o) => (
            <label key={o.value} className="flex items-center gap-1">
              <input type="checkbox" name={name} value={o.value} defaultChecked={selected.has(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
        <ErrorText id={errorId} error={error} />
      </fieldset>
    );
  }

  let control: ReactNode;
  if (field.type === "enum" || field.type === "boolean") {
    const options =
      field.type === "enum"
        ? field.options
        : [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ];
    const current = field.type === "boolean" ? (value === true ? "yes" : value === false ? "no" : "") : String(value ?? "");
    control = (
      <select {...common} defaultValue={current}>
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else {
    const type = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
    control = (
      <input
        {...common}
        type={type}
        step={field.type === "number" ? "any" : undefined}
        min={field.type === "number" ? 0 : undefined}
        maxLength={field.type === "text" ? 2000 : undefined}
        defaultValue={value === undefined || value === null ? "" : String(value)}
      />
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} required={field.required}>
        {text}
      </Label>
      {control}
      <ErrorText id={errorId} error={error} />
    </div>
  );
}

function PlainField(props: {
  name: string;
  label: string;
  error?: string;
  defaultValue?: string;
  required?: boolean;
  as?: "textarea";
  type?: string;
  inputMode?: "decimal" | "numeric";
  hint?: string;
}) {
  const id = useId();
  const describedBy = [props.hint && `${id}-hint`, props.error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: props.name,
    required: props.required,
    defaultValue: props.defaultValue,
    "aria-invalid": props.error ? true : undefined,
    "aria-describedby": describedBy,
    className: inputClass,
  };
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} required={props.required}>
        {props.label}
      </Label>
      {props.hint && (
        <p id={`${id}-hint`} className="text-sm text-gray-700">
          {props.hint}
        </p>
      )}
      {props.as === "textarea" ? (
        <textarea {...common} rows={5} maxLength={5000} />
      ) : (
        <input {...common} type={props.type ?? "text"} inputMode={props.inputMode} />
      )}
      <ErrorText id={`${id}-error`} error={props.error} />
    </div>
  );
}

/** Reads a schema field from the form: omitted when empty, typed by the field. */
function readField(form: FormData, field: FieldDef, name: string): unknown {
  if (field.type === "multi_enum") {
    const values = form.getAll(name).map(String);
    return values.length ? values : undefined;
  }
  const raw = String(form.get(name) ?? "").trim();
  if (raw === "") return undefined;
  if (field.type === "boolean") return raw === "yes";
  if (field.type === "number") return Number.isNaN(Number(raw)) ? raw : Number(raw);
  return raw;
}

export function ProductForm({
  shopId,
  schema,
  productId,
  initial,
}: {
  shopId: string;
  schema: CategorySchema;
  /** Set when editing. */
  productId?: string;
  initial?: ProductValues;
}) {
  const router = useRouter();
  const productFields = schema.fields.filter((f) => !f.isVariantAxis);
  const axes = schema.fields.filter((f) => f.isVariantAxis);
  const [rows, setRows] = useState(() =>
    (initial?.variants.length ? initial.variants : [EMPTY_VARIANT]).map((v, i) => ({ key: i, values: v })),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const alertRef = useRef<HTMLParagraphElement>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const attributes: Record<string, unknown> = {};
    for (const f of productFields) {
      const v = readField(form, f, `attr.${f.key}`);
      if (v !== undefined) attributes[f.key] = v;
    }
    const variants = rows.map(({ key, values }) => {
      const options: Record<string, unknown> = {};
      for (const f of axes) {
        const v = readField(form, f, `v${key}.opt.${f.key}`);
        if (v !== undefined) options[f.key] = v;
      }
      return {
        ...(values.id ? { id: values.id } : {}),
        sku: String(form.get(`v${key}.sku`) ?? ""),
        price: String(form.get(`v${key}.price`) ?? ""),
        stock: String(form.get(`v${key}.stock`) ?? "").trim(),
        options,
      };
    });
    const body = {
      categoryId: schema.categoryId,
      title: String(form.get("title") ?? ""),
      bengaliName: String(form.get("bengaliName") ?? ""),
      description: String(form.get("description") ?? ""),
      attributes,
      variants,
    };

    setPending(true);
    const base = `/api/shops/${shopId}/products`;
    const result = productId
      ? await callApi(`${base}/${productId}`, { method: "PATCH", json: body })
      : await callApi<{ id: string }>(base, { method: "POST", json: body });
    setPending(false);
    if (!result.ok) {
      setErrors(result.error.fields ?? {});
      setMessage(result.error.message);
      requestAnimationFrame(() => alertRef.current?.focus());
      return;
    }
    setErrors({});
    setMessage(null);
    const id = productId ?? (result.data as { id: string }).id;
    router.replace(`/seller/${shopId}/products/${id}?${productId ? "saved" : "created"}=1`);
    router.refresh();
  }

  const variantError = (i: number, key: string) => errors[`variants.${i}.${key}`];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label={productId ? "Edit product" : "New product"}>
      <p className="text-sm text-gray-700">
        Fields marked <span aria-hidden="true">*</span>
        <span className="sr-only">with an asterisk</span> are required.
      </p>
      {errors.categoryId && <p className={errorTextClass}>{errors.categoryId}</p>}
      <PlainField name="title" label="Title" required defaultValue={initial?.title} error={errors.title} />
      <PlainField
        name="bengaliName"
        label="Bengali name (optional)"
        hint="Helps shoppers who search in Bengali, e.g. শাড়ি"
        defaultValue={initial?.bengaliName}
        error={errors.bengaliName}
      />
      <PlainField name="description" label="Description" as="textarea" required defaultValue={initial?.description} error={errors.description} />

      <fieldset className="flex flex-col gap-3 rounded border border-gray-300 p-3">
        <legend className="px-1 text-lg font-semibold">Details for {schema.name}</legend>
        {productFields.map((f) => (
          <SchemaField key={f.key} field={f} name={`attr.${f.key}`} value={initial?.attributes[f.key]} error={errors[`attributes.${f.key}`]} />
        ))}
      </fieldset>

      <section aria-labelledby="variants-heading" className="flex flex-col gap-3">
        <h2 id="variants-heading" className="text-lg font-semibold">
          {axes.length ? "Variants" : "Price and stock"}
        </h2>
        {axes.length > 0 && (
          <p className="text-sm text-gray-700">
            One row per {axes.map((a) => a.name.toLowerCase()).join(" and ")} combination, each with its own price and stock.
          </p>
        )}
        {errors.variants && <p className={errorTextClass}>{errors.variants}</p>}
        {rows.map(({ key, values }, i) => (
          <fieldset key={key} className="flex flex-col gap-3 rounded border border-gray-300 p-3">
            <legend className="px-1 font-semibold">{axes.length ? `Variant ${i + 1}` : "Price and stock"}</legend>
            {(variantError(i, "options") || errors[`variants.${i}`]) && (
              <p className={errorTextClass}>{variantError(i, "options") ?? errors[`variants.${i}`]}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {axes.map((f) => (
                <SchemaField
                  key={f.key}
                  field={f}
                  name={`v${key}.opt.${f.key}`}
                  label={`${fieldLabel(f)} (variant ${i + 1})`}
                  value={values.options[f.key]}
                  error={variantError(i, `options.${f.key}`)}
                />
              ))}
              <PlainField
                name={`v${key}.price`}
                label={axes.length ? `Price in Tk (variant ${i + 1})` : "Price (Tk)"}
                required
                inputMode="decimal"
                defaultValue={values.price}
                error={variantError(i, "price")}
              />
              <PlainField
                name={`v${key}.stock`}
                label={axes.length ? `Stock (variant ${i + 1})` : "Stock"}
                required
                inputMode="numeric"
                defaultValue={values.stock}
                error={variantError(i, "stock")}
              />
              <PlainField
                name={`v${key}.sku`}
                label={axes.length ? `SKU (variant ${i + 1}, optional)` : "SKU (optional)"}
                defaultValue={values.sku}
                error={variantError(i, "sku")}
              />
            </div>
            {axes.length > 0 && rows.length > 1 && (
              <div>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => setRows((r) => r.filter((row) => row.key !== key))}
                >
                  Remove variant {i + 1}
                </button>
              </div>
            )}
          </fieldset>
        ))}
        {axes.length > 0 && rows.length < 100 && (
          <div>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setRows((r) => [...r, { key: Math.max(-1, ...r.map((row) => row.key)) + 1, values: EMPTY_VARIANT }])}
            >
              Add variant
            </button>
          </div>
        )}
      </section>

      {message && (
        <p ref={alertRef} tabIndex={-1} role="alert" className="font-medium text-red-700">
          {message}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : productId ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}
