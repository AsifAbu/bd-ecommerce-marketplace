import Link from "next/link";
import { createCategoryAction } from "../actions";
import { listCategories } from "../service";
import { toOutline } from "../tree";
import { ActionForm, SubmitButton } from "./action-form";
import { checkboxLabelClass, inputClass, labelClass, sectionClass } from "./styles";

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-900">{children}</span>;
}

export function ParentOptions({ categories, excludePathPrefix }: { categories: Awaited<ReturnType<typeof listCategories>>; excludePathPrefix?: string }) {
  return toOutline(categories)
    .filter((c) => !c.isOther && !c.archivedAt && !(excludePathPrefix && c.path.startsWith(excludePathPrefix)))
    .map((c) => (
      <option key={c.id} value={c.id}>
        {"  ".repeat(c.depth)}
        {c.name}
      </option>
    ));
}

/** US-020: the category tree with a create form. Edit a category on its own page. */
export async function CategoryTree() {
  const categories = await listCategories();
  const outline = toOutline(categories);

  return (
    <div className="flex flex-col gap-6">
      <section className={sectionClass} aria-labelledby="new-category">
        <h2 id="new-category" className="text-lg font-semibold">
          New category
        </h2>
        <ActionForm action={createCategoryAction} label="New category">
          <label className={labelClass}>
            Name
            <input name="name" required maxLength={80} className={inputClass} />
          </label>
          <label className={labelClass}>
            Parent
            <select name="parentId" className={inputClass} defaultValue="">
              <option value="">(top level)</option>
              <ParentOptions categories={categories} />
            </select>
          </label>
          <label className={labelClass}>
            Commission %
            <input name="commissionRate" type="number" min={0} max={100} step="0.01" placeholder="inherit" className={`${inputClass} w-24`} />
          </label>
          <label className={checkboxLabelClass}>
            <input type="checkbox" name="requiresLicence" /> Requires licence
          </label>
          <label className={checkboxLabelClass}>
            <input type="checkbox" name="requiresExpiry" /> Requires expiry date
          </label>
          <SubmitButton>Create</SubmitButton>
        </ActionForm>
        <p className="text-sm text-gray-700">Empty fields are inherited from the parent (top level: 10% commission).</p>
      </section>

      <section aria-labelledby="tree">
        <h2 id="tree" className="mb-2 text-lg font-semibold">
          Category tree
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th scope="col" className="py-1">Category</th>
              <th scope="col">Commission</th>
              <th scope="col">Flags</th>
            </tr>
          </thead>
          <tbody>
            {outline.map((c) => (
              <tr key={c.id} className={`border-b border-gray-200 ${c.archivedAt ? "text-gray-500" : ""}`}>
                <td className="py-1" style={{ paddingLeft: `${c.depth * 1.5}rem` }}>
                  <Link className="underline" href={`/admin/catalog/categories/${c.id}`}>
                    {c.name}
                  </Link>
                </td>
                <td>{c.commissionRate.toString()}%</td>
                <td className="flex flex-wrap gap-1 py-1">
                  {c.isLeaf && <Badge>leaf</Badge>}
                  {c.isOther && <Badge>Other</Badge>}
                  {c.requiresLicence && <Badge>licence</Badge>}
                  {c.requiresExpiry && <Badge>expiry</Badge>}
                  {c.archivedAt && <Badge>archived</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
