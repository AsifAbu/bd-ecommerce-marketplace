import { addAttributeOptionAction, approveAttributeOptionAction, archiveAttributeAction, createAttributeAction } from "../actions";
import { listAttributes } from "../service";
import { ActionForm, SubmitButton } from "./action-form";
import { Badge } from "./category-tree";
import { inputClass, labelClass, sectionClass } from "./styles";

/** US-021: attributes are defined once; archived ones stay listed and readable. */
export async function AttributeList() {
  const attributes = await listAttributes();

  return (
    <div className="flex flex-col gap-6">
      <section className={sectionClass} aria-labelledby="new-attribute">
        <h2 id="new-attribute" className="text-lg font-semibold">
          New attribute
        </h2>
        <ActionForm action={createAttributeAction} label="New attribute">
          <label className={labelClass}>
            Key
            <input name="key" required pattern="[a-z][a-z0-9_]*" placeholder="socket" className={inputClass} />
          </label>
          <label className={labelClass}>
            Name
            <input name="name" required maxLength={80} placeholder="Socket" className={inputClass} />
          </label>
          <label className={labelClass}>
            Type
            <select name="type" className={inputClass}>
              <option value="enum">enum</option>
              <option value="multi_enum">multi_enum</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="text">text</option>
            </select>
          </label>
          <label className={labelClass}>
            Unit
            <input name="unit" maxLength={20} placeholder="GHz" className={`${inputClass} w-20`} />
          </label>
          <label className={labelClass}>
            Options (comma-separated, enum only)
            <input name="options" placeholder="AM5, LGA1700" className={inputClass} />
          </label>
          <SubmitButton>Create</SubmitButton>
        </ActionForm>
      </section>

      <section aria-labelledby="attributes" className="flex flex-col gap-3">
        <h2 id="attributes" className="text-lg font-semibold">
          Attributes
        </h2>
        {attributes.map((a) => (
          <article key={a.id} className={`${sectionClass} ${a.archivedAt ? "text-gray-600" : ""}`} aria-label={a.name}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{a.name}</h3>
              <code className="text-sm">{a.key}</code>
              <Badge>{a.type}</Badge>
              {a.unit && <Badge>{a.unit}</Badge>}
              {a.archivedAt && <Badge>archived</Badge>}
              <span className="text-sm">used in {a._count.categories} categories</span>
            </div>
            {a.options.length > 0 && (
              <ul className="flex flex-wrap gap-2 text-sm">
                {a.options.map((o) => (
                  <li key={o.id} className="flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5">
                    {o.label}
                    {o.status === "pending" && (
                      <ActionForm action={approveAttributeOptionAction} label={`Approve ${o.label}`} className="inline-flex gap-1">
                        <input type="hidden" name="optionId" value={o.id} />
                        <Badge>pending</Badge>
                        <SubmitButton variant="secondary">Approve</SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!a.archivedAt && (
              <div className="flex flex-wrap gap-4">
                {(a.type === "enum" || a.type === "multi_enum") && (
                  <ActionForm action={addAttributeOptionAction} label={`Add option to ${a.name}`}>
                    <input type="hidden" name="attributeId" value={a.id} />
                    <label className={labelClass}>
                      New option
                      <input name="label" required maxLength={80} className={inputClass} />
                    </label>
                    <SubmitButton variant="secondary">Add option</SubmitButton>
                  </ActionForm>
                )}
                <ActionForm action={archiveAttributeAction} label={`Archive ${a.name}`}>
                  <input type="hidden" name="id" value={a.id} />
                  <SubmitButton variant="danger">Archive</SubmitButton>
                </ActionForm>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
