import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShopRole } from "@/generated/prisma/client";
import { CatalogError, type CategorySchema } from "@/features/catalog";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { createShopGuard } from "@/lib/auth/shop-guard-core";
import { ProductError } from "./errors";
import type { ListingShop } from "./rules";
import { createProductService, type ImageStorage, type ProductRepo } from "./service";
import {
  NOW,
  nonLeafSchema,
  painReliefSchema,
  processorSchema,
  shirtSchema,
  validMedicine,
  validProcessor,
  validShirt,
} from "./test-fixtures";
import type { ProductInput } from "./validation";

// Shop A (electronics, Basic), shop B (books), shop M (medicine, verified licence).
// staffA is staff of A, staffB of B, staffM of M.
const memberships: Record<string, ShopRole> = { "A:staffA": "staff", "A:ownerA": "owner", "B:staffB": "staff", "M:staffM": "staff" };
let sessionUserId: string | null;

const schemas: Record<string, () => CategorySchema> = {
  "cat-processor": processorSchema,
  "cat-shirts": shirtSchema,
  "cat-pain": painReliefSchema,
  "cat-components": nonLeafSchema,
};

const shop = (id: string, overrides: Partial<ListingShop> = {}): ListingShop => ({
  id,
  status: "approved",
  type: "electronics",
  tier: "verified",
  medicineSuspended: false,
  licences: [],
  ...overrides,
});

interface StoredProduct {
  id: string;
  shopId: string;
  categoryId: string;
  status: "active" | "inactive";
  expiresOn: Date | null;
  input: ProductInput;
  images: { id: string; storageKey: string }[];
}

let shops: Record<string, ListingShop>;
let products: StoredProduct[];
let liveCounts: Record<string, number>;
let takenSkus: Record<string, string[]>;
let stored: Map<string, Uint8Array>;
let storageUp: boolean;
let repo: ProductRepo;

function makeRepo(): ProductRepo {
  const find = (shopId: string, productId: string) => products.find((p) => p.id === productId && p.shopId === shopId) ?? null;
  return {
    getListingShop: async (shopId) => shops[shopId] ?? null,
    getProduct: async (shopId, productId) => {
      const p = find(shopId, productId);
      if (!p) return null;
      const schema = schemas[p.categoryId]();
      return { ...p, category: { name: schema.name, requiresLicence: schema.requiresLicence } };
    },
    countLiveListings: async (shopId) => liveCounts[shopId] ?? 0,
    findTakenSkus: async (shopId, skus) => skus.filter((s) => takenSkus[shopId]?.includes(s)),
    createProduct: vi.fn(async (shopId, categoryId, input) => {
      const p = { id: `p${products.length + 1}`, shopId, categoryId, status: "active" as const, expiresOn: input.expiresOn, input, images: [] };
      products.push(p);
      return p;
    }),
    createProducts: vi.fn(async (shopId, categoryId, inputs) =>
      inputs.map((input: ProductInput, i: number) => ({ id: `csv${i + 1}`, shopId, categoryId, input })),
    ),
    updateProduct: vi.fn(async () => undefined),
    setStatus: vi.fn(async () => undefined),
    softDeleteProduct: vi.fn(async () => undefined),
    updateVariantStock: vi.fn(async () => undefined),
    addImage: vi.fn(async (shopId, productId, image) => {
      const p = find(shopId, productId)!;
      const row = { id: `img${p.images.length + 1}`, storageKey: image.storageKey };
      p.images.push(row);
      return row;
    }),
    deleteImage: vi.fn(async (shopId, productId, imageId) => {
      const img = find(shopId, productId)?.images.find((i) => i.id === imageId);
      if (!img) throw new ProductError(404, "NOT_FOUND", "Image not found");
      return img;
    }),
    makeCoverImage: vi.fn(async () => undefined),
    publicFindImage: async (imageId) => products.flatMap((p) => p.images).find((i) => i.id === imageId) ?? null,
  };
}

const storage: ImageStorage = {
  putObject: async (key, body) => {
    if (!storageUp) throw new Error("fetch failed");
    stored.set(key, body);
  },
  deleteObject: async (key) => {
    stored.delete(key);
  },
  getSignedUrl: async (key) => {
    if (!storageUp) throw new Error("fetch failed");
    return `https://s3.test/${key}?X-Amz-Signature=x`;
  },
};

