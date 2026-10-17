import { randomUUID } from "node:crypto";
import type { ProductStatus, ShopRole } from "@/generated/prisma/client";
import type { CategorySchema } from "@/features/catalog";
import { dhakaToday } from "@/features/shops";
import type { ShopAccess } from "@/lib/auth";
import { CsvSyntaxError, csvTemplate, csvToProducts, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseCsv } from "./csv";
import { notFound, ProductError, validationError, type ImportRowError } from "./errors";
import { detectImageType, IMAGE_EXTENSIONS, MAX_IMAGE_BYTES, MAX_IMAGES } from "./images";
import { assertCanList, assertWithinTierLimit, type ListingShop } from "./rules";
import { parseStock, validateProductInput, type ProductInput } from "./validation";

/**
 * Listing use cases (US-030 to US-034) with injected dependencies, so the acceptance criteria are
 * unit-testable without a database. Every function checks the caller first:
 * requireShopRole(shopId, owner or staff), then uses only the checked shopId.
 */

const ROLES: readonly ShopRole[] = ["owner", "staff"];

interface ProductRow {
  id: string;
  categoryId: string;
  status: ProductStatus;
  expiresOn: Date | null;
  category: { name: string; requiresLicence: boolean };
  images: { id: string }[];
}

/** The repository functions the service uses (see repo.ts). */
export interface ProductRepo {
  getListingShop(shopId: string): Promise<ListingShop | null>;
  getProduct(shopId: string, productId: string): Promise<ProductRow | null>;
  countLiveListings(shopId: string, today: Date, excludeProductId?: string): Promise<number>;
  findTakenSkus(shopId: string, skus: string[], excludeProductId?: string): Promise<string[]>;
  createProduct(shopId: string, categoryId: string, input: ProductInput, actorId: string, today: Date): Promise<{ id: string }>;
  createProducts(shopId: string, categoryId: string, inputs: ProductInput[], actorId: string, today: Date): Promise<{ id: string }[]>;
  updateProduct(shopId: string, productId: string, input: ProductInput, actorId: string, today: Date): Promise<void>;
  setStatus(shopId: string, productId: string, status: ProductStatus, actorId: string, today: Date): Promise<void>;
  softDeleteProduct(shopId: string, productId: string, actorId: string, today: Date): Promise<void>;
  updateVariantStock(shopId: string, productId: string, variantId: string, stock: number, actorId: string): Promise<void>;
  addImage(shopId: string, productId: string, image: { storageKey: string; contentType: string }, actorId: string): Promise<{ id: string }>;
  deleteImage(shopId: string, productId: string, imageId: string, actorId: string): Promise<{ storageKey: string }>;
  makeCoverImage(shopId: string, productId: string, imageId: string, actorId: string): Promise<void>;
  publicFindImage(imageId: string): Promise<{ storageKey: string } | null>;
}

export interface ImageStorage {
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
  getSignedUrl(key: string): Promise<string>;
}

export interface ProductServiceDeps {
  requireShopRole: (shopId: string, roles: readonly ShopRole[]) => Promise<ShopAccess>;
  getCategorySchema: (categoryId: string) => Promise<CategorySchema>;
  repo: ProductRepo;
  /** May throw when storage is not configured; the service turns that into a 503. */
  storage: () => ImageStorage;
  now: () => Date;
  newKey?: () => string;
}

export interface UploadedFile {
  name: string;
  size: number;
  bytes: Uint8Array;
}

const storageDown = () =>
  new ProductError(503, "STORAGE_UNAVAILABLE", "Image storage is not available right now. Please try again later.");

const field = (body: unknown, key: string): unknown =>
  typeof body === "object" && body !== null ? (body as Record<string, unknown>)[key] : undefined;

