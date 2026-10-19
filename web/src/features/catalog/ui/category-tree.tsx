import Link from "next/link";
import { Badge as KitBadge } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/admin/data-table";
import { createCategoryAction } from "../actions";
import { listCategories } from "../service";
import { toOutline } from "../tree";
import { ActionForm, SubmitButton } from "./action-form";
import { checkboxLabelClass, inputClass, labelClass, sectionClass } from "./styles";

export function Badge({ children }: { children: React.ReactNode }) {
  return <KitBadge>{children}</KitBadge>;
}

export function ParentOptions({ categories, excludePathPrefix }: { categories: Awaited<ReturnType<typeof listCategories>>; excludePathPrefix?: string }) {
  return toOutline(categories)
    .filter((c) => !c.isOther && !c.archivedAt && !(excludePathPrefix && c.path.startsWith(excludePathPrefix)))
    .map((c) => (
      <option key={c.id} value={c.id}>
        {"  ".repeat(c.depth)}
        {c.name}
      </option>
    ));
}

/** US-020: the category tree with a create form. Edit a category on its own page. */
export async function CategoryTree() {
  const categories = await listCategories();
  const outline = toOutline(categories);

  return (
    <div className="flex flex-col gap-10">
      <section className={sectionClass} aria-labelledby="new-category">
        <h2 id="new-category" className="scroll-mt-24 text-lg font-semibold">
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
            <input name="commissionRate" type="number" min={0} max={100} step="0.01" placeholder="inherit" className={`${inputClass} w-28`} />
          </label>
          <label className={checkboxLabelClass}>
            <input type="checkbox" name="requiresLicence" /> Requires licence
          </label>
          <label className={checkboxLabelClass}>
            <input type="checkbox" name="requiresExpiry" /> Requires expiry date
          </label>
          <SubmitButton>Create</SubmitButton>
        </ActionForm>
        <p className="text-sm text-muted">Empty fields are inherited from the parent (top level: 10% commission).</p>
      </section>

      <section aria-labelledby="tree" className="flex flex-col gap-3">
        <h2 id="tree" className="text-xl font-semibold">
          Category tree
        </h2>
        <p className="text-sm text-muted">Sub-categories are indented under their parent. Open a category to rename, move or archive it, and to choose the attributes sellers fill in.</p>
        <Table caption="Category tree">
          <Thead>
            <tr>
              <Th>Category</Th>
              <Th align="right">Commission</Th>
              <Th>Flags</Th>
            </tr>
          </Thead>
          <Tbody>
            {outline.map((c) => (
              <Tr key={c.id} className={c.archivedAt ? "text-muted" : ""}>
                <Td className="py-2" style={{ paddingLeft: `${0.75 + c.depth * 1.5}rem` }}>
                  <Link className={`${c.depth === 0 ? "font-semibold" : "font-medium"} text-jade underline-offset-4 hover:underline`} href={`/admin/catalog/categories/${c.id}`}>
                    {c.name}
                  </Link>
                </Td>
                <Td align="right" className="py-2">
                  {c.commissionRate.toString()}%
                </Td>
                <Td className="py-2">
                  <span className="flex flex-wrap gap-1">
                    {c.isLeaf && <Badge>leaf</Badge>}
                    {c.isOther && <Badge>Other</Badge>}
                    {c.requiresLicence && <Badge>licence</Badge>}
                    {c.requiresExpiry && <Badge>expiry</Badge>}
                    {c.archivedAt && <Badge>archived</Badge>}
                  </span>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </section>
    </div>
  );
}
