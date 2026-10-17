"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { callApi } from "./api-client";
import { dangerButtonClass, errorTextClass, inputClass, secondaryButtonClass } from "./styles";

/** Activate / deactivate and delete (US-033). `afterDelete` is where to go once deleted. */
export function ProductActions({
  shopId,
  productId,
  title,
  status,
  afterDelete,
}: {
  shopId: string;
  productId: string;
  title: string;
  status: "active" | "inactive";
  afterDelete?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/shops/${shopId}/products/${productId}`;

  async function run(call: () => ReturnType<typeof callApi>, onOk: () => void) {
    setPending(true);
    setError(null);
    const result = await call();
    setPending(false);
    if (!result.ok) setError(result.error.message);
    else onOk();
  }

  const next = status === "active" ? "inactive" : "active";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={pending}
          aria-label={`${next === "active" ? "Activate" : "Deactivate"} ${title}`}
          onClick={() => run(() => callApi(`${base}/status`, { method: "PUT", json: { status: next } }), () => router.refresh())}
        >
          {next === "active" ? "Activate" : "Deactivate"}
        </button>
        <button
          type="button"
          className={dangerButtonClass}
          disabled={pending}
          aria-label={`Delete ${title}`}
          onClick={() => {
            if (!window.confirm(`Delete "${title}"? Customers will no longer see it.`)) return;
            run(
              () => callApi(base, { method: "DELETE" }),
              () => {
                if (afterDelete) router.push(afterDelete);
                router.refresh();
              },
            );
          }}
        >
          Delete
        </button>
      </div>
      {error && (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Quick stock update for one variant (US-033). */
export function StockForm({
  shopId,
  productId,
  variantId,
  label,
  stock,
}: {
  shopId: string;
  productId: string;
  variantId: string;
  label: string;
  stock: number;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("stock") ?? "").trim();
    setPending(true);
    setSaved(false);
    const result = await callApi(`/api/shops/${shopId}/products/${productId}/variants/${variantId}/stock`, {
      method: "PUT",
      json: { stock: value },
    });
    setPending(false);
    if (!result.ok) return setError(result.error.fields?.stock ?? result.error.message);
    setError(null);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="font-medium">
          Stock: {label}
        </label>
        <input
          id={id}
          name="stock"
          inputMode="numeric"
          defaultValue={stock}
          className={`${inputClass} w-32`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        Update stock
      </button>
      {error && (
        <p id={`${id}-error`} role="alert" className={errorTextClass}>
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-green-800">
          Stock updated
        </p>
      )}
    </form>
  );
}
