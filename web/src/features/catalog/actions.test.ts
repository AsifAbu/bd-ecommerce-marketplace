import { beforeEach, describe, expect, it, vi } from "vitest";
import { resultFields } from "@/lib/actions";
import { createGuards, type GuardUser } from "@/lib/auth/guards-core";

// The session user for each test; guards run the real role logic against it.
let sessionUser: GuardUser | null = null;

vi.mock("@/lib/auth", async () => {
  const errors = await vi.importActual<typeof import("@/lib/auth/errors")>("@/lib/auth/errors");
  const guards = createGuards({
    getSessionUserId: async () => sessionUser?.id,
    findUserById: async () => sessionUser,
  });
  const { createShopGuard } = await vi.importActual<typeof import("@/lib/auth/shop-guard-core")>("@/lib/auth/shop-guard-core");
  const requireShopRole = createShopGuard({
    requireUser: guards.requireUser,
    findShopRole: async (shopId, userId) => (shopId === "s1" && userId === "c1" ? "staff" : null),
  });
  return { ...errors, ...guards, requireShopRole };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./service", () => ({
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  moveCategory: vi.fn(),
  archiveCategory: vi.fn(),
  addOtherLeaf: vi.fn(),
  updateCategorySettings: vi.fn(),
  createAttribute: vi.fn(),
  addAttributeOption: vi.fn(),
  approveAttributeOption: vi.fn(),
  archiveAttribute: vi.fn(),
  assignAttribute: vi.fn(),
  unassignAttribute: vi.fn(),
  decideCategoryRequest: vi.fn(),
  createCategoryRequest: vi.fn(),
}));

const actions = await import("./actions");
const service = await import("./service");

const customer: GuardUser = {
  id: "c1",
  email: "c@ecom.test",
  phone: null,
  name: "Customer",
  isPlatformAdmin: false,
  status: "active",
};
const admin: GuardUser = { ...customer, id: "a1", isPlatformAdmin: true };

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

// Every admin action with a valid form, and the service function it calls.
const adminCases = [
  [actions.createCategoryAction, { name: "Graphics Card" }, service.createCategory],
  [actions.renameCategoryAction, { id: "x", name: "GPU" }, service.renameCategory],
  [actions.moveCategoryAction, { id: "x", parentId: "" }, service.moveCategory],
  [actions.archiveCategoryAction, { id: "x" }, service.archiveCategory],
  [actions.addOtherLeafAction, { parentId: "x" }, service.addOtherLeaf],
  [actions.updateCategorySettingsAction, { id: "x", commissionRate: "5" }, service.updateCategorySettings],
  [actions.createAttributeAction, { key: "socket", name: "Socket", type: "enum", options: "AM5, LGA1700" }, service.createAttribute],
  [actions.addAttributeOptionAction, { attributeId: "x", label: "AM6" }, service.addAttributeOption],
  [actions.approveAttributeOptionAction, { optionId: "x" }, service.approveAttributeOption],
  [actions.archiveAttributeAction, { id: "x" }, service.archiveAttribute],
  [actions.assignAttributeAction, { categoryId: "c", attributeId: "a", displayOrder: "1" }, service.assignAttribute],
  [actions.unassignAttributeAction, { categoryId: "c", attributeId: "a" }, service.unassignAttribute],
  [actions.decideCategoryRequestAction, { requestId: "r", decision: "approve" }, service.decideCategoryRequest],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  sessionUser = null;
});

describe("catalog admin actions", () => {
  it.each(adminCases)("%o returns 403 for a non-admin and changes nothing", async (action, data, call) => {
    sessionUser = customer;
    const result = await action(undefined, form(data));
    expect(result).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(call).not.toHaveBeenCalled();
  });

  it.each(adminCases)("%o returns 401 for a guest", async (action, data, call) => {
    const result = await action(undefined, form(data));
    expect(result).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(call).not.toHaveBeenCalled();
  });

  it.each(adminCases)("%o runs for the Platform Admin as the actor", async (action, data, call) => {
    sessionUser = admin;
    const result = await action(undefined, form(data));
    expect(result).toEqual({ ok: true, message: expect.any(String) });
    expect(call).toHaveBeenCalledOnce();
    expect(vi.mocked(call).mock.calls[0][0]).toBe("a1");
  });

  it("returns 422 with field messages for invalid input", async () => {
    sessionUser = admin;
    const result = await actions.createAttributeAction(undefined, form({ key: "Bad Key", name: "", type: "enum" }));
    expect(result).toMatchObject({ error: { code: "VALIDATION" } });
    expect(Object.keys(resultFields(result))).toEqual(expect.arrayContaining(["key", "name"]));
    expect(service.createAttribute).not.toHaveBeenCalled();
  });

  it("parses assignment settings from the form", async () => {
    sessionUser = admin;
    await actions.assignAttributeAction(
      undefined,
      form({ categoryId: "c", attributeId: "a", required: "on", filterable: "on", filterWidget: "checkbox_list", displayOrder: "2" }),
    );
    expect(service.assignAttribute).toHaveBeenCalledWith("a1", "c", {
      attributeId: "a",
      required: true,
      filterable: true,
      filterWidget: "checkbox_list",
      displayOrder: 2,
      isVariantAxis: false,
    });
  });
});

describe("category requests (sellers)", () => {
  it("lets a member of the shop send a request for that shop", async () => {
    sessionUser = customer;
    const result = await actions.createCategoryRequestAction(
      undefined,
      form({ kind: "enum_option", shopId: "s1", attributeId: "brand", name: "Team Group" }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(service.createCategoryRequest).toHaveBeenCalledWith("c1", {
      kind: "enum_option",
      shopId: "s1",
      attributeId: "brand",
      name: "Team Group",
    });
  });

  it("returns 403 for a shop the user doesn't belong to", async () => {
    sessionUser = customer;
    const result = await actions.createCategoryRequestAction(
      undefined,
      form({ kind: "category", shopId: "other-shop", parentId: "p", name: "GPU" }),
    );
    expect(result).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(service.createCategoryRequest).not.toHaveBeenCalled();
  });

  it("returns 401 for a guest", async () => {
    const result = await actions.createCategoryRequestAction(undefined, form({ kind: "category", parentId: "p", name: "GPU" }));
    expect(result).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(service.createCategoryRequest).not.toHaveBeenCalled();
  });
});
