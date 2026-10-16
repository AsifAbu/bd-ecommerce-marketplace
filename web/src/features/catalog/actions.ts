"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin, requireUser, type GuardUser } from "@/lib/auth";
import { CatalogError, toErrorBody, type ErrorBody } from "./errors";
import * as catalog from "./service";

/** Result shown by <ActionForm>. Errors use the standard error shape plus the HTTP status. */
export type ActionState = { ok?: string; error?: ErrorBody["error"] & { status: number } } | null;

type Handler = (user: GuardUser, form: Record<string, FormDataEntryValue>) => Promise<string>;

function action(guard: () => Promise<GuardUser>, handler: Handler) {
  return async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
    try {
      const user = await guard(); // role check before any input is read
      const ok = await handler(user, Object.fromEntries(formData));
      revalidatePath("/", "layout");
      return { ok };
    } catch (err) {
      const { status, body } = toErrorBody(err);
      return { error: { ...body.error, status } };
    }
  };
}

const adminAction = (handler: Handler) => action(requirePlatformAdmin, handler);

function parse<T extends z.ZodType>(schema: T, form: Record<string, FormDataEntryValue>): z.infer<T> {
  const result = schema.safeParse(form);
  if (result.success) return result.data;
  const fields = Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
  throw new CatalogError(422, "VALIDATION", "Please check the form", fields);
}

const id = z.string().min(1);
const name = z.string().trim().min(1, "Required").max(80);
const optionalId = z.string().optional().transform((v) => v || null);
const checkbox = z.string().optional().transform((v) => v === "on");
const percent = z.coerce.number().min(0).max(100);
const note = z.string().trim().max(500).optional();

// ---------- Category tree ----------

export const createCategoryAction = adminAction(async (admin, form) => {
  const input = parse(
    z.object({
      name,
      parentId: optionalId,
      commissionRate: z.union([z.literal(""), percent]).optional(),
      requiresLicence: checkbox,
      requiresExpiry: checkbox,
    }),
    form,
  );
  await catalog.createCategory(admin.id, {
    name: input.name,
    parentId: input.parentId,
    commissionRate: input.commissionRate === "" ? undefined : input.commissionRate,
    // Unticked means "inherit from parent" on create; edit settings to clear a flag.
    requiresLicence: input.requiresLicence || undefined,
    requiresExpiry: input.requiresExpiry || undefined,
  });
  return `Created ${input.name}`;
});

export const renameCategoryAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ id, name }), form);
  await catalog.renameCategory(admin.id, input.id, input.name);
  return "Renamed";
});

export const updateCategorySettingsAction = adminAction(async (admin, form) => {
  const input = parse(
    z.object({ id, commissionRate: percent, requiresLicence: checkbox, requiresExpiry: checkbox }),
    form,
  );
  await catalog.updateCategorySettings(admin.id, input.id, input);
  return "Settings saved";
});

export const moveCategoryAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ id, parentId: optionalId }), form);
  await catalog.moveCategory(admin.id, input.id, input.parentId);
  return "Moved";
});

export const archiveCategoryAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ id }), form);
  await catalog.archiveCategory(admin.id, input.id);
  return "Archived";
});

export const addOtherLeafAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ parentId: id }), form);
  await catalog.addOtherLeaf(admin.id, input.parentId);
  return "Added \"Other\" leaf";
});

// ---------- Attributes ----------

export const createAttributeAction = adminAction(async (admin, form) => {
  const input = parse(
    z.object({
      key: z.string().trim().regex(/^[a-z][a-z0-9_]{0,39}$/, "Lowercase letters, digits and _"),
      name,
      type: z.enum(["enum", "multi_enum", "number", "boolean", "text"]),
      unit: z.string().trim().max(20).optional(),
      options: z.string().optional(),
    }),
    form,
  );
  const options = (input.options ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  await catalog.createAttribute(admin.id, { ...input, options });
  return `Created ${input.name}`;
});

export const addAttributeOptionAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ attributeId: id, label: name }), form);
  await catalog.addAttributeOption(admin.id, input.attributeId, input.label);
  return `Added ${input.label}`;
});

export const approveAttributeOptionAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ optionId: id }), form);
  await catalog.approveAttributeOption(admin.id, input.optionId);
  return "Option approved";
});

export const archiveAttributeAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ id }), form);
  await catalog.archiveAttribute(admin.id, input.id);
  return "Attribute archived";
});

export const assignAttributeAction = adminAction(async (admin, form) => {
  const input = parse(
    z.object({
      categoryId: id,
      attributeId: id,
      required: checkbox,
      filterable: checkbox,
      filterWidget: z
        .enum(["", "checkbox_list", "range_slider", "toggle"])
        .optional()
        .transform((v) => v || null),
      displayOrder: z.coerce.number().int().min(0).max(999),
      isVariantAxis: checkbox,
    }),
    form,
  );
  const { categoryId, ...assignment } = input;
  await catalog.assignAttribute(admin.id, categoryId, assignment);
  return "Attribute saved";
});

export const unassignAttributeAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ categoryId: id, attributeId: id }), form);
  await catalog.unassignAttribute(admin.id, input.categoryId, input.attributeId);
  return "Attribute removed from category";
});

// ---------- Category requests ----------

export const decideCategoryRequestAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ requestId: id, decision: z.enum(["approve", "reject"]), note }), form);
  await catalog.decideCategoryRequest(admin.id, input.requestId, input.decision === "approve", input.note);
  return input.decision === "approve" ? "Approved" : "Rejected";
});

// TODO after the shops merge: require shop membership and store the seller's shopId.
export const createCategoryRequestAction = action(requireUser, async (user, form) => {
  const input = parse(
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("category"), parentId: id, name, reason: note }),
      z.object({ kind: z.literal("enum_option"), attributeId: id, name, reason: note }),
    ]),
    form,
  );
  await catalog.createCategoryRequest(user.id, input);
  return "Request sent. An admin will answer within 24 hours.";
});
