/**
 * Test data only. `npm run seed` (idempotent: safe to run again).
 * Feature agents extend this file with their own seed blocks.
 * All accounts use the password TEST_PASSWORD and @ecom.test emails.
 * Remove all seed data before release (pre-release checklist).
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/features/auth/password";

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

async function main() {
  await seedUsers();
  await seedAccounts();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
