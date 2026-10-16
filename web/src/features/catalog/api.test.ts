import { describe, expect, it, vi } from "vitest";

vi.mock("./service", () => ({ getCategorySchema: vi.fn() }));

const { schemaResponse } = await import("./api");
const { buildEffectiveSchema } = await import("./schema");
const { CatalogError } = await import("./errors");

const category = {
  id: "cpu",
  name: "Processor",
  isLeaf: true,
  isOther: false,
  archivedAt: null,
  requiresLicence: false,
  requiresExpiry: false,
};

describe("GET /api/categories/:id/schema", () => {
  it("returns the effective schema of a leaf", async () => {
    const res = await schemaResponse("cpu", async () => buildEffectiveSchema({ category, assignments: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categoryId).toBe("cpu");
    expect(body.fields.map((f: { key: string }) => f.key)).toContain("return_eligibility");
  });

  it("returns 422 in the standard error shape for a non-leaf", async () => {
    const res = await schemaResponse("electronics", async () =>
      buildEffectiveSchema({ category: { ...category, isLeaf: false }, assignments: [] }),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: { code: "CATEGORY_NOT_LEAF", message: expect.any(String) } });
  });

  it("returns 404 for an unknown category", async () => {
    const res = await schemaResponse("nope", async () => {
      throw new CatalogError(404, "NOT_FOUND", "Category not found");
    });
    expect(res.status).toBe(404);
  });
});
