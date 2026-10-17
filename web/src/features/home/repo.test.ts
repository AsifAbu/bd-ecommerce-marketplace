import { describe, expect, it, vi } from "vitest";
import { liveProductWhere } from "@/features/products";

const findMany = vi.hoisted(() => vi.fn(async () => []));
vi.mock("@/lib/db", () => ({ prisma: { product: { findMany }, category: { findUnique: vi.fn(async () => ({ path: "/root/" })) } } }));

const repo = await import("./repo");
const TODAY = new Date("2026-10-17T00:00:00Z");

describe("home repo reads live products only", () => {
  it("homeWhere is the live definition plus in-stock", () => {
    expect(repo.homeWhere(TODAY)).toEqual({ AND: [liveProductWhere(TODAY), { variants: { some: { stock: { gt: 0 } } } }] });
  });

  it("new arrivals and category rows both filter through homeWhere", async () => {
    await repo.newArrivals(TODAY, 8);
    await repo.productsUnder(TODAY, "root", 4);
    const calls = findMany.mock.calls as unknown as [{ where: { AND?: unknown[] }; take: number }][];
    expect(calls[0][0].where).toEqual(repo.homeWhere(TODAY));
    expect(calls[1][0].where.AND?.[0]).toEqual(repo.homeWhere(TODAY));
    expect(calls[1][0].where.AND?.[1]).toEqual({ category: { path: { startsWith: "/root/" } } });
    expect(calls.map((c) => c[0].take)).toEqual([8, 4]);
  });

  it("converts rows to cards with the in-stock price range and a cover link", () => {
    const card = repo.toHomeProduct({
      id: "p1",
      title: "T",
      shop: { slug: "s", name: "S" },
      category: { name: "C" },
      variants: [{ price: { toString: () => "100" } }, { price: { toString: () => "250.50" } }],
      images: [{ id: "img 1" }],
    } as never);
    expect(card).toMatchObject({ priceMin: 100, priceMax: 250.5, imageUrl: "/api/product-images/img%201", rating: null });
  });
});
