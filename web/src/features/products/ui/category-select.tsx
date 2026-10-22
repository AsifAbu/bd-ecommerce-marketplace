"use client";

import { useRouter } from "next/navigation";

export interface CategoryOption {
  id: string;
  label: string;
  requiresLicence: boolean;
}

/** Pick a leaf category from a dropdown (type to jump); choosing one opens `${hrefBase}?categoryId=`. */
export function CategorySelect({ hrefBase, options, selectedId }: { hrefBase: string; options: CategoryOption[]; selectedId?: string }) {
  const router = useRouter();
  return (
    <div className="flex max-w-xl flex-col gap-1.5">
      <label htmlFor="category-select" className="text-sm font-medium">
        Category
      </label>
      <select
        id="category-select"
        className="min-h-11 rounded-md border border-line bg-paper px-3"
        value={selectedId ?? ""}
        onChange={(e) => e.target.value && router.push(`${hrefBase}?categoryId=${encodeURIComponent(e.target.value)}`)}
      >
        <option value="">Choose a category…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {o.requiresLicence ? " (needs a verified drug licence)" : ""}
          </option>
        ))}
      </select>
      <p className="text-sm text-muted">The form below changes with the category.</p>
    </div>
  );
}