function service() {
  return createProductService({
    requireShopRole: createShopGuard({
      requireUser: async () => {
        if (!sessionUserId) throw new UnauthorizedError();
        return { id: sessionUserId, email: null, phone: null, name: null, isPlatformAdmin: false, status: "active" };
      },
      findShopRole: async (shopId, userId) => memberships[`${shopId}:${userId}`] ?? null,
    }),
    getCategorySchema: async (id) => {
      const build = schemas[id];
      if (!build) throw new CatalogError(404, "NOT_FOUND", "Category not found");
      return build();
    },
    repo,
    storage: () => storage,
    now: () => NOW,
    newKey: () => "uuid-1",
    onProductsChanged: (ids) => changes.push(ids),
  });
}

let changes: string[][] = [];

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const caught = (p: Promise<unknown>) => p.then(() => null, (e) => e);

beforeEach(() => {
  sessionUserId = "staffA";
  shops = {
    A: shop("A", { tier: "basic" }),
    B: shop("B", { type: "books" }),
    M: shop("M", { type: "medicine", licences: [{ status: "verified", expiryDate: new Date("2027-12-31T00:00:00Z") }] }),
  };
  products = [];
  liveCounts = {};
  takenSkus = {};
  stored = new Map();
  storageUp = true;
  repo = makeRepo();
  changes = [];
});

describe("create product (US-030 acceptance criteria)", () => {
  it("shop staff create a listing in a leaf category", async () => {
    await expect(service().createProduct("A", validProcessor())).resolves.toEqual({ id: "p1" });
    expect(repo.createProduct).toHaveBeenCalledWith("A", "cat-processor", expect.objectContaining({ title: "AMD Ryzen 5 7600 Processor" }), "staffA", expect.any(Date));
  });

  it("a required attribute left empty blocks the save with a field error", async () => {
    const body = validProcessor();
    delete (body.attributes as Record<string, unknown>).socket;
    const err = await caught(service().createProduct("A", body));
    expect(err).toBeInstanceOf(ProductError);
    expect(err).toMatchObject({ status: 422, fields: { "attributes.socket": "Socket is required" } });
    expect(repo.createProduct).not.toHaveBeenCalled();
  });

  it("an attribute that does not belong to Processor, sent through the API, is rejected with a 422 naming it", async () => {
    const body = validProcessor();
    (body.attributes as Record<string, unknown>).author = "Humayun Ahmed";
    const err = await caught(service().createProduct("A", body));
    expect(err).toMatchObject({ status: 422, message: "author is not an attribute of Processor" });
  });

  it("a non-leaf category is rejected", async () => {
    const err = await caught(service().createProduct("A", validProcessor({ categoryId: "cat-components" })));
    expect(err).toBeInstanceOf(CatalogError);
    expect(err).toMatchObject({ status: 422, code: "CATEGORY_NOT_LEAF" });
    expect(repo.createProduct).not.toHaveBeenCalled();
  });

  it("staff of shop A creating a product for shop B get a 403", async () => {
    const err = await caught(service().createProduct("B", validProcessor()));
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.status).toBe(403);
    expect(repo.createProduct).not.toHaveBeenCalled();
  });

  it("guests get a 401", async () => {
    sessionUserId = null;
    expect(await caught(service().createProduct("A", validProcessor()))).toBeInstanceOf(UnauthorizedError);
  });

  it("needs a category and an approved shop", async () => {
    expect(await caught(service().createProduct("A", validProcessor({ categoryId: undefined })))).toMatchObject({
      status: 422,
      fields: { categoryId: "Choose a category" },
    });
    expect(await caught(service().createProduct("A", validProcessor({ categoryId: "nope" })))).toMatchObject({ status: 404 });
    shops.A.status = "pending";
    expect(await caught(service().createProduct("A", validProcessor()))).toMatchObject({ status: 409, code: "SHOP_NOT_APPROVED" });
  });

  it("rejects a SKU another product of the shop already uses", async () => {
    takenSkus.A = ["R5-7600"];
    expect(await caught(service().createProduct("A", validProcessor()))).toMatchObject({
      status: 422,
      fields: { "variants.0.sku": "This SKU is already used by another product in your shop" },
    });
  });

  it("creates size/colour variants (US-031)", async () => {
    sessionUserId = "staffB";
    await service().createProduct("B", validShirt());
    const input = vi.mocked(repo.createProduct).mock.calls[0][2];
    expect(input.variants.map((v) => v.optionKey)).toEqual(["colour=black;size=m", "colour=black;size=l"]);
  });
});

