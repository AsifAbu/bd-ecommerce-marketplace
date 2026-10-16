/**
 * Test helper: a tiny in-memory stand-in for the Prisma calls repositories make, so shop-scoping
 * (ADR-004) can be tested without a database. One table per key of `seed`, plus `auditLog`.
 *
 * `where` supports equality (null matches a missing field), the operators in / notIn / not /
 * gt / gte / lt / lte / equals, AND / OR / NOT, and to-one relation filters by the `<name>Id`
 * convention (e.g. `{ shop: { status: "approved" } }` on a row with `shopId`).
 * include / select / orderBy and nested writes are ignored.
 */
export type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const OPERATORS = new Set(["in", "notIn", "not", "gt", "gte", "lt", "lte", "equals"]);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
const plain = (v: unknown) => (v instanceof Date ? v.getTime() : v);
const same = (a: unknown, b: unknown) => (a == null && b == null) || plain(a) === plain(b);

type Tables = Record<string, { rows: Row[] }>;

function fieldMatches(value: unknown, cond: unknown): boolean {
  if (!isObject(cond) || !Object.keys(cond).every((k) => OPERATORS.has(k))) return same(value, cond);
  return Object.entries(cond).every(([op, arg]) => {
    const v = plain(value) as number;
    const a = plain(arg) as number;
    switch (op) {
      case "in":
        return (arg as unknown[]).some((x) => same(value, x));
      case "notIn":
        return !(arg as unknown[]).some((x) => same(value, x));
      case "not":
        return !fieldMatches(value, arg);
      case "equals":
        return same(value, arg);
      case "gt":
        return value != null && v > a;
      case "gte":
        return value != null && v >= a;
      case "lt":
        return value != null && v < a;
      case "lte":
        return value != null && v <= a;
      default:
        return false;
    }
  });
}

function matches(row: Row, where: Where | undefined, tables: Tables): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (cond === undefined) return true;
    if (key === "AND") return (Array.isArray(cond) ? cond : [cond]).every((w) => matches(row, w as Where, tables));
    if (key === "OR") return (cond as Where[]).some((w) => matches(row, w, tables));
    if (key === "NOT") return (Array.isArray(cond) ? cond : [cond]).every((w) => !matches(row, w as Where, tables));
    const related = tables[key];
    if (isObject(cond) && !(key in row) && related && `${key}Id` in row) {
      const target = related.rows.find((r) => r.id === row[`${key}Id`]);
      return !!target && matches(target, cond, tables);
    }
    return fieldMatches(row[key], cond);
  });
}

const copy = (row: Row | null) => (row ? { ...row } : null);

function table(rows: Row[], tables: Tables, name: string) {
  let seq = rows.length;
  const find = (where?: Where) => rows.filter((r) => matches(r, where, tables));
  const create = ({ data }: { data: Row }) => {
    const row = { id: `${name}-new-${++seq}`, ...data };
    rows.push(row);
    return row;
  };
  return {
    rows,
    // Reads return copies, like Prisma: later writes don't change rows the caller already read.
    findFirst: async ({ where }: { where?: Where } = {}) => copy(find(where)[0] ?? null),
    findUnique: async ({ where }: { where?: Where }) => copy(find(where)[0] ?? null),
    findMany: async ({ where }: { where?: Where } = {}) => find(where).map((r) => ({ ...r })),
    count: async ({ where }: { where?: Where } = {}) => find(where).length,
    create: async (args: { data: Row }) => create(args),
    createMany: async ({ data }: { data: Row[] }) => {
      data.forEach((d) => create({ data: d }));
      return { count: data.length };
    },
    update: async ({ where, data }: { where: Where; data: Row }) => {
      const row = find(where)[0];
      if (!row) throw new Error(`fake-db: no ${name} row to update`);
      return Object.assign(row, data);
    },
    updateMany: async ({ where, data }: { where?: Where; data: Row }) => {
      const hit = find(where);
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    delete: async ({ where }: { where: Where }) => {
      const row = find(where)[0];
      if (!row) throw new Error(`fake-db: no ${name} row to delete`);
      rows.splice(rows.indexOf(row), 1);
      return row;
    },
    deleteMany: async ({ where }: { where?: Where } = {}) => {
      const keep = rows.filter((r) => !matches(r, where, tables));
      const count = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return { count };
    },
  };
}

export type FakeTable = ReturnType<typeof table>;

export function createFakeDb<K extends string>(seed: Partial<Record<K, Row[]>>) {
  const tables: Record<string, FakeTable> = {};
  for (const [name, rows] of Object.entries(seed) as [string, Row[]][]) tables[name] = table(rows, tables, name);
  tables.auditLog ??= table([], tables, "auditLog");
  const db = {
    ...(tables as Record<K | "auditLog", FakeTable>),
    $transaction: async (ops: unknown) =>
      typeof ops === "function" ? (ops as (tx: unknown) => Promise<unknown>)(db) : Promise.all(ops as Promise<unknown>[]),
  };
  return db;
}
