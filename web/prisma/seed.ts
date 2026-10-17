/**
 * Test data only. `npm run seed` (idempotent: safe to run again).
 * Feature agents extend this file with their own seed blocks.
 * All accounts use the password TEST_PASSWORD and @ecom.test emails.
 * Remove all seed data before release (pre-release checklist).
 * Refuses to run when APP_MODE is production or unset (see seed-guard.ts).
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/features/auth/password";
import { slugify } from "../src/features/catalog/tree";
import type { AttributeType, FilterWidget } from "../src/generated/prisma/enums";
import type { Prisma } from "../src/generated/prisma/client";
import { getStorage } from "../src/lib/storage";
import { getCategorySchema } from "../src/features/catalog";
import { refreshLiveCounts } from "../src/features/products/live-counts";
import { validateProductInput } from "../src/features/products/validation";
import { dhakaToday } from "../src/features/shops";
import { assertSeedAllowed } from "./seed-guard";

export const TEST_PASSWORD = "Test@12345";

async function seedUsers() {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const now = new Date();

  const users = [
    {
      email: "admin@ecom.test",
      phone: "+8801700000001",
      name: "[TEST] Platform Admin",
      isPlatformAdmin: true,
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
    },
    {
      email: "customer.verified@ecom.test",
      phone: "+8801700000002",
      name: "[TEST] Customer, verified phone and email",
      // Verified email too: the shops e2e test invites this account as staff, which needs it.
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
    },
    {
      email: "customer.new@ecom.test",
      phone: null,
      name: "[TEST] Customer, new",
    },
    {
      email: "customer.flagged@ecom.test",
      phone: "+8801700000003",
      name: "[TEST] Customer, past refusals",
      phoneVerifiedAt: now,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { ...u, passwordHash },
      create: { ...u, passwordHash },
    });
  }

  // Past COD refusals for the flagged customer. Recorded as audit entries until the
  // orders feature exists; the checkout agent should replace these with refused orders.
  const flagged = await prisma.user.findUniqueOrThrow({ where: { email: "customer.flagged@ecom.test" } });
  await prisma.auditLog.deleteMany({ where: { action: "order.cod_refused", entityId: flagged.id } });
  await prisma.auditLog.createMany({
    data: ["TEST-ORDER-0001", "TEST-ORDER-0002"].map((orderNo) => ({
      action: "order.cod_refused",
      entity: "user",
      entityId: flagged.id,
      data: { orderNo, phone: flagged.phone, seed: true },
    })),
  });

  console.info(`Seeded ${users.length} test users (password: ${TEST_PASSWORD})`);
}

// ---------- Catalog (US-020 to US-024) ----------

type SeedAttr = { key: string; name: string; type: AttributeType; unit?: string; options?: string[] };
// [attribute key, required, filterable, variant axis]
type SeedAssign = [string, boolean, boolean, boolean?];
type SeedCategory = {
  name: string;
  commissionRate?: number;
  requiresLicence?: boolean;
  requiresExpiry?: boolean;
  attributes?: SeedAssign[];
  children?: SeedCategory[];
};

const CATALOG_ATTRIBUTES: SeedAttr[] = [
  {
    key: "brand",
    name: "Brand",
    type: "enum",
    options: [
      "AMD", "Intel", "Corsair", "Kingston", "G.Skill", "ASUS", "MSI", "Gigabyte", "ASRock",
      "Yellow", "Ecstasy", "Aarong", "Easy", "Richman",
      "Square", "Beximco", "Incepta", "ACI", "Renata",
    ],
  },
  { key: "socket", name: "Socket", type: "enum", options: ["AM4", "AM5", "LGA1700", "LGA1851"] },
  { key: "core_count", name: "Core count", type: "number" },
  { key: "base_clock_ghz", name: "Base clock", type: "number", unit: "GHz" },
  { key: "tdp_w", name: "TDP", type: "number", unit: "W" },
  { key: "integrated_graphics", name: "Integrated graphics", type: "boolean" },
  { key: "model_number", name: "Model number", type: "text" },
  { key: "memory_type", name: "Memory type", type: "enum", options: ["DDR4", "DDR5"] },
  { key: "capacity_gb", name: "Capacity", type: "number", unit: "GB" },
  { key: "speed_mhz", name: "Speed", type: "number", unit: "MHz" },
  { key: "module_type", name: "Module type", type: "enum", options: ["DIMM", "SO-DIMM"] },
  { key: "chipset", name: "Chipset", type: "enum", options: ["A620", "B650", "X670", "B760", "Z790"] },
  { key: "form_factor", name: "Form factor", type: "enum", options: ["ATX", "Micro-ATX", "Mini-ITX"] },
  { key: "author", name: "Author", type: "text" },
  { key: "language", name: "Language", type: "enum", options: ["Bangla", "English"] },
  { key: "format", name: "Format", type: "enum", options: ["Hardcover", "Paperback", "Ebook"] },
  {
    key: "genre",
    name: "Genre",
    type: "enum",
    options: ["Novel", "Thriller", "Poetry", "Science", "Engineering", "Business", "Picture book", "Rhymes"],
  },
  { key: "isbn", name: "ISBN", type: "text" },
  { key: "page_count", name: "Page count", type: "number" },
  { key: "fit", name: "Fit", type: "enum", options: ["Slim", "Regular", "Relaxed"] },
  { key: "material", name: "Material", type: "enum", options: ["Cotton", "Linen", "Denim", "Polyester", "Viscose"] },
  { key: "size", name: "Size", type: "enum", options: ["S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36"] },
  { key: "colour", name: "Colour", type: "enum", options: ["Black", "White", "Blue", "Navy", "Grey", "Red", "Green"] },
  { key: "tryon_eligible", name: "Try-on eligible", type: "boolean" },
  {
    key: "generic_name",
    name: "Generic name",
    type: "enum",
    options: ["Paracetamol", "Ibuprofen", "Naproxen", "Vitamin C", "Vitamin D3", "Multivitamin", "Calcium + D3"],
  },
  { key: "dosage_form", name: "Dosage form", type: "enum", options: ["Tablet", "Capsule", "Syrup", "Suspension"] },
  { key: "strength_mg", name: "Strength", type: "number", unit: "mg" },
  { key: "pack_size", name: "Pack size", type: "number", unit: "units" },
  { key: "otc", name: "Over the counter (OTC)", type: "boolean" },
];

const BOOK_ATTRS: SeedAssign[] = [
  ["author", true, true], ["language", true, true], ["format", true, true], ["genre", false, true],
  ["isbn", false, false], ["page_count", false, false],
];
const FASHION_ATTRS: SeedAssign[] = [
  ["brand", true, true], ["fit", false, true], ["material", true, true],
  ["size", true, true, true], ["colour", true, true, true], ["tryon_eligible", false, true],
];
const MEDICINE_ATTRS: SeedAssign[] = [
  ["brand", true, true], ["generic_name", true, true], ["dosage_form", true, true],
  ["strength_mg", true, true], ["pack_size", true, false], ["otc", true, false],
];

// Commission testing values from the plan; children inherit from their root.
const CATALOG_TREE: SeedCategory[] = [
  {
    name: "Electronics",
    commissionRate: 5,
    children: [
      {
        name: "Computer Components",
        children: [
          {
            name: "Processor",
            attributes: [
              ["brand", true, true], ["socket", true, true], ["core_count", true, true], ["base_clock_ghz", true, true],
              ["tdp_w", false, true], ["integrated_graphics", false, true], ["model_number", false, false],
            ],
          },
          {
            name: "RAM",
            attributes: [
              ["brand", true, true], ["memory_type", true, true], ["capacity_gb", true, true],
              ["speed_mhz", false, true], ["module_type", true, true],
            ],
          },
          {
            name: "Motherboard",
            attributes: [
              ["brand", true, true], ["socket", true, true], ["chipset", true, true],
              ["form_factor", true, true], ["memory_type", true, true],
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Books",
    commissionRate: 8,
    children: [
      { name: "Fiction", attributes: BOOK_ATTRS },
      { name: "Academic", attributes: BOOK_ATTRS },
      { name: "Children's", attributes: BOOK_ATTRS },
    ],
  },
  {
    name: "Fashion",
    commissionRate: 12,
    children: [
      { name: "Men's Shirts", attributes: FASHION_ATTRS },
      { name: "Men's Pants", attributes: FASHION_ATTRS },
      { name: "Women's Tops", attributes: FASHION_ATTRS },
    ],
  },
  {
    name: "Medicine",
    commissionRate: 5,
    requiresLicence: true,
    requiresExpiry: true,
    children: [
      { name: "Pain Relief", attributes: MEDICINE_ATTRS },
      { name: "Vitamins", attributes: MEDICINE_ATTRS },
    ],
  },
];

function widgetFor(type: AttributeType): FilterWidget {
  if (type === "number") return "range_slider";
  if (type === "boolean") return "toggle";
  return "checkbox_list";
}

async function seedCatalog() {
  const attrIds = new Map<string, { id: string; type: AttributeType }>();
  for (const a of CATALOG_ATTRIBUTES) {
    const attr = await prisma.attribute.upsert({
      where: { key: a.key },
      update: { name: a.name, type: a.type, unit: a.unit ?? null, archivedAt: null },
      create: { key: a.key, name: a.name, type: a.type, unit: a.unit ?? null },
    });
    attrIds.set(a.key, { id: attr.id, type: a.type });
    for (const label of a.options ?? []) {
      const value = slugify(label);
      await prisma.attributeOption.upsert({
        where: { attributeId_value: { attributeId: attr.id, value } },
        update: { label, status: "active" },
        create: { attributeId: attr.id, value, label },
      });
    }
  }

  let count = 0;
  async function upsertCategory(
    c: { name: string; slug: string; isOther: boolean; isLeaf: boolean },
    parent: { id: string; path: string; commissionRate: number; requiresLicence: boolean; requiresExpiry: boolean } | null,
    own: Pick<SeedCategory, "commissionRate" | "requiresLicence" | "requiresExpiry">,
  ) {
    const data = {
      name: c.name,
      parentId: parent?.id ?? null,
      isLeaf: c.isLeaf,
      isOther: c.isOther,
      commissionRate: own.commissionRate ?? parent?.commissionRate ?? 10,
      requiresLicence: own.requiresLicence ?? parent?.requiresLicence ?? false,
      requiresExpiry: own.requiresExpiry ?? parent?.requiresExpiry ?? false,
      archivedAt: null,
    };
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: data,
      create: { ...data, slug: c.slug, path: "" },
    });
    count++;
    const path = `${parent?.path ?? "/"}${row.id}/`;
    await prisma.category.update({ where: { id: row.id }, data: { path } });
    return { id: row.id, path, commissionRate: data.commissionRate, requiresLicence: data.requiresLicence, requiresExpiry: data.requiresExpiry };
  }

  async function walk(nodes: SeedCategory[], parent: Awaited<ReturnType<typeof upsertCategory>> | null) {
    for (const n of nodes) {
      const slug = slugify(n.name);
      const isLeaf = !n.children?.length;
      const row = await upsertCategory({ name: n.name, slug, isOther: false, isLeaf }, parent, n);
      for (const [i, [key, required, filterable, isVariantAxis = false]] of (n.attributes ?? []).entries()) {
        const attr = attrIds.get(key)!;
        const settings = {
          required,
          filterable,
          filterWidget: filterable ? widgetFor(attr.type) : null,
          displayOrder: i + 1,
          isVariantAxis,
        };
        await prisma.categoryAttribute.upsert({
          where: { categoryId_attributeId: { categoryId: row.id, attributeId: attr.id } },
          update: settings,
          create: { categoryId: row.id, attributeId: attr.id, ...settings },
        });
      }
      if (!isLeaf) {
        await walk(n.children!, row);
        // US-024: every parent gets an "Other" leaf with only the common fields.
        await upsertCategory({ name: "Other", slug: `${slug}-other`, isOther: true, isLeaf: true }, row, {});
      }
    }
  }
  await walk(CATALOG_TREE, null);

  // One pending seller request so the admin queue is not empty.
  const requester = await prisma.user.findUniqueOrThrow({ where: { email: "customer.verified@ecom.test" } });
  const components = await prisma.category.findUniqueOrThrow({ where: { slug: "computer-components" } });
  const existing = await prisma.categoryRequest.findFirst({ where: { name: "[TEST] Graphics Card", requestedByUserId: requester.id } });
  if (!existing) {
    await prisma.categoryRequest.create({
      data: {
        kind: "category",
        requestedByUserId: requester.id,
        parentId: components.id,
        name: "[TEST] Graphics Card",
        reason: "Seed request for the admin queue",
        dueAt: new Date(Date.now() + 24 * 3600_000),
      },
    });
  }

  console.info(`Seeded ${CATALOG_ATTRIBUTES.length} attributes and ${count} categories`);
}

/**
 * Shops (US-010 to US-017): Tech, Fashion and Pharmacy are Verified, Books is Basic; all approved.
 * A fifth, Basic shop is suspended (hidden storefront and products).
 * Each has an owner and one staff user. The pharmacy has a dummy verified drug licence.
 */