describe("medicine rules (US-015 / US-016)", () => {
  it("a medicine shop with a verified licence lists medicine with a future expiry", async () => {
    sessionUserId = "staffM";
    await expect(service().createProduct("M", validMedicine())).resolves.toEqual({ id: "p1" });
  });

  it("a non-medicine shop can't list in a medicine category", async () => {
    const err = await caught(service().createProduct("A", validMedicine()));
    expect(err).toMatchObject({ status: 403, code: "LICENCE_REQUIRED" });
  });

  it("a pending medicine shop is rejected until the admin verifies the licence and approves it", async () => {
    sessionUserId = "staffM";
    shops.M = shop("M", { type: "medicine", status: "pending", licences: [{ status: "pending", expiryDate: new Date("2027-12-31") }] });
    expect(await caught(service().createProduct("M", validMedicine()))).toMatchObject({ status: 409, code: "SHOP_NOT_APPROVED" });
  });

  it("an expired licence or suspended medicine selling blocks medicine listings", async () => {
    sessionUserId = "staffM";
    shops.M.licences = [{ status: "verified", expiryDate: new Date("2026-10-15T00:00:00Z") }];
    expect(await caught(service().createProduct("M", validMedicine()))).toMatchObject({ status: 403, code: "LICENCE_REQUIRED" });
    shops.M.licences = [{ status: "verified", expiryDate: new Date("2027-12-31T00:00:00Z") }];
    shops.M.medicineSuspended = true;
    expect(await caught(service().createProduct("M", validMedicine()))).toMatchObject({ status: 403, code: "LICENCE_REQUIRED" });
  });

  it("an expired product can't be listed", async () => {
    sessionUserId = "staffM";
    const body = validMedicine();
    (body.attributes as Record<string, unknown>).expiry_date = "2026-10-01";
    expect(await caught(service().createProduct("M", body))).toMatchObject({
      status: 422,
      fields: { "attributes.expiry_date": "This date has passed: expired goods may not be sold" },
    });
  });
});

describe("tier limit (Basic: 100 live listings)", () => {
  it("blocks the 101st live listing of a Basic shop", async () => {
    liveCounts.A = 99;
    await expect(service().createProduct("A", validProcessor())).resolves.toBeDefined();
    liveCounts.A = 100;
    expect(await caught(service().createProduct("A", validProcessor()))).toMatchObject({ status: 409, code: "TIER_LIMIT" });
  });

  it("does not limit Verified shops", async () => {
    sessionUserId = "staffB";
    liveCounts.B = 5000;
    await expect(service().createProduct("B", validShirt())).resolves.toBeDefined();
  });

  it("is checked again when a listing is re-activated", async () => {
    products.push({ id: "p9", shopId: "A", categoryId: "cat-processor", status: "inactive", expiresOn: null, input: {} as ProductInput, images: [] });
    liveCounts.A = 100;
    expect(await caught(service().changeStatus("A", "p9", { status: "active" }))).toMatchObject({ code: "TIER_LIMIT" });
    liveCounts.A = 99;
    await service().changeStatus("A", "p9", { status: "active" });
    expect(repo.setStatus).toHaveBeenCalledWith("A", "p9", "active", "staffA", expect.any(Date));
  });
});

