import { describe, expect, it } from "vitest";
import { createAddressRepo, type AddressDb } from "./address-repo";
import { DISTRICTS_BY_DIVISION, DIVISIONS, districtsOf, upazilasOf } from "./locations";
import { addressSchema, type AddressInput } from "./schemas";

const valid = {
  name: "Rahim",
  phone: "01712345678",
  division: "Dhaka",
  district: "Dhaka",
  upazila: "Dhanmondi",
  area: "Road 27",
  line1: "House 12, Flat 3B",
  isDefault: "on",
};

describe("locations", () => {
  it("has all 8 divisions and 64 districts", () => {
    expect(DIVISIONS).toHaveLength(8);
    const all = Object.values(DISTRICTS_BY_DIVISION).flat();
    expect(all).toHaveLength(64);
    expect(new Set(all).size).toBe(64);
  });

  it("lists Dhaka district upazilas and thanas", () => {
    expect(upazilasOf("Dhaka")).toEqual(expect.arrayContaining(["Savar", "Dhamrai", "Keraniganj", "Gulshan", "Mirpur Model"]));
    expect(upazilasOf("Unknown")).toEqual([]);
    expect(districtsOf("constructor")).toEqual([]);
  });
});

describe("address validation", () => {
  it("accepts a Bangladesh address and normalises the phone", () => {
    const res = addressSchema.safeParse(valid);
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({ phone: "+8801712345678", isDefault: true });
  });

  it("rejects a district outside the chosen division", () => {
    const res = addressSchema.safeParse({ ...valid, division: "Sylhet" });
    expect(res.error?.issues[0]).toMatchObject({ path: ["district"] });
  });

  it("rejects an upazila outside a district with a known list", () => {
    const res = addressSchema.safeParse({ ...valid, upazila: "Patiya" });
    expect(res.error?.issues[0]).toMatchObject({ path: ["upazila"] });
  });

  it("accepts a typed upazila where the list is not loaded yet", () => {
    const res = addressSchema.safeParse({ ...valid, division: "Barishal", district: "Bhola", upazila: "Char Fasson" });
    expect(res.success).toBe(true);
  });

  it("rejects unknown divisions, bad phones and empty fields", () => {
    const res = addressSchema.safeParse({ ...valid, division: "Kolkata", phone: "12345", area: "", line1: "" });
    const paths = res.error?.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["division", "phone", "area", "line1"]));
  });
});

/** Minimal in-memory stand-in for prisma.address honouring flat `where` filters. */
function fakeDb() {
  type Row = AddressInput & { id: string; userId: string; createdAt: Date };
  let rows: Row[] = [];
  let n = 0;
  const match = (r: Row, where: Partial<Row> = {}) =>
    Object.entries(where).every(([k, v]) => r[k as keyof Row] === v);
  const address = {
    findMany: async ({ where }: { where: Partial<Row> }) => rows.filter((r) => match(r, where)),
    findFirst: async ({ where }: { where: Partial<Row> }) => rows.find((r) => match(r, where)) ?? null,
    count: async ({ where }: { where: Partial<Row> }) => rows.filter((r) => match(r, where)).length,
    create: async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => {
      const row = { ...data, id: `a${++n}`, createdAt: new Date(n) };
      rows.push(row);
      return row;
    },
    updateMany: async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    deleteMany: async ({ where }: { where: Partial<Row> }) => {
      const before = rows.length;
      rows = rows.filter((r) => !match(r, where));
      return { count: before - rows.length };
    },
  };
  const db = { address, $transaction: (fn: (tx: unknown) => unknown) => fn({ address }) } as unknown as AddressDb;
  return { db, rows: () => rows };
}

describe("address repo (scoped by user)", () => {
  const input = addressSchema.parse({ ...valid, isDefault: "" });

  it("makes the first address default and keeps one default", async () => {
    const { db, rows } = fakeDb();
    const repo = createAddressRepo(db);
    const a = await repo.create("u1", input);
    const b = await repo.create("u1", { ...input, isDefault: true });
    expect(rows().map((r) => [r.id, r.isDefault])).toEqual([
      [a.id, false],
      [b.id, true],
    ]);
    await repo.setDefault("u1", a.id);
    expect(rows().filter((r) => r.isDefault).map((r) => r.id)).toEqual([a.id]);
    await repo.remove("u1", a.id);
    expect(rows().filter((r) => r.isDefault).map((r) => r.id)).toEqual([b.id]);
  });

  it("never returns or changes another user's address", async () => {
    const { db, rows } = fakeDb();
    const repo = createAddressRepo(db);
    const mine = await repo.create("u1", input);
    const theirs = await repo.create("u2", input);

    expect((await repo.list("u1")).map((r) => r.id)).toEqual([mine.id]);
    expect(await repo.get("u1", theirs.id)).toBeNull();
    expect(await repo.update("u1", theirs.id, { ...input, name: "Hacked" })).toBe(false);
    expect(await repo.setDefault("u1", theirs.id)).toBe(false);
    expect(await repo.remove("u1", theirs.id)).toBe(false);
    expect(rows().find((r) => r.id === theirs.id)).toMatchObject({ name: "Rahim", userId: "u2", isDefault: true });
  });
});
