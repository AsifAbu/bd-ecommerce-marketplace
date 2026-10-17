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
import { indexer } from "../src/features/search/server";
import { deliveryCharge } from "../src/lib/delivery";
import { assertSeedAllowed } from "./seed-guard";
import { POLICY_SLUGS, SIGNUP_POLICY_SLUGS, CHECKOUT_POLICY_SLUGS } from "../src/features/policies/catalog";
import { SEED_POLICY_TEXT } from "../src/features/policies/seed-text";
import * as reviewsRepo from "../src/features/reviews/repo";

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

  // The flagged customer's 2 refused COD deliveries are real refused shop orders now (seedOrders).
  // Older databases also hold two "order.cod_refused" audit stand-ins; the audit log is
  // append-only, so they stay, and no new ones are written.

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
  type SeedProduct = {
    title: string;
    bengaliName?: string;
    category: string;
    description: string;
    attributes: Record<string, unknown>;
    variants: SeedVariant[];
  };
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
      // Search (US-041, US-042): more processors so the Brand, Socket and core filters have choices.
      {
        title: "[TEST] AMD Ryzen 7 7700X Processor",
        category: "processor",
        description: "8 cores, 16 threads, AM5 socket. No cooler in the box.",
        attributes: { ...common, country_of_origin: "China", warranty: "3 years", brand: "amd", socket: "am5", core_count: 8, base_clock_ghz: 4.5, tdp_w: 105, integrated_graphics: true, model_number: "100-100000591WOF" },
        variants: [{ sku: "TEST-R7-7700X", price: 36500, stock: 4 }],
      },
      {
        title: "[TEST] Intel Core i5-14400F Processor",
        category: "processor",
        description: "10 cores (6P + 4E), LGA1700 socket. Needs a graphics card.",
        attributes: { ...common, country_of_origin: "Vietnam", warranty: "3 years", brand: "intel", socket: "lga1700", core_count: 10, base_clock_ghz: 2.5, tdp_w: 65, integrated_graphics: false, model_number: "BX8071514400F" },
        variants: [{ sku: "TEST-I5-14400F", price: 21500, stock: 7 }],
      },
      {
        // Out of stock: live but not searchable, so it never shows in results or counts.
        title: "[TEST] Intel Core i3-12100 Processor",
        category: "processor",
        description: "4 cores, LGA1700 socket, Intel UHD 730 graphics.",
        attributes: { ...common, country_of_origin: "Vietnam", warranty: "3 years", brand: "intel", socket: "lga1700", core_count: 4, base_clock_ghz: 3.3, tdp_w: 60, integrated_graphics: true },
        variants: [{ sku: "TEST-I3-12100", price: 12500, stock: 0 }],
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
        bengaliName: "হিমু",
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
        bengaliName: "অক্সফোর্ড সুতি শার্ট",
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
        {
          title: p.title,
          bengaliName: p.bengaliName,
          description: p.description,
          attributes: p.attributes,
          variants: p.variants.map((v) => ({ ...v, options: v.options ?? {} })),
        },
        today,
      );
      const data = {
        categoryId: category.id,
        title: input.title,
        bengaliName: input.bengaliName,
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

/** Search (US-041): builds the Meilisearch index when MEILI_URL is set; Postgres needs nothing. */
async function seedSearchIndex() {
  try {
    const result = await indexer.reindexAll();
    console.info(result.skipped ? "Search index: Meilisearch not configured, the Postgres adapter serves search" : `Search index built: ${result.indexed} products`);
  } catch (err) {
    console.warn(`Search index not built (is Meilisearch running?): ${err instanceof Error ? err.message : err}`);
  }
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

/**
 * Policies (US-080): version 1 of every policy, published, with [TEST] wording. Published rows
 * are immutable, so an existing version 1 is left as it is. Every seeded user has accepted the
 * Terms and Privacy Policy v1 (as at sign-up); the verified customer also accepted Return and
 * Delivery v1 (as at checkout). Acceptance rows are append-only: only missing ones are added.
 */
async function seedPolicies() {
  const effectiveAt = new Date("2026-10-01T00:00:00+06:00");
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@ecom.test" }, select: { id: true } });
  const v1 = new Map<string, { id: string; slug: string; version: number }>();
  for (const slug of POLICY_SLUGS) {
    const { title, body } = SEED_POLICY_TEXT[slug];
    const row = await prisma.policyDocument.upsert({
      where: { slug_version: { slug, version: 1 } },
      update: {},
      create: {
        slug,
        version: 1,
        title,
        body,
        changeSummary: "[TEST] First version (seed)",
        status: "published",
        effectiveAt,
        publishedAt: effectiveAt,
        createdById: admin.id,
        publishedById: admin.id,
      },
      select: { id: true, slug: true, version: true },
    });
    v1.set(slug, row);
  }

  const users = await prisma.user.findMany({ where: { email: { endsWith: "@ecom.test" } }, select: { id: true, email: true } });
  let added = 0;
  for (const user of users) {
    const plan: [readonly string[], "signup" | "checkout"][] = [[SIGNUP_POLICY_SLUGS, "signup"]];
    if (user.email === "customer.verified@ecom.test") plan.push([CHECKOUT_POLICY_SLUGS, "checkout"]);
    for (const [slugs, context] of plan) {
      for (const slug of slugs) {
        const policy = v1.get(slug)!;
        const exists = await prisma.policyAcceptance.count({ where: { userId: user.id, policyId: policy.id } });
        if (exists) continue;
        await prisma.policyAcceptance.create({
          data: { userId: user.id, policyId: policy.id, slug, version: policy.version, context, userAgent: "seed" },
        });
        added++;
      }
    }
  }
  console.info(`Seeded version 1 of ${v1.size} policies; added ${added} acceptance records`);
}

/**
 * Orders (US-051, US-052, US-007 to US-009): placed orders as checkout writes them, with fixed
 * order numbers (created once, never changed or deleted: 6-year records). Stock is not touched.
 * - customer.verified: one delivered order (Test Tech Shop) and one open order (Test Book Shop).
 * - a guest order for mobile 01700000009 (no account), to try tracking at /track with code 123456.
 * - customer.flagged: 2 refused shop orders, so cash on delivery is blocked for 01700000003 (D8).
 */
async function seedOrders() {
  const policyVersions = [
    { slug: "returns", version: 1 },
    { slug: "delivery", version: 1 },
  ];
  type SeedLine = { title: string; optionKey?: string; quantity: number };
  type SeedShopOrder = { shopSlug: string; status: "placed" | "confirmed" | "delivered" | "refused"; lines: SeedLine[] };
  type SeedOrder = {
    orderNo: string;
    placedAt: string;
    userEmail: string | null;
    contact: { name: string; phone: string; email: string | null };
    address: { name: string; phone: string; division: string; district: string; upazila: string; area: string; line1: string };
    shopOrders: SeedShopOrder[];
  };
  const verifiedHome = {
    name: "[TEST] Customer, verified phone",
    phone: "+8801700000002",
    division: "Dhaka",
    district: "Dhaka",
    upazila: "Dhanmondi",
    area: "Dhanmondi 27",
    line1: "House 10, Road 27",
  };
  const flaggedHome = {
    name: "[TEST] Customer, past refusals",
    phone: "+8801700000003",
    division: "Chattogram",
    district: "Chattogram",
    upazila: "Panchlaish",
    area: "GEC Circle",
    line1: "Flat 4A, Holding 22",
  };
  const orders: SeedOrder[] = [
    {
      orderNo: "BD-261005-SEEDA",
      placedAt: "2026-10-05T11:00:00+06:00",
      userEmail: "customer.verified@ecom.test",
      contact: { name: "[TEST] Customer, verified phone and email", phone: "+8801700000002", email: "customer.verified@ecom.test" },
      address: verifiedHome,
      shopOrders: [{ shopSlug: "test-tech-shop", status: "delivered", lines: [{ title: "[TEST] Corsair Vengeance 16GB DDR5 RAM", quantity: 1 }] }],
    },
    {
      // Reviews (US-055): customer.new's delivered order, reviewed in seedReviews (one review hidden).
      orderNo: "BD-261008-SEEDR",
      placedAt: "2026-10-08T15:00:00+06:00",
      userEmail: "customer.new@ecom.test",
      contact: { name: "[TEST] Customer, new", phone: "+8801700000004", email: "customer.new@ecom.test" },
      address: { ...verifiedHome, name: "[TEST] Customer, new", phone: "+8801700000004" },
      shopOrders: [
        { shopSlug: "test-tech-shop", status: "delivered", lines: [{ title: "[TEST] Corsair Vengeance 16GB DDR5 RAM", quantity: 1 }] },
        { shopSlug: "test-book-shop", status: "delivered", lines: [{ title: "[TEST] Himu (paperback)", quantity: 1 }] },
      ],
    },
    {
      orderNo: "BD-261015-SEEDB",
      placedAt: "2026-10-15T18:30:00+06:00",
      userEmail: "customer.verified@ecom.test",
      contact: { name: "[TEST] Customer, verified phone and email", phone: "+8801700000002", email: "customer.verified@ecom.test" },
      address: verifiedHome,
      shopOrders: [{ shopSlug: "test-book-shop", status: "confirmed", lines: [{ title: "[TEST] Himu (paperback)", quantity: 2 }] }],
    },
    {
      orderNo: "BD-261016-SEEDC",
      placedAt: "2026-10-16T09:15:00+06:00",
      userEmail: null,
      contact: { name: "[TEST] Guest shopper", phone: "+8801700000009", email: "guest.shopper@ecom.test" },
      address: {
        name: "[TEST] Guest shopper",
        phone: "+8801700000009",
        division: "Sylhet",
        district: "Sylhet",
        upazila: "Sylhet Sadar",
        area: "Zindabazar",
        line1: "House 3, Lane 2",
      },
      shopOrders: [{ shopSlug: "test-fashion-shop", status: "placed", lines: [{ title: "[TEST] Oxford cotton shirt", optionKey: "colour=black;size=m", quantity: 1 }] }],
    },
    {
      orderNo: "BD-260920-SEEDF",
      placedAt: "2026-09-20T12:00:00+06:00",
      userEmail: "customer.flagged@ecom.test",
      contact: { name: "[TEST] Customer, past refusals", phone: "+8801700000003", email: "customer.flagged@ecom.test" },
      address: flaggedHome,
      shopOrders: [{ shopSlug: "test-book-shop", status: "refused", lines: [{ title: "[TEST] Engineering Mathematics", quantity: 1 }] }],
    },
    {
      orderNo: "BD-260925-SEEDG",
      placedAt: "2026-09-25T12:00:00+06:00",
      userEmail: "customer.flagged@ecom.test",
      contact: { name: "[TEST] Customer, past refusals", phone: "+8801700000003", email: "customer.flagged@ecom.test" },
      address: flaggedHome,
      shopOrders: [{ shopSlug: "test-fashion-shop", status: "refused", lines: [{ title: "[TEST] Slim denim pants", optionKey: "colour=blue;size=32", quantity: 1 }] }],
    },
  ];

  const money = (paisa: number) => (paisa / 100).toFixed(2);
  let created = 0;
  for (const o of orders) {
    if (await prisma.order.findUnique({ where: { orderNo: o.orderNo }, select: { id: true } })) continue;
    const placedAt = new Date(o.placedAt);
    const user = o.userEmail ? await prisma.user.findUniqueOrThrow({ where: { email: o.userEmail }, select: { id: true } }) : null;
    const insideDhaka = o.address.district === "Dhaka";
    let itemsPaisa = 0;
    let deliveryPaisa = 0;
    const shopOrders = [];
    for (const [i, so] of o.shopOrders.entries()) {
      const shop = await prisma.shop.findUniqueOrThrow({ where: { slug: so.shopSlug } });
      let subtotal = 0;
      let weight = 0;
      let commission = 0;
      const items = [];
      for (const line of so.lines) {
        const product = await prisma.product.findFirstOrThrow({
          where: { title: line.title, shopId: shop.id, deletedAt: null },
          include: { category: { select: { commissionRate: true } } },
        });
        const variant = await prisma.productVariant.findUniqueOrThrow({
          where: { productId_optionKey: { productId: product.id, optionKey: line.optionKey ?? "" } },
        });
        const attrs = product.attributes as Record<string, unknown>;
        const unit = Math.round(Number(variant.price) * 100);
        const rate = Number(product.category.commissionRate);
        const unitWeight = typeof attrs.weight_g === "number" ? attrs.weight_g : 0;
        subtotal += unit * line.quantity;
        weight += unitWeight * line.quantity;
        commission += Math.round((unit * line.quantity * rate) / 100);
        const options = variant.options as Record<string, string>;
        items.push({
          productId: product.id,
          variantId: variant.id,
          categoryId: product.categoryId,
          title: product.title,
          variantLabel: Object.keys(options).length ? Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(", ") : null,
          sku: variant.sku,
          unitPrice: money(unit),
          quantity: line.quantity,
          lineTotal: money(unit * line.quantity),
          unitWeightGrams: unitWeight,
          warranty: typeof attrs.warranty === "string" ? attrs.warranty : null,
          commissionRate: rate.toFixed(2),
        });
      }
      const threshold = shop.freeDeliveryThreshold === null ? null : Math.round(Number(shop.freeDeliveryThreshold) * 100);
      const free = threshold !== null && subtotal >= threshold;
      const delivery = free ? 0 : deliveryCharge({ insideDhaka, weightGrams: weight }) * 100;
      itemsPaisa += subtotal;
      deliveryPaisa += delivery;
      shopOrders.push({
        shopId: shop.id,
        seq: i + 1,
        status: so.status,
        statusChangedAt: placedAt,
        shopName: shop.name,
        shopRegistration: shop.tier === "verified" && shop.registrationNo ? `Trade licence ${shop.registrationNo}` : null,
        itemsSubtotal: money(subtotal),
        weightGrams: weight,
        deliveryCharge: money(delivery),
        freeDelivery: free,
        total: money(subtotal + delivery),
        vatRate: "0.00",
        vatAmount: "0.00",
        commissionAmount: money(commission),
        launchOffer: false,
        handoverDueAt: new Date(placedAt.getTime() + 48 * 3_600_000),
        deliveredAt: so.status === "delivered" ? new Date(placedAt.getTime() + 3 * 24 * 3_600_000) : null,
        items: { create: items },
      });
    }
    await prisma.order.create({
      data: {
        orderNo: o.orderNo,
        userId: user?.id ?? null,
        contactName: o.contact.name,
        contactPhone: o.contact.phone,
        phoneVerifiedAt: placedAt,
        contactEmail: o.contact.email,
        address: o.address,
        zone: insideDhaka ? "inside_dhaka" : "outside_dhaka",
        itemsSubtotal: money(itemsPaisa),
        deliveryTotal: money(deliveryPaisa),
        grandTotal: money(itemsPaisa + deliveryPaisa),
        paymentMethod: "cod",
        policyVersions: o.userEmail ? policyVersions : [...policyVersions, { slug: "privacy", version: 1 }],
        idempotencyKey: `seed:${o.orderNo}`,
        placedAt,
        // Seeded: no SMS or email to send.
        smsSentAt: placedAt,
        emailSentAt: placedAt,
        shopOrders: { create: shopOrders },
      },
    });
    created++;
  }
  console.info(`Seeded ${created} new test orders (${orders.length} in the seed; guest order tracking: BD-261016-SEEDC, mobile 01700000009)`);
}

/**
 * Reviews (US-055), through the real repository so the product ratings are rebuilt: the verified
 * customer and customer.new reviewed the RAM (5 and 4 stars), and customer.new's Himu review is
 * hidden by the admin with a logged reason. Reviews are never deleted: existing ones are left as
 * they are.
 */
async function seedReviews() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@ecom.test" }, select: { id: true } });
  const picks = [
    { orderNo: "BD-261005-SEEDA", title: "[TEST] Corsair Vengeance 16GB DDR5 RAM", rating: 5, heading: "Fast and stable", text: "[TEST] Runs at 5600 MHz out of the box. Delivered in 3 days, well packed." },
    { orderNo: "BD-261008-SEEDR", title: "[TEST] Corsair Vengeance 16GB DDR5 RAM", rating: 4, heading: null, text: "[TEST] Good memory, the heat spreader is a bit tall for my cooler." },
    {
      orderNo: "BD-261008-SEEDR",
      title: "[TEST] Himu (paperback)",
      rating: 1,
      heading: "Call me",
      text: "[TEST] Cheaper copies at 01700000099, call me!",
      hide: "[TEST] Contains a phone number and advertising",
    },
  ];
  let created = 0;
  for (const p of picks) {
    const item = await prisma.orderItem.findFirstOrThrow({
      where: { title: p.title, shopOrder: { order: { orderNo: p.orderNo } } },
      select: { id: true, productId: true, shopOrder: { select: { shopId: true, order: { select: { userId: true } } } } },
    });
    if (await prisma.review.findUnique({ where: { orderItemId: item.id }, select: { id: true } })) continue;
    const review = await reviewsRepo.createReview({
      userId: item.shopOrder.order.userId!,
      orderItemId: item.id,
      productId: item.productId,
      shopId: item.shopOrder.shopId,
      rating: p.rating,
      title: p.heading,
      text: p.text,
    });
    if (p.hide) await reviewsRepo.setStatus(review.id, "visible", admin.id, p.hide, new Date());
    created++;
  }
  console.info(`Seeded ${created} new reviews (${picks.length} in the seed, 1 hidden by the admin)`);
}

/**
 * Order lifecycle and payouts (US-053, US-082): one shop order in every lifecycle state for
 * customer.verified, in the Tech and Fashion shops, with its status events, plus COD collections
 * and one paid payout. Times are relative to the first seed run; each order is created once
 * (found again by its idempotency key) and never changed or deleted. Stock is not touched.
 * - BD-…-LCJ (Fashion, placed 60 h ago) is overdue: the orders.handover-check job alerts it.
 * - LCP (Tech, delivered 2 days ago) has an unpaid collection; LCW (Fashion, delivered 9 days
 *   ago) is due soon; LCQ + LCR are in the paid payout seed-payout-tech-1.
 */
async function seedOrderLifecycle() {
  const HOUR = 3_600_000;
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR);
  type Step = "confirm" | "pack" | "hand_over" | "deliver" | "refuse" | "cancel" | "mark_returned";
  type SeedLifecycleOrder = {
    key: string;
    shopSlug: string;
    title: string;
    optionKey?: string;
    placedHoursAgo: number;
    // Each step and how many hours ago it happened.
    steps: [Step, number][];
  };
  const STEP_TO: Record<Step, "confirmed" | "packed" | "handed_over" | "delivered" | "refused" | "cancelled" | "returned"> = {
    confirm: "confirmed",
    pack: "packed",
    hand_over: "handed_over",
    deliver: "delivered",
    refuse: "refused",
    cancel: "cancelled",
    mark_returned: "returned",
  };
  const RYZEN = "[TEST] AMD Ryzen 5 7600 Processor";
  const RAM = "[TEST] Corsair Vengeance 16GB DDR5 RAM";
  const SHIRT = "[TEST] Oxford cotton shirt";
  const orders: SeedLifecycleOrder[] = [
    { key: "LCH", shopSlug: "test-tech-shop", title: RAM, placedHoursAgo: 2, steps: [] },
    { key: "LCJ", shopSlug: "test-fashion-shop", title: SHIRT, optionKey: "colour=white;size=m", placedHoursAgo: 60, steps: [] },
    { key: "LCK", shopSlug: "test-tech-shop", title: RAM, placedHoursAgo: 20, steps: [["confirm", 18]] },
    { key: "LCM", shopSlug: "test-fashion-shop", title: SHIRT, optionKey: "colour=black;size=s", placedHoursAgo: 30, steps: [["confirm", 28], ["pack", 6]] },
    { key: "LCN", shopSlug: "test-tech-shop", title: RYZEN, placedHoursAgo: 26, steps: [["confirm", 24], ["pack", 10], ["hand_over", 4]] },
    { key: "LCP", shopSlug: "test-tech-shop", title: RAM, placedHoursAgo: 96, steps: [["confirm", 94], ["pack", 80], ["hand_over", 72], ["deliver", 48]] },
    { key: "LCQ", shopSlug: "test-tech-shop", title: RYZEN, placedHoursAgo: 14 * 24, steps: [["confirm", 14 * 24 - 2], ["pack", 13 * 24], ["hand_over", 13 * 24 - 4], ["deliver", 12 * 24]] },
    { key: "LCR", shopSlug: "test-tech-shop", title: RAM, placedHoursAgo: 13 * 24, steps: [["confirm", 13 * 24 - 1], ["pack", 12 * 24], ["hand_over", 12 * 24 - 2], ["deliver", 11 * 24]] },
    { key: "LCS", shopSlug: "test-fashion-shop", title: SHIRT, optionKey: "colour=black;size=l", placedHoursAgo: 5 * 24, steps: [["confirm", 5 * 24 - 2], ["cancel", 4 * 24]] },
    { key: "LCT", shopSlug: "test-fashion-shop", title: "[TEST] Slim denim pants", optionKey: "colour=blue;size=34", placedHoursAgo: 7 * 24, steps: [["confirm", 7 * 24 - 3], ["pack", 6 * 24], ["hand_over", 6 * 24 - 2], ["refuse", 4 * 24]] },
    { key: "LCV", shopSlug: "test-tech-shop", title: RAM, placedHoursAgo: 9 * 24, steps: [["confirm", 9 * 24 - 1], ["pack", 8 * 24], ["hand_over", 8 * 24 - 3], ["refuse", 6 * 24], ["mark_returned", 3 * 24]] },
    { key: "LCW", shopSlug: "test-fashion-shop", title: SHIRT, optionKey: "colour=white;size=s", placedHoursAgo: 11 * 24, steps: [["confirm", 11 * 24 - 2], ["pack", 10 * 24 + 6], ["hand_over", 10 * 24], ["deliver", 9 * 24]] },
  ];

  const customer = await prisma.user.findUniqueOrThrow({ where: { email: "customer.verified@ecom.test" }, select: { id: true } });
  const address = {
    name: "[TEST] Customer, verified phone",
    phone: "+8801700000002",
    division: "Dhaka",
    district: "Dhaka",
    upazila: "Dhanmondi",
    area: "Dhanmondi 27",
    line1: "House 10, Road 27",
  };
  const money = (paisa: number) => (paisa / 100).toFixed(2);
  const dhakaDate = (d: Date) => new Date(d.getTime() + 6 * HOUR).toISOString().slice(2, 10).replace(/-/g, "");
  let created = 0;
  for (const o of orders) {
    const idempotencyKey = `seed:lifecycle:${o.key}`;
    if (await prisma.order.findUnique({ where: { idempotencyKey }, select: { id: true } })) continue;
    const placedAt = at(o.placedHoursAgo);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { slug: o.shopSlug } });
    const product = await prisma.product.findFirstOrThrow({
      where: { title: o.title, shopId: shop.id, deletedAt: null },
      include: { category: { select: { commissionRate: true } } },
    });
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { productId_optionKey: { productId: product.id, optionKey: o.optionKey ?? "" } } });
    const attrs = product.attributes as Record<string, unknown>;
    const unit = Math.round(Number(variant.price) * 100);
    const rate = Number(product.category.commissionRate);
    const weight = typeof attrs.weight_g === "number" ? attrs.weight_g : 0;
    const delivery = deliveryCharge({ insideDhaka: true, weightGrams: weight }) * 100;
    const commission = Math.round((unit * rate) / 100);
    const options = variant.options as Record<string, string>;
    const stepAt = (s: Step) => {
      const step = o.steps.find(([name]) => name === s);
      return step ? at(step[1]) : null;
    };
    const last = o.steps.at(-1);
    const status = last ? STEP_TO[last[0]] : "placed";
    const handedOver = o.steps.some(([s]) => s === "hand_over");
    await prisma.order.create({
      data: {
        orderNo: `BD-${dhakaDate(placedAt)}-${o.key}`,
        userId: customer.id,
        contactName: "[TEST] Customer, verified phone and email",
        contactPhone: "+8801700000002",
        phoneVerifiedAt: placedAt,
        contactEmail: "customer.verified@ecom.test",
        address,
        zone: "inside_dhaka",
        itemsSubtotal: money(unit),
        deliveryTotal: money(delivery),
        grandTotal: money(unit + delivery),
        paymentMethod: "cod",
        policyVersions: [
          { slug: "returns", version: 1 },
          { slug: "delivery", version: 1 },
        ],
        idempotencyKey,
        placedAt,
        smsSentAt: placedAt,
        emailSentAt: placedAt,
        shopOrders: {
          create: [
            {
              shopId: shop.id,
              seq: 1,
              status,
              statusChangedAt: last ? at(last[1]) : placedAt,
              shopName: shop.name,
              shopRegistration: shop.tier === "verified" && shop.registrationNo ? `Trade licence ${shop.registrationNo}` : null,
              itemsSubtotal: money(unit),
              weightGrams: weight,
              deliveryCharge: money(delivery),
              freeDelivery: false,
              total: money(unit + delivery),
              vatRate: "0.00",
              vatAmount: "0.00",
              commissionAmount: money(commission),
              launchOffer: false,
              handoverDueAt: new Date(placedAt.getTime() + 48 * HOUR),
              confirmedAt: stepAt("confirm"),
              packedAt: stepAt("pack"),
              handedOverAt: stepAt("hand_over"),
              courierName: handedOver ? "[TEST] RedX" : null,
              trackingNo: handedOver ? `RX-${o.key}` : null,
              deliveredAt: stepAt("deliver"),
              refusedAt: stepAt("refuse"),
              refusalNote: stepAt("refuse") ? "[TEST] Customer refused at the door" : null,
              cancelledAt: stepAt("cancel"),
              cancelledBy: stepAt("cancel") ? "shop" : null,
              cancelReason: stepAt("cancel") ? "[TEST] Size no longer available" : null,
              returnedAt: stepAt("mark_returned"),
              restockedAt: stepAt("cancel") ?? stepAt("mark_returned"),
              items: {
                create: [
                  {
                    productId: product.id,
                    variantId: variant.id,
                    categoryId: product.categoryId,
                    title: product.title,
                    variantLabel: Object.keys(options).length ? Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(", ") : null,
                    sku: variant.sku,
                    unitPrice: money(unit),
                    quantity: 1,
                    lineTotal: money(unit),
                    unitWeightGrams: weight,
                    warranty: typeof attrs.warranty === "string" ? attrs.warranty : null,
                    commissionRate: rate.toFixed(2),
                  },
                ],
              },
              events: {
                create: o.steps.map(([s, hoursAgo], i) => ({
                  action: s,
                  fromStatus: i === 0 ? "placed" : STEP_TO[o.steps[i - 1][0]],
                  toStatus: STEP_TO[s],
                  actorRole: "shop_staff",
                  note:
                    s === "hand_over"
                      ? `Courier: [TEST] RedX, tracking: RX-${o.key}`
                      : s === "cancel"
                        ? "[TEST] Size no longer available"
                        : s === "refuse"
                          ? "[TEST] Customer refused at the door"
                          : null,
                  restocked: s === "cancel" || s === "mark_returned",
                  at: at(hoursAgo),
                })),
              },
            },
          ],
        },
      },
    });
    created++;
  }

  // COD collections for the delivered ones (as the lifecycle records them), then one paid payout.
  let collections = 0;
  for (const key of ["LCP", "LCQ", "LCR", "LCW"]) {
    const so = await prisma.shopOrder.findFirst({
      where: { order: { idempotencyKey: `seed:lifecycle:${key}` }, status: "delivered" },
      select: { id: true, shopId: true, total: true, itemsSubtotal: true, commissionAmount: true, deliveredAt: true },
    });
    if (!so?.deliveredAt || (await prisma.codCollection.findUnique({ where: { shopOrderId: so.id } }))) continue;
    const totalPaisa = Math.round(Number(so.total) * 100);
    const itemsPaisa = Math.round(Number(so.itemsSubtotal) * 100);
    await prisma.codCollection.create({
      data: {
        shopOrderId: so.id,
        shopId: so.shopId,
        amount: money(totalPaisa),
        itemsAmount: money(itemsPaisa),
        deliveryCharge: money(totalPaisa - itemsPaisa),
        commission: so.commissionAmount,
        collectedAt: so.deliveredAt,
        source: "auto_on_delivery",
        payoutDueAt: new Date(so.deliveredAt.getTime() + 10 * 24 * HOUR),
      },
    });
    collections++;
  }

  const payoutId = "seed-payout-tech-1";
  if (!(await prisma.payout.findUnique({ where: { id: payoutId } }))) {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@ecom.test" }, select: { id: true } });
    const paidRows = await prisma.codCollection.findMany({
      where: { shopOrder: { order: { idempotencyKey: { in: ["seed:lifecycle:LCQ", "seed:lifecycle:LCR"] } } }, payoutId: null },
    });
    if (paidRows.length) {
      const sum = (pick: (r: (typeof paidRows)[number]) => unknown) => paidRows.reduce((a, r) => a + Math.round(Number(pick(r)) * 100), 0);
      const gross = sum((r) => r.amount);
      const commission = sum((r) => r.commission);
      const times = paidRows.map((r) => r.collectedAt.getTime());
      const paidAt = new Date(Math.max(...times) + 3 * 24 * HOUR);
      await prisma.payout.create({
        data: {
          id: payoutId,
          shopId: paidRows[0].shopId,
          periodStart: new Date(Math.min(...times)),
          periodEnd: new Date(Math.max(...times)),
          collectionCount: paidRows.length,
          gross: money(gross),
          commission: money(commission),
          deliveryCharges: money(sum((r) => r.deliveryCharge)),
          deliveryChargesTo: "shop",
          net: money(gross - commission),
          status: "paid",
          dueAt: new Date(Math.min(...paidRows.map((r) => r.payoutDueAt.getTime()))),
          createdById: admin.id,
          paidAt,
          method: "bank_transfer",
          reference: "[TEST] BEFTN-0001",
          recordedById: admin.id,
        },
      });
      await prisma.codCollection.updateMany({ where: { id: { in: paidRows.map((r) => r.id) } }, data: { payoutId, paidOutAt: paidAt } });
    }
  }
  console.info(`Seeded ${created} new lifecycle orders (${orders.length} in the seed, overdue: LCJ), ${collections} COD collections and the paid payout ${payoutId}`);
}

async function main() {
  assertSeedAllowed();
  await seedUsers();
  await seedCatalog();
  await seedShops();
  await seedAccounts();
  await seedPolicies();
  await seedProducts();
  await seedWishlist();
  await seedCart();
  await seedOrders();
  await seedReviews();
  await seedOrderLifecycle();
  await seedSearchIndex();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