describe("edit, status, delete, stock (US-033)", () => {
  beforeEach(() => {
    products.push({ id: "p1", shopId: "A", categoryId: "cat-processor", status: "active", expiresOn: null, input: {} as ProductInput, images: [] });
  });

  it("updates a product of the shop; the category can't change", async () => {
    await service().updateProduct("A", "p1", validProcessor({ title: "New title" }));
    expect(repo.updateProduct).toHaveBeenCalledWith("A", "p1", expect.objectContaining({ title: "New title" }), "staffA", expect.any(Date));
    expect(await caught(service().updateProduct("A", "p1", validProcessor({ categoryId: "cat-shirts" })))).toMatchObject({
      status: 422,
      fields: { categoryId: "The category can't be changed after the product is created" },
    });
  });

  it("another shop's staff can't edit, deactivate, delete or restock it", async () => {
    sessionUserId = "staffB";
    for (const call of [
      () => service().updateProduct("A", "p1", validProcessor()),
      () => service().changeStatus("A", "p1", { status: "inactive" }),
      () => service().deleteProduct("A", "p1"),
      () => service().updateStock("A", "p1", "v1", { stock: 3 }),
    ]) {
      expect(await caught(call())).toBeInstanceOf(ForbiddenError);
    }
    // Using their own shop id finds nothing: the product is scoped to shop A.
    expect(await caught(service().updateProduct("B", "p1", validProcessor()))).toMatchObject({ status: 404 });
  });

  it("deactivates, validates the status and refuses to activate an expired product", async () => {
    await service().changeStatus("A", "p1", { status: "inactive" });
    expect(repo.setStatus).toHaveBeenCalledWith("A", "p1", "inactive", "staffA", expect.any(Date));
    expect(await caught(service().changeStatus("A", "p1", { status: "gone" }))).toMatchObject({ status: 422 });
    products[0].status = "inactive";
    products[0].expiresOn = new Date("2026-01-01T00:00:00Z");
    expect(await caught(service().changeStatus("A", "p1", { status: "active" }))).toMatchObject({ status: 409, code: "EXPIRED" });
  });

  it("soft-deletes and updates stock", async () => {
    await service().deleteProduct("A", "p1");
    expect(repo.softDeleteProduct).toHaveBeenCalledWith("A", "p1", "staffA", expect.any(Date));
    await service().updateStock("A", "p1", "v1", { stock: "7" });
    expect(repo.updateVariantStock).toHaveBeenCalledWith("A", "p1", "v1", 7, "staffA");
    expect(await caught(service().updateStock("A", "p1", "v1", { stock: -1 }))).toMatchObject({
      status: 422,
      fields: { stock: "Stock can't be negative" },
    });
  });
});

describe("images (US-032)", () => {
  beforeEach(() => {
    products.push({ id: "p1", shopId: "A", categoryId: "cat-processor", status: "active", expiresOn: null, input: {} as ProductInput, images: [] });
  });
  const file = (bytes: Uint8Array, size = bytes.length) => ({ name: "photo.png", size, bytes });

  it("stores a PNG at products/<shopId>/<productId>/<uuid>.png", async () => {
    await expect(service().uploadImage("A", "p1", file(PNG))).resolves.toEqual({ id: "img1", storageKey: "products/A/p1/uuid-1.png" });
    expect([...stored.keys()]).toEqual(["products/A/p1/uuid-1.png"]);
  });

  it("checks the real file type, the 5 MB size and the 8-image limit", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7");
    expect(await caught(service().uploadImage("A", "p1", file(pdf)))).toMatchObject({ status: 415, fields: { file: "Use a JPEG, PNG or WebP image" } });
    expect(await caught(service().uploadImage("A", "p1", file(PNG, 6 * 1024 * 1024)))).toMatchObject({ status: 413 });
    products[0].images = Array.from({ length: 8 }, (_, i) => ({ id: `i${i}`, storageKey: "k" }));
    expect(await caught(service().uploadImage("A", "p1", file(PNG)))).toMatchObject({ status: 409, code: "TOO_MANY_IMAGES" });
  });

  it("returns a clear 503 when storage is down", async () => {
    storageUp = false;
    expect(await caught(service().uploadImage("A", "p1", file(PNG)))).toMatchObject({ status: 503, code: "STORAGE_UNAVAILABLE" });
    expect(repo.addImage).not.toHaveBeenCalled();
  });

  it("deletes the image row and the stored object", async () => {
    await service().uploadImage("A", "p1", file(PNG));
    await service().deleteImage("A", "p1", "img1");
    expect(stored.size).toBe(0);
  });

  it("serves an image through a short-lived signed URL", async () => {
    await service().uploadImage("A", "p1", file(PNG));
    await expect(service().imageUrl("img1")).resolves.toContain("X-Amz-Signature");
    expect(await caught(service().imageUrl("missing"))).toMatchObject({ status: 404 });
  });

  it("another shop's staff can't upload or delete images", async () => {
    sessionUserId = "staffB";
    expect(await caught(service().uploadImage("A", "p1", file(PNG)))).toBeInstanceOf(ForbiddenError);
    expect(await caught(service().deleteImage("A", "p1", "img1"))).toBeInstanceOf(ForbiddenError);
  });
});

