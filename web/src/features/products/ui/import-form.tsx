"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import type { ImportRowError } from "../errors";
import { callApi } from "./api-client";
import { buttonClass, errorTextClass, inputClass, linkClass } from "./styles";

/** CSV upload (US-034). All or nothing: on any problem, every row error is listed and nothing is imported. */
export function ImportForm({ shopId, categoryId }: { shopId: string; categoryId: string }) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; rows?: ImportRowError[] } | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("categoryId", categoryId);
    setPending(true);
    setCreated(null);
    setError(null);
    const result = await callApi<{ created: number }>(`/api/shops/${shopId}/products/import`, { method: "POST", body: form });
    setPending(false);
    if (result.ok) setCreated(result.data.created);
    else setError({ message: result.error.fields?.file ?? result.error.message, rows: result.error.rows });
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="font-medium">
            CSV file
          </label>
          <p id={`${id}-hint`} className="text-sm text-gray-700">
            Up to 500 rows and 1 MB, saved as CSV (UTF-8).
          </p>
          <input id={id} name="file" type="file" accept=".csv,text/csv" required className={inputClass} aria-describedby={`${id}-hint`} />
        </div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Importing…" : "Import products"}
        </button>
      </form>
      <div ref={resultRef} tabIndex={-1}>
        {created !== null && (
          <p role="status" className="font-medium text-green-800">
            Imported {created} {created === 1 ? "product" : "products"}.{" "}
            <Link className={linkClass} href={`/seller/${shopId}/products`}>
              See your products
            </Link>
          </p>
        )}
        {error && (
          <div role="alert" className="flex flex-col gap-2">
            <p className="font-medium text-red-700">{error.message}</p>
            {error.rows && error.rows.length > 0 && (
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Problems in the file</caption>
                <thead>
                  <tr className="border-b border-gray-400">
                    <th scope="col" className="py-1 pr-3">
                      Line
                    </th>
                    <th scope="col" className="py-1 pr-3">
                      Column
                    </th>
                    <th scope="col" className="py-1">
                      Problem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {error.rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="py-1 pr-3">{r.row}</td>
                      <td className="py-1 pr-3">{r.column ?? "—"}</td>
                      <td className={`py-1 ${errorTextClass}`}>{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
