import type { Prisma, ProductStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { notFound, ProductError, validationError } from "./errors";
import { MAX_IMAGES } from "./images";
import { liveProductWhere } from "./live";
import type { ProductInput } from "./validation";

/**
 * Products data access (ADR-004). Every shop-side function takes the guard-checked `shopId`
 * first and filters by it. Every write is audited in the same transaction and recounts the
 * leaf's live listings. `public*` functions are unscoped and only return customer-safe data.
 */

type Tx = Prisma.TransactionClient;

function audit(tx: Tx, actorId: string, action: string, productId: string, data?: Prisma.InputJsonValue) {
  return tx.auditLog.create({ data: { actorId, action, entity: "product", entityId: productId, data } });
}

/** Recounts a leaf's live listings (Category.liveProductCount). */
export async function recountCategory(tx: Tx, categoryId: string, today: Date) {
  const count = await tx.product.count({ where: { ...liveProductWhere(today), categoryId } });
  await tx.category.update({ where: { id: categoryId }, data: { liveProductCount: count } });
}

const variantOrder = { orderBy: { position: "asc" } } as const;

// ---- Reads (shop-scoped) ----------------------------------------------------

/** The shop and its licences, for the listing rules. */
export async function getListingShop(shopId: string) {
  const [shop, licences] = await Promise.all([
    prisma.shop.findFirst({ where: { id: shopId } }),
    prisma.shopLicence.findMany({ where: { shopId }, select: { status: true, expiryDate: true } }),
  ]);
  return shop ? { ...shop, licences } : null;
}

export function listProducts(shopId: string) {
  return prisma.product.findMany({
    where: { shopId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true, requiresLicence: true } },
      variants: { ...variantOrder, select: { price: true, stock: true } },
      shop: { select: { status: true, medicineSuspended: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function getProduct(shopId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, shopId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true, requiresLicence: true } },
      variants: variantOrder,
      images: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      shop: { select: { status: true, medicineSuspended: true } },
    },
  });
}

/** Live listings of this shop (tier limit), optionally leaving one product out. */
export function countLiveListings(shopId: string, today: Date, excludeProductId?: string) {
  return prisma.product.count({
    where: { ...liveProductWhere(today), shopId, ...(excludeProductId ? { id: { not: excludeProductId } } : {}) },
  });
}

/** SKUs already used by this shop's other products. */
export async function findTakenSkus(shopId: string, skus: string[], excludeProductId?: string): Promise<string[]> {
  if (skus.length === 0) return [];
  const rows = await prisma.productVariant.findMany({
    where: { shopId, sku: { in: skus }, ...(excludeProductId ? { productId: { not: excludeProductId } } : {}) },
    select: { sku: true },
  });
  return rows.map((r) => r.sku!).filter(Boolean);
}

// ---- Writes (shop-scoped) ---------------------------------------------------

async function insertProduct(tx: Tx, shopId: string, categoryId: string, input: ProductInput, actorId: string, source: string) {
  const product = await tx.product.create({
    data: {
      shopId,
      categoryId,
      title: input.title,
      description: input.description,
      attributes: input.attributes as Prisma.InputJsonValue,
      expiresOn: input.expiresOn,
      status: "active",
      createdById: actorId,
    },
  });
  await tx.productVariant.createMany({
    data: input.variants.map((v) => ({
      productId: product.id,
      shopId,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      options: v.options as Prisma.InputJsonValue,
      optionKey: v.optionKey,
      position: v.position,
    })),
  });
  await audit(tx, actorId, "product.created", product.id, { shopId, categoryId, title: input.title, variants: input.variants.length, source });
  return product;
}

export function createProduct(shopId: string, categoryId: string, input: ProductInput, actorId: string, today: Date) {
  return prisma.$transaction(async (tx) => {
    const product = await insertProduct(tx, shopId, categoryId, input, actorId, "form");
    await recountCategory(tx, categoryId, today);
    return product;
  });
}

/** CSV import (US-034): all products in one transaction, or none. */
export function createProducts(shopId: string, categoryId: string, inputs: ProductInput[], actorId: string, today: Date) {
  return prisma.$transaction(
    async (tx) => {
      const created = [];
      for (const input of inputs) created.push(await insertProduct(tx, shopId, categoryId, input, actorId, "csv"));
      await recountCategory(tx, categoryId, today);
      return created;
    },
    { timeout: 60_000 },
  );
}

/**
 * US-033: updates title, description, attributes and variants. Variants are matched by id within
 * this product; variants left out are deleted, ones without an id are created.
 */