async function seedShops() {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@ecom.test" } });

  // One placeholder file in the private bucket stands in for every seeded document.
  const docKey = "seed/dummy-document.txt";
  try {
    await getStorage().putObject(docKey, new TextEncoder().encode("[TEST] dummy document"), "text/plain");
  } catch (err) {
    console.warn(`Seed document not uploaded (is MinIO running?): ${err instanceof Error ? err.message : err}`);
  }

  const shops = [
    { key: "tech", name: "[TEST] Test Tech Shop", slug: "test-tech-shop", type: "electronics", verified: true },
    { key: "books", name: "[TEST] Test Book Shop", slug: "test-book-shop", type: "books", verified: false },
    { key: "fashion", name: "[TEST] Test Fashion Shop", slug: "test-fashion-shop", type: "fashion", verified: true },
    { key: "pharmacy", name: "[TEST] Test Pharmacy", slug: "test-pharmacy", type: "medicine", verified: true },
    // Suspended by the admin: its storefront is "not found" and its products are hidden (US-014, US-015).
    { key: "suspended", name: "[TEST] Suspended Shop", slug: "test-suspended-shop", type: "general", verified: false, suspended: true },
  ] as const;

  for (const [i, s] of shops.entries()) {
    const [owner, staff] = await Promise.all(
      (["owner", "staff"] as const).map((role) => {
        const email = `${role}.${s.key}@ecom.test`;
        const data = { email, name: `[TEST] ${s.name.replace("[TEST] ", "")} ${role}`, emailVerifiedAt: new Date() };
        return prisma.user.upsert({ where: { email }, update: { ...data, passwordHash }, create: { ...data, passwordHash } });
      }),
    );

    const data = {
      name: s.name,
      type: s.type,
      status: "suspended" in s ? "suspended" : "approved",
      statusReason: "suspended" in s ? "[TEST] Suspended for testing" : null,
      ownerId: owner.id,
      ownerNid: `199000000000${String(i + 1).padStart(5, "0")}`,
      ownerPhotoKey: docKey,
      tier: s.verified ? "verified" : "basic",
      upgradeStatus: s.verified ? "approved" : "none",
      registrationType: s.verified ? "trade_licence" : null,
      registrationNo: s.verified ? `TEST-TL-000${i + 1}` : null,
      registrationDocKey: s.verified ? docKey : null,
      description: `${s.name} is seeded test data.`,
      medicineSuspended: false,
    } as const;
    const shop = await prisma.shop.upsert({ where: { slug: s.slug }, update: data, create: { ...data, slug: s.slug } });

    for (const [user, role] of [
      [owner, "owner"],
      [staff, "staff"],
    ] as const) {
      await prisma.shopMember.upsert({
        where: { shopId_userId: { shopId: shop.id, userId: user.id } },
        update: { role },
        create: { shopId: shop.id, userId: user.id, role },
      });
    }

    if (s.type === "medicine") {
      const licenceNo = "TEST-DGDA-0001";
      const expiryDate = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 11, 31));
      const licence = {
        licenceNo,
        expiryDate,
        documentKey: docKey,
        status: "verified",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        reason: null,
        warnedAt: null,
      } as const;
      const existing = await prisma.shopLicence.findFirst({ where: { shopId: shop.id, licenceNo } });
      if (existing) await prisma.shopLicence.update({ where: { id: existing.id }, data: licence });
      else await prisma.shopLicence.create({ data: { ...licence, shopId: shop.id } });
    }
  }

  console.info(`Seeded ${shops.length} test shops with an owner and a staff user each (owner.<shop>@ecom.test)`);
}