export function createProductService(deps: ProductServiceDeps) {
  const { repo } = deps;
  const clock = () => {
    const now = deps.now();
    return { now, today: dhakaToday(now) };
  };

  async function loadShop(shopId: string) {
    const shop = await repo.getListingShop(shopId);
    if (!shop) throw notFound("Shop");
    return shop;
  }

  async function loadProduct(shopId: string, productId: string) {
    const product = await repo.getProduct(shopId, productId);
    if (!product) throw notFound();
    return product;
  }

  async function assertSkusFree(shopId: string, input: ProductInput, excludeProductId?: string) {
    const skus = input.variants.flatMap((v) => (v.sku ? [v.sku] : []));
    const taken = new Set(await repo.findTakenSkus(shopId, skus, excludeProductId));
    const fields: Record<string, string> = {};
    input.variants.forEach((v, i) => {
      if (v.sku && taken.has(v.sku)) fields[`variants.${i}.sku`] = "This SKU is already used by another product in your shop";
    });
    if (Object.keys(fields).length) throw validationError(fields);
  }

  /** US-030 / US-031: create a listing in one leaf category through its generated form. */
  async function createProduct(shopId: string, body: unknown): Promise<{ id: string }> {
    const { user } = await deps.requireShopRole(shopId, ROLES);
    const categoryId = field(body, "categoryId");
    if (typeof categoryId !== "string" || !categoryId) throw validationError({ categoryId: "Choose a category" });
    const schema = await deps.getCategorySchema(categoryId); // 404 unknown, 422 non-leaf or archived
    const shop = await loadShop(shopId);
    const { now, today } = clock();
    assertCanList(shop, schema, now);
    const input = validateProductInput(schema, body, today);
    await assertSkusFree(shopId, input);
    assertWithinTierLimit(shop.tier, await repo.countLiveListings(shopId, today));
    const product = await repo.createProduct(shopId, categoryId, input, user.id, today);
    return { id: product.id };
  }

  /** US-033: edit title, description, attributes and variants. The category is fixed. */
  async function updateProduct(shopId: string, productId: string, body: unknown): Promise<void> {
    const { user } = await deps.requireShopRole(shopId, ROLES);
    const product = await loadProduct(shopId, productId);
    const categoryId = field(body, "categoryId");
    if (categoryId !== undefined && categoryId !== product.categoryId) {
      throw validationError({ categoryId: "The category can't be changed after the product is created" });
    }
    const schema = await deps.getCategorySchema(product.categoryId);
    const { today } = clock();
    const input = validateProductInput(schema, body, today);
    await assertSkusFree(shopId, input, productId);
    // A new expiry date can bring an expired active listing back to life.
    const wasExpired = !!product.expiresOn && product.expiresOn < today;
    if (product.status === "active" && wasExpired) {
      const shop = await loadShop(shopId);
      assertWithinTierLimit(shop.tier, await repo.countLiveListings(shopId, today, productId));
    }
    await repo.updateProduct(shopId, productId, input, user.id, today);
  }

  /** US-033: deactivate (hidden) or activate again (listing rules and tier limit apply). */
  async function changeStatus(shopId: string, productId: string, body: unknown): Promise<void> {
    const { user } = await deps.requireShopRole(shopId, ROLES);
    const status = field(body, "status");
    if (status !== "active" && status !== "inactive") throw validationError({ status: "Status must be active or inactive" });
    const product = await loadProduct(shopId, productId);
    if (product.status === status) return;
    const { now, today } = clock();
    if (status === "active") {
      const shop = await loadShop(shopId);
      assertCanList(shop, product.category, now);
      if (product.expiresOn && product.expiresOn < today) {
        throw new ProductError(409, "EXPIRED", "This product has expired. Set a new expiry date before activating it.");
      }
      assertWithinTierLimit(shop.tier, await repo.countLiveListings(shopId, today, productId));
    }
    await repo.setStatus(shopId, productId, status, user.id, today);
  }

  /** US-033: soft delete (kept for the 6-year records, hidden everywhere). */
  async function deleteProduct(shopId: string, productId: string): Promise<void> {
    const { user } = await deps.requireShopRole(shopId, ROLES);
    await repo.softDeleteProduct(shopId, productId, user.id, clock().today);
  }

  /** US-033: quick stock update for one variant. */
  async function updateStock(shopId: string, productId: string, variantId: string, body: unknown): Promise<void> {
    const { user } = await deps.requireShopRole(shopId, ROLES);
    const stock = parseStock(field(body, "stock"));
    if ("error" in stock) throw validationError({ stock: stock.error });
    await repo.updateVariantStock(shopId, productId, variantId, stock.stock, user.id);
  }

  // ---- Images (US-032) ----

  async function uploadImage(shopId: string, productId: string, file: UploadedFile | null): Promise<{ id: string }> {
    const { user } = await deps.requireShopRole(shopId, ROLES);
    const product = await loadProduct(shopId, productId);
    if (!file || file.size === 0) throw validationError({ file: "Choose an image to upload" });
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ProductError(413, "FILE_TOO_LARGE", "Images can be at most 5 MB", { file: "Images can be at most 5 MB" });
    }
    const contentType = detectImageType(file.bytes);
    if (!contentType) {
      throw new ProductError(415, "UNSUPPORTED_TYPE", "Use a JPEG, PNG or WebP image", { file: "Use a JPEG, PNG or WebP image" });
    }
    if (product.images.length >= MAX_IMAGES) {
      throw new ProductError(409, "TOO_MANY_IMAGES", `A product can have at most ${MAX_IMAGES} images`);
    }
    const storageKey = `products/${shopId}/${productId}/${(deps.newKey ?? randomUUID)()}.${IMAGE_EXTENSIONS[contentType]}`;
    let storage: ImageStorage;
    try {
      storage = deps.storage();
      await storage.putObject(storageKey, file.bytes, contentType);
    } catch {
      throw storageDown();
    }
    try {
      return await repo.addImage(shopId, productId, { storageKey, contentType }, user.id);
    } catch (err) {
      await storage.deleteObject(storageKey).catch(() => undefined);
      throw err;
    }
  }

  async function deleteImage(shopId: string, productId: string, imageId: string): Promise<void> {
    const { user } = await deps.requireShopRole(shopId, ROLES);
    const image = await repo.deleteImage(shopId, productId, imageId, user.id);
    try {
      await deps.storage().deleteObject(image.storageKey);
    } catch (err) {
      // The row is gone, so the image is no longer served; an orphaned object is harmless.
      console.warn("[products] stored image not deleted", image.storageKey, err instanceof Error ? err.message : err);
    }
  }

  async function makeCover(shopId: string, productId: string, imageId: string): Promise<void> {
    const { user } = await deps.requireShopRole(shopId, ROLES);
    await repo.makeCoverImage(shopId, productId, imageId, user.id);
  }

  /** Public: a short-lived signed URL for an image of a product that is not deleted. */
  async function imageUrl(imageId: string): Promise<string> {
    const image = await repo.publicFindImage(imageId);
    if (!image) throw notFound("Image");
    try {
      return await deps.storage().getSignedUrl(image.storageKey);
    } catch {
      throw storageDown();
    }
  }

  // ---- CSV (US-034) ----

  async function importTemplate(shopId: string, categoryId: string): Promise<{ filename: string; csv: string }> {
    await deps.requireShopRole(shopId, ROLES);
    const schema = await deps.getCategorySchema(categoryId);
    const slug = schema.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "category";
    return { filename: `products-${slug}.csv`, csv: csvTemplate(schema) };
  }

  /** All or nothing: any problem in any row and nothing is imported; every problem is returned. */
  async function importCsv(shopId: string, categoryId: unknown, file: { size: number; text: string } | null) {
    const { user } = await deps.requireShopRole(shopId, ROLES);
    if (typeof categoryId !== "string" || !categoryId) throw validationError({ categoryId: "Choose a category" });
    if (!file || file.size === 0) throw validationError({ file: "Choose a CSV file" });
    if (file.size > MAX_IMPORT_BYTES) {
      throw new ProductError(413, "FILE_TOO_LARGE", "The CSV file can be at most 1 MB", { file: "The CSV file can be at most 1 MB" });
    }
    const schema = await deps.getCategorySchema(categoryId);
    const shop = await loadShop(shopId);
    const { now, today } = clock();
    assertCanList(shop, schema, now);

    const invalid = (rows: ImportRowError[]) =>
      new ProductError(
        422,
        "IMPORT_INVALID",
        `Nothing was imported: ${rows.length} ${rows.length === 1 ? "problem" : "problems"} found. Fix ${rows.length === 1 ? "it" : "them"} and upload the file again.`,
        undefined,
        rows,
      );
    let records;
    try {
      records = parseCsv(file.text);
    } catch (err) {
      if (err instanceof CsvSyntaxError) throw invalid([{ row: err.line, message: err.message }]);
      throw err;
    }
    if (records.length - 1 > MAX_IMPORT_ROWS) {
      throw new ProductError(422, "TOO_MANY_ROWS", `A file can have at most ${MAX_IMPORT_ROWS} rows (it has ${records.length - 1})`);
    }

    const { products, errors } = csvToProducts(schema, records, today);
    if (errors.length) throw invalid(errors);

    const skuRows = new Map<string, number>();
    for (const p of products) p.input.variants.forEach((v, i) => v.sku && skuRows.set(v.sku, p.lines[i]));
    const taken = await repo.findTakenSkus(shopId, [...skuRows.keys()]);
    if (taken.length) {
      throw invalid(
        taken
          .map((sku) => ({ row: skuRows.get(sku)!, column: "sku", message: `SKU "${sku}" is already used by another product in your shop` }))
          .sort((a, b) => a.row - b.row),
      );
    }

    assertWithinTierLimit(shop.tier, await repo.countLiveListings(shopId, today), products.length);
    const created = await repo.createProducts(shopId, categoryId, products.map((p) => p.input), user.id, today);
    return { created: created.length, ids: created.map((p) => p.id) };
  }

  return {
    createProduct,
    updateProduct,
    changeStatus,
    deleteProduct,
    updateStock,
    uploadImage,
    deleteImage,
    makeCover,
    imageUrl,
    importTemplate,
    importCsv,
  };
}

export type ProductService = ReturnType<typeof createProductService>;
