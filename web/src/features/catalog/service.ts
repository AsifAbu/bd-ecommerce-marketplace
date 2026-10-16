import type { AttributeType, FilterWidget, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { CatalogError } from "./errors";
import { buildEffectiveSchema, type CategorySchema } from "./schema";
import { buildPath, planMove, slugify } from "./tree";

/**
 * Catalog data access. Callers check roles first (actions.ts); every admin change
 * writes an AuditLog row in the same transaction.
 */

type Tx = Prisma.TransactionClient;

export const DEFAULT_COMMISSION_RATE = 10;
export const REQUEST_ANSWER_HOURS = 24;

function audit(tx: Tx, actorId: string, action: string, entity: string, entityId: string, data?: Prisma.InputJsonValue) {
  return tx.auditLog.create({ data: { actorId, action, entity, entityId, data } });
}

function notFound(what: string): never {
  throw new CatalogError(404, "NOT_FOUND", `${what} not found`);
}

async function refreshIsLeaf(tx: Tx, categoryId: string) {
  const children = await tx.category.count({ where: { parentId: categoryId, archivedAt: null } });
  await tx.category.update({ where: { id: categoryId }, data: { isLeaf: children === 0 } });
}

// ---------- Category tree (US-020, US-024) ----------

export function listCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export function getCategory(id: string) {
  return prisma.category.findUnique({
    where: { id },
    include: {
      attributes: { include: { attribute: true }, orderBy: { displayOrder: "asc" } },
    },
  });
}

export interface CreateCategoryInput {
  name: string;
  parentId?: string | null;
  commissionRate?: number;
  requiresLicence?: boolean;
  requiresExpiry?: boolean;
}

async function createCategoryTx(tx: Tx, actorId: string, input: CreateCategoryInput & { isOther?: boolean }) {
  const parent = input.parentId ? await tx.category.findUnique({ where: { id: input.parentId } }) : null;
  if (input.parentId && !parent) notFound("Parent category");
  if (parent?.isOther) throw new CatalogError(422, "INVALID_PARENT", "An \"Other\" leaf cannot have subcategories");
  if (parent?.archivedAt) throw new CatalogError(422, "INVALID_PARENT", "The parent category is archived");

  const base = input.isOther && parent ? `${parent.slug}-other` : slugify(input.name);
  // Slugs are global; on a clash (e.g. two "Accessories") prefix the parent's slug.
  const candidates = parent && !input.isOther ? [base, `${parent.slug}-${base}`] : [base];
  let slug: string | null = null;
  for (const candidate of candidates) {
    if (!(await tx.category.findUnique({ where: { slug: candidate } }))) {
      slug = candidate;
      break;
    }
  }
  if (!base || !slug) {
    throw new CatalogError(409, "SLUG_TAKEN", "A category with this name already exists", { name: "Choose another name" });
  }

  const created = await tx.category.create({
    data: {
      name: input.name,
      slug,
      path: "",
      parentId: parent?.id ?? null,
      isOther: input.isOther ?? false,
      // Children inherit their parent's commission and medicine flags unless set.
      commissionRate: input.commissionRate ?? parent?.commissionRate ?? DEFAULT_COMMISSION_RATE,
      requiresLicence: input.requiresLicence ?? parent?.requiresLicence ?? false,
      requiresExpiry: input.requiresExpiry ?? parent?.requiresExpiry ?? false,
    },
  });
  const category = await tx.category.update({
    where: { id: created.id },
    data: { path: buildPath(parent?.path ?? null, created.id) },
  });
  if (parent) await tx.category.update({ where: { id: parent.id }, data: { isLeaf: false } });
  await audit(tx, actorId, "category.created", "category", category.id, {
    name: category.name,
    parentId: category.parentId,
    isOther: category.isOther,
  });
  return category;
}

export function createCategory(actorId: string, input: CreateCategoryInput) {
  return prisma.$transaction((tx) => createCategoryTx(tx, actorId, input));
}

/** US-024: an "Other" leaf with only the common fields, so a seller is never blocked. */
export function addOtherLeaf(actorId: string, parentId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.category.findFirst({ where: { parentId, isOther: true, archivedAt: null } });
    if (existing) throw new CatalogError(409, "OTHER_EXISTS", "This category already has an \"Other\" leaf");
    return createCategoryTx(tx, actorId, { name: "Other", parentId, isOther: true });
  });
}

export function renameCategory(actorId: string, id: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const before = (await tx.category.findUnique({ where: { id } })) ?? notFound("Category");
    const category = await tx.category.update({ where: { id }, data: { name } });
    await audit(tx, actorId, "category.renamed", "category", id, { from: before.name, to: name });
    return category;
  });
}

export function updateCategorySettings(
  actorId: string,
  id: string,
  input: { commissionRate: number; requiresLicence: boolean; requiresExpiry: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const before = (await tx.category.findUnique({ where: { id } })) ?? notFound("Category");
    const category = await tx.category.update({ where: { id }, data: input });
    await audit(tx, actorId, "category.settings_updated", "category", id, {
      from: {
        commissionRate: before.commissionRate.toString(),
        requiresLicence: before.requiresLicence,
        requiresExpiry: before.requiresExpiry,
      },
      to: input,
    });
    return category;
  });
}

