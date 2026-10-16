import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory stand-in for the Prisma calls these service functions make.
const db = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id: string };
  const state = { categories: [] as Row[], attributes: [] as Row[], audit: [] as Row[] };
  const table = (rows: () => Row[]) => ({
    // Copies, like Prisma: later updates don't change rows the caller already read.
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = rows().find((r) => r.id === where.id);
      return row ? { ...row } : null;
    },
    findMany: async ({ where }: { where?: { path?: { startsWith: string } } } = {}) =>
      rows()
        .filter((r) => !where?.path || (r.path as string).startsWith(where.path.startsWith))
        .map((r) => ({ ...r })),
    count: async ({ where }: { where: { parentId: string; archivedAt: null } }) =>
      rows().filter((r) => r.parentId === where.parentId && !r.archivedAt).length,
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
      Object.assign(rows().find((r) => r.id === where.id)!, data),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  });
  const client = {
    category: table(() => state.categories),
    attribute: table(() => state.attributes),
    auditLog: { create: async ({ data }: { data: Row }) => state.audit.push(data) },
    $transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn(client),
  };
  return { state, client };
});
vi.mock("@/lib/db", () => ({ prisma: db.client }));

const service = await import("./service");

const cat = (id: string, parentId: string | null, path: string, isLeaf = true) => ({
  id,
  parentId,
  path,
  isLeaf,
  isOther: false,
  archivedAt: null as Date | null,
  name: id,
});

beforeEach(() => {
  db.state.categories = [
    cat("electronics", null, "/electronics/", false),
    cat("components", "electronics", "/electronics/components/", false),
    cat("cpu", "components", "/electronics/components/cpu/"),
    cat("books", null, "/books/"),
  ];
  db.state.attributes = [{ id: "socket", key: "socket", name: "Socket", type: "enum", archivedAt: null }];
  db.state.audit = [];
});

const byId = (id: string) => db.state.categories.find((c) => c.id === id)!;

describe("moveCategory", () => {
  it("rewrites the subtree paths and fixes leaf flags", async () => {
    await service.moveCategory("admin", "components", "books");
    expect(byId("components")).toMatchObject({ parentId: "books", path: "/books/components/" });
    expect(byId("cpu").path).toBe("/books/components/cpu/");
    expect(byId("electronics").isLeaf).toBe(true); // lost its only child
    expect(byId("books").isLeaf).toBe(false);
    expect(db.state.audit).toEqual([
      expect.objectContaining({ actorId: "admin", action: "category.moved", entityId: "components" }),
    ]);
  });

  it("refuses to move a category under its own subcategory", async () => {
    await expect(service.moveCategory("admin", "electronics", "cpu")).rejects.toMatchObject({ status: 422 });
    expect(byId("cpu").path).toBe("/electronics/components/cpu/");
    expect(db.state.audit).toEqual([]);
  });
});

describe("archiving", () => {
  it("archives an attribute without deleting it, and it stays readable", async () => {
    await service.archiveAttribute("admin", "socket");
    expect(db.client.attribute.delete).not.toHaveBeenCalled();
    const attr = await service.getAttribute("socket");
    expect(attr).toMatchObject({ key: "socket", archivedAt: expect.any(Date) });
    expect(db.state.audit).toEqual([expect.objectContaining({ action: "attribute.archived", entityId: "socket" })]);
  });

  it("archives only categories without active subcategories", async () => {
    await expect(service.archiveCategory("admin", "components")).rejects.toMatchObject({ status: 422 });
    await service.archiveCategory("admin", "cpu");
    expect(byId("cpu").archivedAt).toBeInstanceOf(Date);
    expect(byId("components").isLeaf).toBe(true);
    expect(db.client.category.delete).not.toHaveBeenCalled();
  });
});