/** Accounts feature: saved addresses for the seeded customers (fixed ids, so re-running updates them). */
async function seedAccounts() {
  const addresses = [
    {
      id: "seed-address-verified-home",
      email: "customer.verified@ecom.test",
      name: "[TEST] Customer, verified phone",
      phone: "+8801700000002",
      division: "Dhaka",
      district: "Dhaka",
      upazila: "Dhanmondi",
      area: "Dhanmondi 27",
      line1: "House 10, Road 27",
      isDefault: true,
    },
    {
      id: "seed-address-verified-office",
      email: "customer.verified@ecom.test",
      name: "[TEST] Customer, verified phone",
      phone: "+8801700000002",
      division: "Dhaka",
      district: "Gazipur",
      upazila: "Tongi",
      area: "Station Road",
      line1: "Plot 5, Block B",
      isDefault: false,
    },
    {
      id: "seed-address-flagged-home",
      email: "customer.flagged@ecom.test",
      name: "[TEST] Customer, past refusals",
      phone: "+8801700000003",
      division: "Chattogram",
      district: "Chattogram",
      upazila: "Panchlaish",
      area: "GEC Circle",
      line1: "Flat 4A, Holding 22",
      isDefault: true,
    },
  ];
  for (const { id, email, ...data } of addresses) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    await prisma.address.upsert({ where: { id }, update: data, create: { id, userId: user.id, ...data } });
  }
  console.info(`Seeded ${addresses.length} test addresses`);
}

