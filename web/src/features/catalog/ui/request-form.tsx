import { requireUser } from "@/lib/auth";
import { listMyShops } from "@/features/shops/repo";
import { createCategoryRequestAction } from "../actions";
import { listAttributes, listCategories } from "../service";
import { ActionForm, SubmitButton } from "./action-form";
import { ParentOptions } from "./category-tree";
import { inputClass, labelClass, sectionClass } from "./styles";

/** US-022: a seller asks for a new category or a new enum option (answered within 24 hours). */
export async function RequestForms() {
  const user = await requireUser();
  const [categories, attributes, memberships] = await Promise.all([listCategories(), listAttributes(), listMyShops(user.id)]);
  const enumAttributes = attributes.filter((a) => !a.archivedAt && (a.type === "enum" || a.type === "multi_enum"));
  const shops = memberships.filter((m) => m.shop.status === "approved").map((m) => m.shop);
  if (shops.length === 0) {
    return <p role="status">Only approved shops can request categories. Open a shop at /shops/apply, or ask your shop owner to invite you.</p>;
  }
  const shopSelect = (
    <label className={labelClass}>
      For shop
      <select name="shopId" required className={inputClass}>
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className={sectionClass} aria-labelledby="req-category">
        <h2 id="req-category" className="text-lg font-semibold">
          Request a new category
        </h2>
        <ActionForm action={createCategoryRequestAction} label="Request a new category">
          <input type="hidden" name="kind" value="category" />
          {shopSelect}
          <label className={labelClass}>
            Under
            <select name="parentId" required className={inputClass}>
              <ParentOptions categories={categories} />
            </select>
          </label>
          <label className={labelClass}>
            Category name
            <input name="name" required maxLength={80} className={inputClass} />
          </label>
          <label className={labelClass}>
            Why is it needed? (optional)
            <input name="reason" maxLength={500} className={inputClass} />
          </label>
          <SubmitButton>Send request</SubmitButton>
        </ActionForm>
      </section>

      <section className={sectionClass} aria-labelledby="req-option">
        <h2 id="req-option" className="text-lg font-semibold">
          Request a new option (for example a brand)
        </h2>
        <ActionForm action={createCategoryRequestAction} label="Request a new option">
          <input type="hidden" name="kind" value="enum_option" />
          {shopSelect}
          <label className={labelClass}>
            Attribute
            <select name="attributeId" required className={inputClass}>
              {enumAttributes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            New option
            <input name="name" required maxLength={80} className={inputClass} />
          </label>
          <label className={labelClass}>
            Why is it needed? (optional)
            <input name="reason" maxLength={500} className={inputClass} />
          </label>
          <SubmitButton>Send request</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
