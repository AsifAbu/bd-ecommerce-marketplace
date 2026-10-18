"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { Notice, RowHeader, Table, Td, Th } from "@/components/ui";
import type { ImportRowError } from "../errors";
import { callApi } from "./api-client";
import { buttonClass, inputClass } from "./styles";

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
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-sm font-medium text-ink">
            CSV file
          </label>
          <p id={`${id}-hint`} className="text-sm text-muted">
            Up to 500 rows and 1 MB, saved as CSV (UTF-8).
          </p>
          <input id={id} name="file" type="file" accept=".csv,text/csv" required className={inputClass} aria-describedby={`${id}-hint`} />
        </div>
        <div>
          <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass}>
            {pending ? (
              <>
                <span aria-hidden="true" className="spinner" />
                Importing…
              </>
            ) : (
              "Import products"
            )}
          </button>
        </div>
      </form>
      <div ref={resultRef} tabIndex={-1} className="outline-none">
        {created !== null && (
          <Notice tone="success">
            Imported {created} {created === 1 ? "product" : "products"}.{" "}
            <Link className="underline underline-offset-4" href={`/seller/${shopId}/products`}>
              See your products
            </Link>
          </Notice>
        )}
        {error && (
          <div role="alert" className="flex flex-col gap-3">
            <Notice tone="error" role="presentation">
              {error.message}
            </Notice>
            {error.rows && error.rows.length > 0 && (
              <Table label="Problems in the file">
                <caption className="sr-only">Problems in the file</caption>
                <thead>
                  <tr>
                    <Th>Line</Th>
                    <Th>Column</Th>
                    <Th>Problem</Th>
                  </tr>
                </thead>
                <tbody>
                  {error.rows.map((r, i) => (
                    <tr key={i}>
                      <RowHeader className="tabular whitespace-nowrap">{r.row}</RowHeader>
                      <Td className="whitespace-nowrap">{r.column ?? "–"}</Td>
                      <Td className="min-w-48 text-vermilion">{r.message}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