/**
 * Products (US-030 to US-034): two [TEST] listings per seeded shop, validated through the real
 * category schema. No images (they need MinIO). Matched by shop + title, so re-running updates them;
 * variants are upserted by their options, so their ids stay stable for carts.
 */
async function seedProducts() {
  const common = { quantity: 1, quantity_unit: "pcs", weight_g: 250, return_eligibility: "eligible" };
  const expiry = `${new Date().getUTCFullYear() + 1}-12-31`;
  type SeedVariant = { sku: string; price: number; stock: number; options?: Record<string, string> };
  type SeedProduct = { title: string; category: string; description: string; attributes: Record<string, unknown>; variants: SeedVariant[] };
  const byShop: Record<string, SeedProduct[]> = {
    "test-suspended-shop": [
      {
        title: "[TEST] Hidden: suspended shop's processor",
        category: "processor",
        description: "Listed by a suspended shop, so customers never see it.",
        attributes: { ...common, country_of_origin: "China", brand: "intel", socket: "lga1700", core_count: 6, base_clock_ghz: 2.5 },
        variants: [{ sku: "TEST-SUSP-CPU", price: 15000, stock: 3 }],
      },
    ],
    "test-tech-shop": [
      {
        title: "[TEST] AMD Ryzen 5 7600 Processor",
        category: "processor",
        description: "6 cores, 12 threads, AM5 socket. Boxed with the Wraith Stealth cooler.",
        attributes: { ...common, country_of_origin: "China", warranty: "3 years", brand: "amd", socket: "am5", core_count: 6, base_clock_ghz: 3.8, tdp_w: 65, integrated_graphics: true, model_number: "100-100001015BOX" },
        variants: [{ sku: "TEST-R5-7600", price: 24500, stock: 12 }],
      },
      {
        title: "[TEST] Corsair Vengeance 16GB DDR5 RAM",
        category: "ram",
        description: "16 GB DDR5 desktop memory, 5600 MHz.",
        attributes: { ...common, country_of_origin: "Taiwan", warranty: "Lifetime", brand: "corsair", memory_type: "ddr5", capacity_gb: 16, speed_mhz: 5600, module_type: "dimm" },
        variants: [{ sku: "TEST-CMK16GX5", price: 6800, stock: 25 }],
      },
    ],
    "test-book-shop": [
      {
        title: "[TEST] Himu (paperback)",
        category: "fiction",
        description: "A Himu novel by Humayun Ahmed.",
        attributes: { ...common, country_of_origin: "Bangladesh", brand: "Anyaprokash", author: "Humayun Ahmed", language: "bangla", format: "paperback", genre: "novel", page_count: 120 },
        variants: [{ sku: "TEST-HIMU-PB", price: 250, stock: 40 }],
      },
      {
        title: "[TEST] Engineering Mathematics",
        category: "academic",
        description: "Textbook for first-year engineering students.",
        attributes: { ...common, country_of_origin: "Bangladesh", brand: "[TEST] Publisher", author: "[TEST] Author", language: "english", format: "hardcover", genre: "engineering" },
        variants: [{ sku: "TEST-ENG-MATH", price: 650, stock: 8 }],
      },
    ],
    "test-fashion-shop": [
      {
        title: "[TEST] Oxford cotton shirt",
        category: "mens-shirts",
        description: "Regular-fit long-sleeve Oxford shirt.",
        attributes: { ...common, country_of_origin: "Bangladesh", brand: "yellow", fit: "regular", material: "cotton", tryon_eligible: true },
        variants: ["S", "M", "L"].flatMap((size) =>
          ["Black", "White"].map((colour) => ({
            sku: `TEST-OX-${size}-${colour.toUpperCase()}`,
            price: size === "L" ? 1950 : 1850,
            // L / White is sold out, so the product page shows a disabled option.
            stock: size === "L" && colour === "White" ? 0 : 6,
            options: { size: size.toLowerCase(), colour: colour.toLowerCase() },
          })),
        ),
      },
      {
        title: "[TEST] Slim denim pants",
        category: "mens-pants",
        description: "Slim-fit stretch denim.",
        attributes: { ...common, country_of_origin: "Bangladesh", brand: "easy", fit: "slim", material: "denim" },
        variants: ["30", "32", "34"].map((size) => ({ sku: `TEST-DENIM-${size}`, price: 2200, stock: 4, options: { size, colour: "blue" } })),
      },
    ],
    "test-pharmacy": [
      {
        title: "[TEST] Paracetamol 500 mg tablets",
        category: "pain-relief",
        description: "Strip of 10 tablets.",
        attributes: { ...common, quantity: 10, weight_g: 20, country_of_origin: "Bangladesh", brand: "square", generic_name: "paracetamol", dosage_form: "tablet", strength_mg: 500, pack_size: 10, otc: true, expiry_date: expiry },
        variants: [{ sku: "TEST-PARA-500", price: 12, stock: 200 }],
      },
      {
        title: "[TEST] Vitamin C 250 mg tablets",
        category: "vitamins",
        description: "Chewable, strip of 10.",
        attributes: { ...common, quantity: 10, weight_g: 20, country_of_origin: "Bangladesh", brand: "beximco", generic_name: "vitamin-c", dosage_form: "tablet", strength_mg: 250, pack_size: 10, otc: true, expiry_date: expiry },
        variants: [{ sku: "TEST-VITC-250", price: 25, stock: 150 }],
      },
    ],
  };

  const today = dhakaToday(new Date());
  let count = 0;
  for (const [shopSlug, products] of Object.entries(byShop)) {
    const shop = await prisma.shop.findUniqueOrThrow({ where: { slug: shopSlug } });
    const staff = await prisma.shopMember.findFirstOrThrow({ where: { shopId: shop.id, role: "staff" } });
    for (const p of products) {
      const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.category } });
      const input = validateProductInput(
        await getCategorySchema(category.id),
        { title: p.title, description: p.description, attributes: p.attributes, variants: p.variants.map((v) => ({ ...v, options: v.options ?? {} })) },
        today,
      );
      const data = {
        categoryId: category.id,
        title: input.title,
        description: input.description,
        attributes: input.attributes as Prisma.InputJsonValue,
        expiresOn: input.expiresOn,
        status: "active" as const,
        deletedAt: null,
      };
      const existing = await prisma.product.findFirst({ where: { shopId: shop.id, title: p.title } });
      const product = existing
        ? await prisma.product.update({ where: { id: existing.id }, data })
        : await prisma.product.create({ data: { ...data, shopId: shop.id, createdById: staff.userId } });
      for (const v of input.variants) {
        const values = { sku: v.sku, price: v.price, stock: v.stock, options: v.options as Prisma.InputJsonValue, position: v.position };
        await prisma.productVariant.upsert({
          where: { productId_optionKey: { productId: product.id, optionKey: v.optionKey } },
          update: values,
          create: { ...values, productId: product.id, shopId: shop.id, optionKey: v.optionKey },
        });
      }
      count++;
    }
  }
  await refreshLiveCounts(new Date());
  console.info(`Seeded ${count} test products (no images)`);
}

