/**
 * Test helper: a tiny in-memory stand-in for the Prisma calls used by repo.ts.
 * `where` supports equality, `{ in: [...] }` and compound keys; include/select/orderBy are ignored.
 */
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (cond && typeof cond === "object" && "in" in cond) return (cond.in as unknown[]).includes(row[k]);
    // Compound unique keys, e.g. { shopId_userId: { shopId, userId } }.
    if (cond && typeof cond === "object" && !(cond instanceof Date)) return matches(row, cond as Where);
    return row[k] === cond;
  });
}

function table(rows: Row[]) {
  let seq = rows.length;
  return {
    rows,
    findFirst: async ({ where }: { where?: Where }) => rows.find((r) => matches(r, where)) ?? null,
    findUnique: async ({ where }: { where?: Where }) => rows.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }: { where?: Where } = {}) => rows.filter((r) => matches(r, where)),
    count: async ({ where }: { where?: Where } = {}) => rows.filter((r) => matches(r, where)).length,
    create: async ({ data }: { data: Row }) => {
      const row = { id: `new-${++seq}`, ...data };
      rows.push(row);
      return row;
    },
    upsert: async ({ where, create, update }: { where: Where; create: Row; update: Row }) => {
      const row = rows.find((r) => matches(r, where));
      if (row) return Object.assign(row, update);
      const created = { id: `new-${++seq}`, ...create };
      rows.push(created);
      return created;
    },
    updateMany: async ({ where, data }: { where?: Where; data: Row }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    deleteMany: async ({ where }: { where?: Where }) => {
      const keep = rows.filter((r) => !matches(r, where));
      const count = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return { count };
    },
  };
}

export function createFakeDb(seed: { shop?: Row[]; shopLicence?: Row[]; shopMember?: Row[]; shopInvite?: Row[]; user?: Row[] }) {
  const db = {
    shop: table(seed.shop ?? []),
    shopLicence: table(seed.shopLicence ?? []),
    shopMember: table(seed.shopMember ?? []),
    shopInvite: table(seed.shopInvite ?? []),
    user: table(seed.user ?? []),
    auditLog: table([]),
    $transaction: async (ops: unknown) =>
      typeof ops === "function" ? (ops as (tx: unknown) => Promise<unknown>)(db) : Promise.all(ops as Promise<unknown>[]),
  };
  return db;
}