describe("CSV import (US-034)", () => {
  const header = "handle,title,description,sku,price,stock,brand,socket,core_count,base_clock_ghz,quantity,quantity_unit,weight_g,country_of_origin,return_eligibility";
  const row = (sku: string, socket = "AM5") => `,Ryzen ${sku},Desktop CPU,${sku},24500,4,AMD,${socket},6,3.8,1,pcs,300,China,eligible`;
  const upload = (text: string) => ({ size: text.length, text });

  it("imports every row in one go", async () => {
    await expect(service().importCsv("A", "cat-processor", upload([header, row("R1"), row("R2")].join("\n")))).resolves.toEqual({
      created: 2,
      ids: ["csv1", "csv2"],
    });
    expect(vi.mocked(repo.createProducts).mock.calls[0][2]).toHaveLength(2);
  });

  it("imports nothing when any row has an error and returns every error", async () => {
    const err = await caught(service().importCsv("A", "cat-processor", upload([header, row("R1", "AM9"), row("R2"), row("R3", "LGA0")].join("\n"))));
    expect(err).toMatchObject({ status: 422, code: "IMPORT_INVALID" });
    expect(err.rows).toEqual([
      { row: 2, column: "socket", message: '"AM9" is not an allowed Socket option' },
      { row: 4, column: "socket", message: '"LGA0" is not an allowed Socket option' },
    ]);
    expect(repo.createProducts).not.toHaveBeenCalled();
  });

  it("reports SKUs already used in the shop by line", async () => {
    takenSkus.A = ["R2"];
    const err = await caught(service().importCsv("A", "cat-processor", upload([header, row("R1"), row("R2")].join("\n"))));
    expect(err.rows).toEqual([{ row: 3, column: "sku", message: 'SKU "R2" is already used by another product in your shop' }]);
  });

  it("respects the tier limit for the whole file", async () => {
    liveCounts.A = 99;
    const err = await caught(service().importCsv("A", "cat-processor", upload([header, row("R1"), row("R2")].join("\n"))));
    expect(err).toMatchObject({ status: 409, code: "TIER_LIMIT" });
  });

  it("limits the file to 1 MB and 500 rows, and reports CSV syntax errors", async () => {
    expect(await caught(service().importCsv("A", "cat-processor", { size: 2 * 1024 * 1024, text: "" }))).toMatchObject({ status: 413 });
    const many = [header, ...Array.from({ length: 501 }, (_, i) => row(`R${i}`))].join("\n");
    expect(await caught(service().importCsv("A", "cat-processor", upload(many)))).toMatchObject({ status: 422, code: "TOO_MANY_ROWS" });
    const bad = await caught(service().importCsv("A", "cat-processor", upload(`${header}\n"unclosed`)));
    expect(bad.rows).toEqual([{ row: 2, message: "Line 2: a quoted field is not closed" }]);
  });

  it("applies the listing rules (medicine) and the shop guard", async () => {
    expect(await caught(service().importCsv("A", "cat-pain", upload(header)))).toMatchObject({ status: 403, code: "LICENCE_REQUIRED" });
    sessionUserId = "staffB";
    expect(await caught(service().importCsv("A", "cat-processor", upload(header)))).toBeInstanceOf(ForbiddenError);
  });

  it("serves a template named after the category", async () => {
    const { filename, csv } = await service().importTemplate("A", "cat-processor");
    expect(filename).toBe("products-processor.csv");
    expect(csv).toContain("handle,title,description,sku,price,stock,brand,socket");
  });
});

describe("search re-index hook", () => {
  it("reports the changed product after each successful write, and nothing when the write is refused", async () => {
    const { id } = await service().createProduct("A", validProcessor());
    expect(changes).toEqual([[id]]);
    await caught(service().createProduct("B", validProcessor()));
    expect(changes).toHaveLength(1);
    await service().deleteProduct("A", id);
    expect(changes).toEqual([[id], [id]]);
  });

  it("a failing hook never fails the write", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const svc = createProductService({
      requireShopRole: async () => ({ shopId: "A", role: "staff", user: { id: "staffA" } }) as never,
      getCategorySchema: async () => { throw new Error("unused"); },
      repo,
      storage: () => storage,
      now: () => NOW,
      onProductsChanged: () => { throw new Error("queue down"); },
    });
    await expect(svc.deleteProduct("A", "p9")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