/**
 * Wishlist (US-057): the verified customer saved a book and a sold-out shirt variant, so
 * /account/wishlist shows both "In stock" and "Out of stock". Idempotent.
 */
async function seedWishlist() {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "customer.verified@ecom.test" } });
  const picks: { title: string; optionKey: string }[] = [
    { title: "[TEST] Himu (paperback)", optionKey: "" },
    { title: "[TEST] Oxford cotton shirt", optionKey: "colour=white;size=l" },
  ];
  for (const pick of picks) {
    const product = await prisma.product.findFirstOrThrow({ where: { title: pick.title, deletedAt: null } });
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { productId_optionKey: { productId: product.id, optionKey: pick.optionKey } },
    });
    const existing = await prisma.wishlistItem.findFirst({ where: { userId: user.id, productId: product.id, variantId: variant.id } });
    if (!existing) await prisma.wishlistItem.create({ data: { userId: user.id, productId: product.id, variantId: variant.id } });
  }
  console.info("Seeded 2 wishlist items for customer.verified@ecom.test");
}

/**
 * Cart (US-050, US-056, US-058): the Test Tech Shop gives free delivery from Tk 10,000, and the
 * verified customer's cart spans two shops: RAM (tech, "Add Tk 3,200 more for free delivery"),
 * two Engineering Mathematics books added at Tk 600 (now Tk 650, so the cart shows a price
 * notice and Checkout waits for "Accept new price"), and a shirt saved for later. Idempotent.
 */
