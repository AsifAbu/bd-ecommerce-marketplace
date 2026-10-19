import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/admin/data-table";
import {
  addOtherLeafAction,
  archiveCategoryAction,
  assignAttributeAction,
  moveCategoryAction,
  renameCategoryAction,
  unassignAttributeAction,
  updateCategorySettingsAction,
} from "../actions";
import { getCategory, listAttributes, listCategories } from "../service";
import { ActionForm, SubmitButton } from "./action-form";
import { Badge, ParentOptions } from "./category-tree";
import { checkboxLabelClass, inputClass, labelClass, sectionClass } from "./styles";

/** US-020/021/024: edit one category and, for a leaf, its attribute assignments. */
export async function CategoryDetail({ id }: { id: Promise<string> }) {
  const categoryId = await id;
  const [category, categories, attributes] = await Promise.all([
    getCategory(categoryId),
    listCategories(),
    listAttributes(),
  ]);
  if (!category) {
    return (
      <Notice tone="error">
        Category not found.
      </Notice>
    );
  }

  const hasOther = categories.some((c) => c.parentId === category.id && c.isOther && !c.archivedAt);
  const canHaveAttributes = category.isLeaf && !category.isOther && !category.archivedAt;
  const assignedIds = new Set(category.attributes.map((a) => a.attributeId));

  return (
    <>
      <AdminPageHeader
        title={category.name}
        description={`Slug: ${category.slug}`}
        crumbs={[{ label: "Category tree", href: "/admin/catalog" }, { label: category.name }]}
      >
        {(category.isLeaf || category.isOther || category.archivedAt) && (
          <div className="flex flex-wrap gap-1">
            {category.isLeaf && <Badge>leaf</Badge>}
            {category.isOther && <Badge>Other</Badge>}
            {category.archivedAt && <Badge>archived</Badge>}
          </div>
        )}
      </AdminPageHeader>

      <section className={sectionClass} aria-labelledby="edit">
        <h2 id="edit" className="text-lg font-semibold">
          Edit
        </h2>
        <ActionForm action={renameCategoryAction} label="Rename">
          <input type="hidden" name="id" value={category.id} />
          <label className={labelClass}>
            Name
            <input name="name" required maxLength={80} defaultValue={category.name} className={inputClass} />
          </label>
          <SubmitButton>Rename</SubmitButton>
        </ActionForm>
        <ActionForm action={updateCategorySettingsAction} label="Settings">
          <input type="hidden" name="id" value={category.id} />
          <label className={labelClass}>
            Commission %
            <input
              name="commissionRate"
              type="number"
              required
              min={0}
              max={100}
              step="0.01"
              defaultValue={category.commissionRate.toString()}
              className={`${inputClass} w-24`}
            />
          </label>
          <label className={checkboxLabelClass}>
            <input type="checkbox" name="requiresLicence" defaultChecked={category.requiresLicence} /> Requires licence
          </label>
          <label className={checkboxLabelClass}>
            <input type="checkbox" name="requiresExpiry" defaultChecked={category.requiresExpiry} /> Requires expiry date
          </label>
          <SubmitButton>Save settings</SubmitButton>
        </ActionForm>
        <ActionForm action={moveCategoryAction} label="Move">
          <input type="hidden" name="id" value={category.id} />
          <label className={labelClass}>
            Move under
            <select name="parentId" className={inputClass} defaultValue={category.parentId ?? ""}>
              <option value="">(top level)</option>
              <ParentOptions categories={categories} excludePathPrefix={category.path} />
            </select>
          </label>
          <SubmitButton>Move</SubmitButton>
        </ActionForm>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {!category.isOther && !category.archivedAt && !hasOther && (
            <ActionForm action={addOtherLeafAction} label="Add Other leaf">
              <input type="hidden" name="parentId" value={category.id} />
              <SubmitButton variant="secondary">Add &quot;Other&quot; leaf</SubmitButton>
            </ActionForm>
          )}
          {!category.archivedAt && (
            <ActionForm action={archiveCategoryAction} label="Archive">
              <input type="hidden" name="id" value={category.id} />
              <SubmitButton variant="danger">Archive</SubmitButton>
            </ActionForm>
          )}
        </div>
      </section>

      {canHaveAttributes && (
        <section className={sectionClass} aria-labelledby="attrs">
          <h2 id="attrs" className="text-lg font-semibold">
            Attributes
          </h2>
          <p className="text-sm text-muted">
            The guideline fields (quantity, weight, brand, origin, returns, warranty
            {category.requiresExpiry ? ", expiry date" : ""}) are added automatically.{" "}
            <Link className="font-medium text-jade underline-offset-4 hover:underline" href={`/api/categories/${category.id}/schema`}>
              View the effective schema (JSON)
            </Link>
          </p>
          <Table caption="Assigned attributes" stack>
            <Thead>
              <tr>
                <Th>Order</Th>
                <Th>Attribute</Th>
                <Th>Settings</Th>
                <Th>
                  <span className="sr-only">Remove</span>
                </Th>
              </tr>
            </Thead>
            <Tbody>
              {category.attributes.map((a) => (
                <Tr key={a.attributeId}>
                  <Td label="Order" className="py-2">{a.displayOrder}</Td>
                  <Td label="Attribute" className="py-2">
                    {a.attribute.name} <span className="text-muted">({a.attribute.type})</span>
                    {a.attribute.archivedAt && <Badge>archived</Badge>}
                  </Td>
                  <Td label="Settings" className="py-2">
                    <span className="flex flex-wrap gap-1">
                      {a.required && <Badge>required</Badge>}
                      {a.filterable && <Badge>filter: {a.filterWidget ?? "default"}</Badge>}
                      {a.isVariantAxis && <Badge>variant axis</Badge>}
                    </span>
                  </Td>
                  <Td className="py-2">
                    <ActionForm action={unassignAttributeAction} label={`Remove ${a.attribute.name}`}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input type="hidden" name="attributeId" value={a.attributeId} />
                      <SubmitButton variant="secondary">Remove</SubmitButton>
                    </ActionForm>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          <h3 className="font-semibold">Add or update an attribute</h3>
          <ActionForm action={assignAttributeAction} label="Assign attribute">
            <input type="hidden" name="categoryId" value={category.id} />
            <label className={labelClass}>
              Attribute
              <select name="attributeId" required className={inputClass}>
                {attributes
                  .filter((a) => !a.archivedAt)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.key}){assignedIds.has(a.id) ? " - assigned" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label className={labelClass}>
              Order
              <input name="displayOrder" type="number" min={0} max={999} defaultValue={category.attributes.length + 1} className={`${inputClass} w-20`} />
            </label>
            <label className={labelClass}>
              Filter widget
              <select name="filterWidget" className={inputClass} defaultValue="">
                <option value="">(none)</option>
                <option value="checkbox_list">Checkbox list</option>
                <option value="range_slider">Range slider</option>
                <option value="toggle">Toggle</option>
              </select>
            </label>
            <label className={checkboxLabelClass}>
              <input type="checkbox" name="required" /> Required
            </label>
            <label className={checkboxLabelClass}>
              <input type="checkbox" name="filterable" /> Filterable
            </label>
            <label className={checkboxLabelClass}>
              <input type="checkbox" name="isVariantAxis" /> Variant axis
            </label>
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </section>
      )}
    </>
  );
}