/** Moves a category and its subtree; rewrites the materialised paths. */
export function moveCategory(actorId: string, id: string, newParentId: string | null) {
  return prisma.$transaction(async (tx) => {
    const node = (await tx.category.findUnique({ where: { id } })) ?? notFound("Category");
    const newParent = newParentId
      ? ((await tx.category.findUnique({ where: { id: newParentId } })) ?? notFound("New parent"))
      : null;
    const subtree = await tx.category.findMany({ where: { path: { startsWith: node.path } }, select: { id: true, path: true } });
    const updates = planMove(node, newParent, subtree);

    await tx.category.update({ where: { id }, data: { parentId: newParent?.id ?? null } });
    for (const u of updates) await tx.category.update({ where: { id: u.id }, data: { path: u.path } });
    if (node.parentId) await refreshIsLeaf(tx, node.parentId);
    if (newParent) await tx.category.update({ where: { id: newParent.id }, data: { isLeaf: false } });
    await audit(tx, actorId, "category.moved", "category", id, { fromParentId: node.parentId, toParentId: newParentId });
  });
}

/** Archives a category with no active subcategories. Never hard-deleted. */
export function archiveCategory(actorId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const node = (await tx.category.findUnique({ where: { id } })) ?? notFound("Category");
    const children = await tx.category.count({ where: { parentId: id, archivedAt: null } });
    if (children > 0) throw new CatalogError(422, "HAS_CHILDREN", "Archive or move its subcategories first");
    await tx.category.update({ where: { id }, data: { archivedAt: new Date() } });
    if (node.parentId) await refreshIsLeaf(tx, node.parentId);
    await audit(tx, actorId, "category.archived", "category", id, { name: node.name });
  });
}

// ---------- Attributes (US-021) ----------

/** All attributes, archived ones included, so old values stay readable. */
export function listAttributes() {
  return prisma.attribute.findMany({
    orderBy: { name: "asc" },
    include: { options: { orderBy: { label: "asc" } }, _count: { select: { categories: true } } },
  });
}

/** Reads an attribute whether or not it is archived. */
export function getAttribute(id: string) {
  return prisma.attribute.findUnique({ where: { id }, include: { options: true } });
}

const ENUM_TYPES: AttributeType[] = ["enum", "multi_enum"];

export function createAttribute(
  actorId: string,
  input: { key: string; name: string; type: AttributeType; unit?: string | null; options?: string[] },
) {
  return prisma.$transaction(async (tx) => {
    if (await tx.attribute.findUnique({ where: { key: input.key } })) {
      throw new CatalogError(409, "KEY_TAKEN", "An attribute with this key already exists", { key: "Choose another key" });
    }
    const labels = ENUM_TYPES.includes(input.type) ? [...new Set(input.options ?? [])] : [];
    const attribute = await tx.attribute.create({
      data: {
        key: input.key,
        name: input.name,
        type: input.type,
        unit: input.unit || null,
        options: { create: labels.map((label) => ({ value: slugify(label), label })) },
      },
    });
    await audit(tx, actorId, "attribute.created", "attribute", attribute.id, { key: input.key, type: input.type, options: labels });
    return attribute;
  });
}

async function checkNewOption(tx: Tx, attributeId: string, label: string) {
  const attribute = (await tx.attribute.findUnique({ where: { id: attributeId } })) ?? notFound("Attribute");
  if (!ENUM_TYPES.includes(attribute.type)) throw new CatalogError(422, "NOT_ENUM", "Only enum attributes have options");
  if (attribute.archivedAt) throw new CatalogError(422, "ATTRIBUTE_ARCHIVED", "This attribute is archived");
  const value = slugify(label);
  if (!value) throw new CatalogError(422, "INVALID_OPTION", "Enter an option name", { label: "Required" });
  if (await tx.attributeOption.findUnique({ where: { attributeId_value: { attributeId, value } } })) {
    throw new CatalogError(409, "OPTION_EXISTS", "This option already exists (or is pending)");
  }
  return value;
}

export function addAttributeOption(actorId: string, attributeId: string, label: string) {
  return prisma.$transaction(async (tx) => {
    const value = await checkNewOption(tx, attributeId, label);
    const option = await tx.attributeOption.create({ data: { attributeId, value, label } });
    await audit(tx, actorId, "attribute_option.created", "attribute", attributeId, { value, label });
    return option;
  });
}

export function approveAttributeOption(actorId: string, optionId: string) {
  return prisma.$transaction(async (tx) => {
    const option = await tx.attributeOption.update({ where: { id: optionId }, data: { status: "active" } });
    await audit(tx, actorId, "attribute_option.approved", "attribute", option.attributeId, { value: option.value });
    return option;
  });
}

export function archiveAttribute(actorId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const attribute = await tx.attribute.update({ where: { id }, data: { archivedAt: new Date() } });
    await audit(tx, actorId, "attribute.archived", "attribute", id, { key: attribute.key });
    return attribute;
  });
}

