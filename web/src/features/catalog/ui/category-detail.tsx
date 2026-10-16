import Link from "next/link";
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
  if (!category) return <p role="alert">Category not found.</p>;

  const hasOther = categories.some((c) => c.parentId === category.id && c.isOther && !c.archivedAt);
  const canHaveAttributes = category.isLeaf && !category.isOther && !category.archivedAt;
  const assignedIds = new Set(category.attributes.map((a) => a.attributeId));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">{category.name}</h2>
        {category.isLeaf && <Badge>leaf</Badge>}
        {category.isOther && <Badge>Other</Badge>}
        {category.archivedAt && <Badge>archived</Badge>}
        <span className="text-sm text-gray-700">slug: {category.slug}</span>
      </div>

      <section className={sectionClass} aria-labelledby="edit">
        <h3 id="edit" className="font-semibold">
          Edit
        </h3>
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
        <div className="flex flex-wrap gap-4">
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
          <h3 id="attrs" className="font-semibold">
            Attributes
          </h3>
          <p className="text-sm text-gray-700">
            The guideline fields (quantity, weight, brand, origin, returns, warranty
            {category.requiresExpiry ? ", expiry date" : ""}) are added automatically.{" "}
            <Link className="underline" href={`/api/categories/${category.id}/schema`}>
              View the effective schema (JSON)
            </Link>
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th scope="col">Order</th>
                <th scope="col">Attribute</th>
                <th scope="col">Settings</th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {category.attributes.map((a) => (
                <tr key={a.attributeId} className="border-b border-gray-200">
                  <td className="py-1">{a.displayOrder}</td>
                  <td>
                    {a.attribute.name} <span className="text-gray-700">({a.attribute.type})</span>
                    {a.attribute.archivedAt && <Badge>archived</Badge>}
                  </td>
                  <td className="flex flex-wrap gap-1 py-1">
                    {a.required && <Badge>required</Badge>}
                    {a.filterable && <Badge>filter: {a.filterWidget ?? "default"}</Badge>}
                    {a.isVariantAxis && <Badge>variant axis</Badge>}
                  </td>
                  <td>
                    <ActionForm action={unassignAttributeAction} label={`Remove ${a.attribute.name}`}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input type="hidden" name="attributeId" value={a.attributeId} />
                      <SubmitButton variant="secondary">Remove</SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="font-medium">Add or update an attribute</h4>
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
    </div>
  );
}