async function seedCart() {
  await prisma.shop.update({ where: { slug: "test-tech-shop" }, data: { freeDeliveryThreshold: "10000.00" } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "customer.verified@ecom.test" } });
  const lines: { title: string; optionKey: string; quantity: number; priceAtAdd?: string; savedForLater?: boolean }[] = [
    { title: "[TEST] Corsair Vengeance 16GB DDR5 RAM", optionKey: "", quantity: 1 },
    { title: "[TEST] Engineering Mathematics", optionKey: "", quantity: 2, priceAtAdd: "600.00" },
    { title: "[TEST] Oxford cotton shirt", optionKey: "colour=black;size=m", quantity: 1, savedForLater: true },
  ];
  for (const line of lines) {
    const product = await prisma.product.findFirstOrThrow({ where: { title: line.title, deletedAt: null } });
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { productId_optionKey: { productId: product.id, optionKey: line.optionKey } },
    });
    const data = {
      quantity: line.quantity,
      savedForLater: line.savedForLater ?? false,
      priceAtAdd: line.priceAtAdd ?? variant.price.toFixed(2),
    };
    await prisma.cartItem.upsert({
      where: { userId_variantId: { userId: user.id, variantId: variant.id } },
      update: data,
      create: { ...data, userId: user.id, productId: product.id, variantId: variant.id, shopId: product.shopId },
    });
  }
  console.info(`Seeded a cart of ${lines.length} lines (2 shops + 1 saved) for customer.verified@ecom.test`);
}

async function main() {
  assertSeedAllowed();
  await seedUsers();
  await seedCatalog();
  await seedShops();
  await seedAccounts();
  await seedProducts();
  await seedWishlist();
  await seedCart();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