export function updateProduct(shopId: string, productId: string, input: ProductInput, actorId: string, today: Date) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, shopId, deletedAt: null } });
    if (!product) throw notFound();
    const existing = await tx.productVariant.findMany({ where: { productId, shopId } });
    const existingIds = new Set(existing.map((v) => v.id));
    const badIds: Record<string, string> = {};
    input.variants.forEach((v, i) => {
      if (v.id && !existingIds.has(v.id)) badIds[`variants.${i}.id`] = "This variant does not belong to the product";
    });
    if (Object.keys(badIds).length) throw validationError(badIds);

    const keptIds = new Set(input.variants.flatMap((v) => (v.id ? [v.id] : [])));
    const removed = existing.filter((v) => !keptIds.has(v.id)).map((v) => v.id);
    if (removed.length) await tx.productVariant.deleteMany({ where: { productId, shopId, id: { in: removed } } });
    // Park kept variants first so swapping options or SKUs between them can't hit the unique keys.
    for (const id of keptIds) {
      await tx.productVariant.updateMany({ where: { id, productId, shopId }, data: { sku: null, optionKey: `~${id}` } });
    }
    const added = [];
    for (const v of input.variants) {
      const data = {
        sku: v.sku,
        price: v.price,
        stock: v.stock,
        options: v.options as Prisma.InputJsonValue,
        optionKey: v.optionKey,
        position: v.position,
      };
      if (v.id) await tx.productVariant.updateMany({ where: { id: v.id, productId, shopId }, data });
      else added.push({ ...data, productId, shopId });
    }
    if (added.length) await tx.productVariant.createMany({ data: added });

    await tx.product.updateMany({
      where: { id: productId, shopId },
      data: {
        title: input.title,
        description: input.description,
        attributes: input.attributes as Prisma.InputJsonValue,
        expiresOn: input.expiresOn,
      },
    });
    await audit(tx, actorId, "product.updated", productId, {
      shopId,
      title: input.title,
      variantsAdded: added.length,
      variantsRemoved: removed.length,
    });
    await recountCategory(tx, product.categoryId, today);
  });
}

export function setStatus(shopId: string, productId: string, status: ProductStatus, actorId: string, today: Date) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, shopId, deletedAt: null } });
    if (!product) throw notFound();
    await tx.product.updateMany({ where: { id: productId, shopId }, data: { status } });
    await audit(tx, actorId, status === "active" ? "product.activated" : "product.deactivated", productId, { shopId });
    await recountCategory(tx, product.categoryId, today);
  });
}

/**
 * Soft delete: the row is kept (6-year records) but hidden everywhere. The variants' SKUs are
 * freed for reuse and kept in the audit entry.
 */
export function softDeleteProduct(shopId: string, productId: string, actorId: string, today: Date) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, shopId, deletedAt: null } });
    if (!product) throw notFound();
    const variants = await tx.productVariant.findMany({ where: { productId, shopId } });
    await tx.product.updateMany({ where: { id: productId, shopId }, data: { deletedAt: new Date(), status: "inactive" } });
    await tx.productVariant.updateMany({ where: { productId, shopId }, data: { sku: null } });
    await audit(tx, actorId, "product.deleted", productId, {
      shopId,
      title: product.title,
      skus: variants.flatMap((v) => (v.sku ? [v.sku] : [])),
    });
    await recountCategory(tx, product.categoryId, today);
  });
}

export function updateVariantStock(shopId: string, productId: string, variantId: string, stock: number, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: variantId, productId, shopId, product: { deletedAt: null } },
    });
    if (!variant) throw notFound("Variant");
    await tx.productVariant.updateMany({ where: { id: variantId, productId, shopId }, data: { stock } });
    await audit(tx, actorId, "product.stock_updated", productId, { shopId, variantId, from: variant.stock, to: stock });
  });
}

// ---- Images (US-032) --------------------------------------------------------

export function countImages(shopId: string, productId: string) {
  return prisma.productImage.count({ where: { shopId, productId } });
}

export function addImage(shopId: string, productId: string, image: { storageKey: string; contentType: string }, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, shopId, deletedAt: null } });
    if (!product) throw notFound();
    const images = await tx.productImage.findMany({ where: { productId, shopId } });
    if (images.length >= MAX_IMAGES) {
      throw new ProductError(409, "TOO_MANY_IMAGES", `A product can have at most ${MAX_IMAGES} images`);
    }
    const position = images.reduce((max, i) => Math.max(max, i.position + 1), 0);
    const created = await tx.productImage.create({ data: { productId, shopId, ...image, position } });
    await audit(tx, actorId, "product.image_added", productId, { shopId, imageId: created.id });
    return created;
  });
}

/** Deletes the image row and returns it (the caller removes the stored object). */
export function deleteImage(shopId: string, productId: string, imageId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const image = await tx.productImage.findFirst({ where: { id: imageId, productId, shopId } });
    if (!image) throw notFound("Image");
    await tx.productImage.deleteMany({ where: { id: imageId, productId, shopId } });
    await audit(tx, actorId, "product.image_deleted", productId, { shopId, imageId });
    return image;
  });
}

/** Makes this image the cover (lowest position). */
export function makeCoverImage(shopId: string, productId: string, imageId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const images = await tx.productImage.findMany({ where: { productId, shopId, product: { deletedAt: null } } });
    if (!images.some((i) => i.id === imageId)) throw notFound("Image");
    const first = images.reduce((min, i) => Math.min(min, i.position), Infinity);
    await tx.productImage.updateMany({ where: { id: imageId, productId, shopId }, data: { position: first - 1 } });
    await audit(tx, actorId, "product.cover_changed", productId, { shopId, imageId });
  });
}

// ---- Public (unscoped, customer-safe) ---------------------------------------

/** An image of a product that is not deleted, for the signed-URL redirect. */
export function publicFindImage(imageId: string) {
  return prisma.productImage.findFirst({
    where: { id: imageId, product: { deletedAt: null } },
    select: { id: true, storageKey: true },
  });
}
