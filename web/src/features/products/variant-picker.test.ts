import { describe, expect, it } from "vitest";
import type { AxisView, VariantView } from "./detail";
import { findVariant, optionAvailable, stockText } from "./variant-picker";

const axes: AxisView[] = [
  { key: "size", name: "Size", options: [{ value: "m", label: "M" }, { value: "l", label: "L" }] },
  { key: "colour", name: "Colour", options: [{ value: "black", label: "Black" }, { value: "white", label: "White" }] },
];
const v = (id: string, size: string, colour: string, stock: number): VariantView => ({
  id,
  options: { size, colour },
  price: 1850,
  stock,
  label: `Size: ${size}, Colour: ${colour}`,
});
const variants = [v("m-black", "m", "black", 6), v("m-white", "m", "white", 2), v("l-black", "l", "black", 4), v("l-white", "l", "white", 0)];

describe("findVariant", () => {
  it("finds the variant once every axis is chosen", () => {
    expect(findVariant(variants, axes, {})).toBeNull();
    expect(findVariant(variants, axes, { size: "m" })).toBeNull();
    expect(findVariant(variants, axes, { size: "m", colour: "white" })?.id).toBe("m-white");
    expect(findVariant(variants, axes, { size: "xl", colour: "white" })).toBeNull();
  });

  it("uses the only variant of a product without options", () => {
    const single: VariantView = { id: "only", options: {}, price: 250, stock: 3, label: "Default" };
    expect(findVariant([single], [], {})?.id).toBe("only");
  });
});

describe("optionAvailable", () => {
  it("disables out-of-stock combinations given the other choices", () => {
    expect(optionAvailable(variants, axes, {}, "size", "l")).toBe(true); // L Black has stock
    expect(optionAvailable(variants, axes, { colour: "white" }, "size", "l")).toBe(false); // L White: 0
    expect(optionAvailable(variants, axes, { colour: "white" }, "size", "m")).toBe(true);
    expect(optionAvailable(variants, axes, { size: "l" }, "colour", "white")).toBe(false);
    // The axis's own current choice does not restrict its options.
    expect(optionAvailable(variants, axes, { size: "m", colour: "black" }, "size", "l")).toBe(true);
  });

  it("disables an option whose every variant is out of stock", () => {
    const out = variants.map((x) => (x.options.size === "l" ? { ...x, stock: 0 } : x));
    expect(optionAvailable(out, axes, {}, "size", "l")).toBe(false);
  });
});

describe("stockText", () => {
  it("shows stock for the selection", () => {
    expect(stockText(variants[0], axes, variants)).toBe("In stock: 6 available");
    expect(stockText(variants[3], axes, variants)).toBe("Out of stock");
    expect(stockText(null, axes, variants)).toBe("Choose size and colour to see stock");
    expect(stockText(null, axes.slice(0, 1), variants)).toBe("Choose size to see stock");
    expect(stockText(null, axes, variants.map((x) => ({ ...x, stock: 0 })))).toBe("Out of stock");
  });
});
