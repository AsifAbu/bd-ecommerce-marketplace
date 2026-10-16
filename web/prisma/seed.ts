/**
 * Test data only. `npm run seed` (idempotent: safe to run again).
 * Feature agents extend this file with their own seed blocks.
 * All accounts use the password TEST_PASSWORD and @ecom.test emails.
 * Remove all seed data before release (pre-release checklist).
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/features/auth/password";
import { getStorage } from "../src/lib/storage";

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
      name: "[TEST] Customer, verified phone",
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

/**
 * Shops (US-010 to US-017): Tech, Fashion and Pharmacy are Verified, Books is Basic. All approved.
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
      status: "approved",
      statusReason: null,
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

async function main() {
  await seedUsers();
  await seedShops();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