export interface AssignmentInput {
  attributeId: string;
  required: boolean;
  filterable: boolean;
  filterWidget: FilterWidget | null;
  displayOrder: number;
  isVariantAxis: boolean;
}

export function assignAttribute(actorId: string, categoryId: string, input: AssignmentInput) {
  return prisma.$transaction(async (tx) => {
    const category = (await tx.category.findUnique({ where: { id: categoryId } })) ?? notFound("Category");
    if (!category.isLeaf || category.archivedAt) {
      throw new CatalogError(422, "CATEGORY_NOT_LEAF", "Attributes can only be assigned to active leaf categories");
    }
    if (category.isOther) throw new CatalogError(422, "OTHER_LEAF", "\"Other\" leaves have only the common fields");
    const attribute = (await tx.attribute.findUnique({ where: { id: input.attributeId } })) ?? notFound("Attribute");
    if (attribute.archivedAt) throw new CatalogError(422, "ATTRIBUTE_ARCHIVED", "This attribute is archived");

    const { attributeId, ...settings } = input;
    await tx.categoryAttribute.upsert({
      where: { categoryId_attributeId: { categoryId, attributeId } },
      create: { categoryId, ...input },
      update: settings,
    });
    await audit(tx, actorId, "category_attribute.assigned", "category", categoryId, { key: attribute.key, ...settings });
  });
}

export function unassignAttribute(actorId: string, categoryId: string, attributeId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.categoryAttribute.delete({ where: { categoryId_attributeId: { categoryId, attributeId } } });
    await audit(tx, actorId, "category_attribute.unassigned", "category", categoryId, { attributeId });
  });
}

// ---------- Effective schema (US-023) ----------

export async function getCategorySchema(id: string): Promise<CategorySchema> {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { attributes: { include: { attribute: { include: { options: { orderBy: { label: "asc" } } } } } } },
  });
  if (!category) notFound("Category");
  return buildEffectiveSchema({ category, assignments: category.attributes });
}

// ---------- Category requests (US-022) ----------

export type NewCategoryRequest =
  | { kind: "category"; shopId: string; parentId: string; name: string; reason?: string }
  | { kind: "enum_option"; shopId: string; attributeId: string; name: string; reason?: string };

/** A seller asks for a category or an enum option. Enum options are created as pending. */
export function createCategoryRequest(userId: string, input: NewCategoryRequest) {
  return prisma.$transaction(async (tx) => {
    const dueAt = new Date(Date.now() + REQUEST_ANSWER_HOURS * 3600_000);
    let optionId: string | null = null;
    if (input.kind === "category") {
      const parent = (await tx.category.findUnique({ where: { id: input.parentId } })) ?? notFound("Parent category");
      if (parent.isOther || parent.archivedAt) {
        throw new CatalogError(422, "INVALID_PARENT", "Choose an active parent category (not \"Other\")");
      }
    } else {
      const value = await checkNewOption(tx, input.attributeId, input.name);
      optionId = (await tx.attributeOption.create({
        data: { attributeId: input.attributeId, value, label: input.name, status: "pending" },
      })).id;
    }
    const request = await tx.categoryRequest.create({
      data: {
        kind: input.kind,
        requestedByUserId: userId,
        shopId: input.shopId,
        parentId: input.kind === "category" ? input.parentId : null,
        attributeId: input.kind === "enum_option" ? input.attributeId : null,
        optionId,
        name: input.name,
        reason: input.reason || null,
        dueAt,
      },
    });
    await audit(tx, userId, "category_request.created", "category_request", request.id, { kind: input.kind, name: input.name });
    return request;
  });
}

export function listCategoryRequests() {
  return prisma.categoryRequest.findMany({
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    include: {
      requestedBy: { select: { name: true, email: true, phone: true } },
      parent: { select: { name: true } },
      attribute: { select: { name: true } },
    },
  });
}

export function decideCategoryRequest(actorId: string, requestId: string, approve: boolean, note?: string) {
  return prisma.$transaction(async (tx) => {
    const request = (await tx.categoryRequest.findUnique({ where: { id: requestId } })) ?? notFound("Request");
    if (request.status !== "pending") throw new CatalogError(409, "ALREADY_DECIDED", "This request was already answered");

    let createdCategoryId: string | null = null;
    if (request.kind === "category" && approve) {
      createdCategoryId = (await createCategoryTx(tx, actorId, { name: request.name, parentId: request.parentId })).id;
    } else if (request.kind === "enum_option" && request.optionId) {
      if (approve) await tx.attributeOption.update({ where: { id: request.optionId }, data: { status: "active" } });
      // A rejected option was never active, so it is removed to free the value.
      else await tx.attributeOption.delete({ where: { id: request.optionId } });
    }

    await tx.categoryRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? "approved" : "rejected",
        decidedById: actorId,
        decidedAt: new Date(),
        decisionNote: note || null,
      },
    });
    await audit(tx, actorId, approve ? "category_request.approved" : "category_request.rejected", "category_request", requestId, {
      kind: request.kind,
      name: request.name,
      createdCategoryId,
      note: note || null,
    });
  });
}
