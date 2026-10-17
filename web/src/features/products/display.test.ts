import { describe, expect, it } from "vitest";
import { leafChoices, priceRange, variantLabel } from "./display";

const cat = (id: string, name: string, path: string, isLeaf: boolean, requiresLicence = false) => ({
  id,
  name,
  path,
  isLeaf,
  archivedAt: null,
  requiresLicence,
});

describe("leafChoices", () => {
  const categories = [
    cat("e", "Electronics", "/e/", false),
    cat("c", "Computer Components", "/e/c/", false),
    cat("p", "Processor", "/e/c/p/", true),
    cat("m", "Medicine", "/m/", false, true),
    cat("pr", "Pain Relief", "/m/pr/", true, true),
    { ...cat("old", "Old leaf", "/e/old/", true), archivedAt: new Date() },
  ];

  it("lists active leaves with their path; licence-only leaves only for medicine shops", () => {
    expect(leafChoices(categories, { includeLicensed: false })).toEqual([
      { id: "p", label: "Electronics › Computer Components › Processor", requiresLicence: false },
    ]);
    expect(leafChoices(categories, { includeLicensed: true }).map((c) => c.label)).toEqual([
      "Electronics › Computer Components › Processor",
      "Medicine › Pain Relief",
    ]);
  });
});

describe("priceRange / variantLabel", () => {
  it("formats Tk prices and ranges", () => {
    expect(priceRange(["1850.00"])).toBe("Tk 1,850");
    expect(priceRange(["1200.50", "1850.00", "1500"])).toBe("Tk 1,200.50 – Tk 1,850");
    expect(priceRange([])).toBe("—");
  });

  it("names a variant by its axis labels", () => {
    const axes = [
      { key: "size", name: "Size", options: [{ value: "m", label: "M" }] },
      { key: "colour", name: "Colour", options: [{ value: "black", label: "Black" }] },
    ];
    expect(variantLabel({ colour: "black", size: "m" }, axes)).toBe("Size: M, Colour: Black");
    expect(variantLabel({}, [])).toBe("Default");
  });
});
