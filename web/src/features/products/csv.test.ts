import { describe, expect, it } from "vitest";
import { convertCell, csvTemplate, csvToProducts, CsvSyntaxError, parseCsv, templateColumns, toCsvLine } from "./csv";
import { processorSchema, shirtSchema, TODAY } from "./test-fixtures";

describe("parseCsv (RFC 4180)", () => {
  it("parses plain rows with CRLF or LF line ends", () => {
    expect(parseCsv("a,b,c\r\n1,2,3\n4,5,6")).toEqual([
      { line: 1, cells: ["a", "b", "c"] },
      { line: 2, cells: ["1", "2", "3"] },
      { line: 3, cells: ["4", "5", "6"] },
    ]);
  });

  it("handles quotes, escaped quotes, commas and line breaks inside quotes", () => {
    const records = parseCsv('title,description\n"Shirt, cotton","Line one\nline ""two"""\nnext,row\n');
    expect(records).toEqual([
      { line: 1, cells: ["title", "description"] },
      { line: 2, cells: ["Shirt, cotton", 'Line one\nline "two"'] },
      { line: 4, cells: ["next", "row"] },
    ]);
  });

  it("ignores a UTF-8 BOM and blank lines, keeps empty cells", () => {
    expect(parseCsv("﻿a,b\n\n,x\n\r\n")).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 3, cells: ["", "x"] },
    ]);
    expect(parseCsv('a,""')).toEqual([{ line: 1, cells: ["a", ""] }]);
  });

  it("keeps Bengali text", () => {
    expect(parseCsv("title\nহিমু")[1].cells).toEqual(["হিমু"]);
  });

  it("reports unclosed quotes and stray quotes with the line", () => {
    expect(() => parseCsv('a\n"open,field\nmore')).toThrow(CsvSyntaxError);
    expect(() => parseCsv('a\n"open,field\nmore')).toThrow(/Line 2/);
    expect(() => parseCsv('a\nab"c')).toThrow(/quote inside an unquoted field/);
    expect(() => parseCsv('"a"b')).toThrow(/after a closing quote/);
  });

  it("round-trips with toCsvLine", () => {
    const cells = ['He said "hi"', "a,b", "line\nbreak", "plain"];
    expect(parseCsv(toCsvLine(cells))[0].cells).toEqual(cells);
  });
});

describe("template (US-034)", () => {
  it("has the fixed columns, then product fields, then variant axes", () => {
    expect(templateColumns(shirtSchema()).map((c) => c.key)).toEqual([
      "handle", "title", "description", "sku", "price", "stock",
      "brand", "material", "features", "quantity", "quantity_unit", "weight_g", "model",
      "country_of_origin", "ingredients_materials", "return_eligibility", "warranty",
      "size", "colour",
    ]);
    expect(csvTemplate(processorSchema()).startsWith("﻿handle,title,description,sku,price,stock,brand,socket,")).toBe(true);
  });

  it("shows the allowed options per column", () => {
    const socket = templateColumns(processorSchema()).find((c) => c.key === "socket")!;
    expect(socket.help).toBe("One of: AM4, AM5, LGA1700");
    const features = templateColumns(shirtSchema()).find((c) => c.key === "features")!;
    expect(features.help).toContain("separate with |");
  });
});

describe("convertCell", () => {
  const [brand] = shirtSchema().fields;
  const features = shirtSchema().fields.find((f) => f.key === "features")!;
  const bool = processorSchema().fields.find((f) => f.key === "integrated_graphics")!;
  const num = processorSchema().fields.find((f) => f.key === "core_count")!;

  it("matches enum values or labels case-insensitively", () => {
    expect(convertCell(brand, "yellow")).toEqual({ value: "yellow" });
    expect(convertCell(brand, " YELLOW ")).toEqual({ value: "yellow" });
    expect(convertCell(brand, "Nike")).toEqual({ error: '"Nike" is not an allowed Brand option' });
  });

  it("splits multi-enum values on |", () => {
    expect(convertCell(features, "Stretch | wrinkle free")).toEqual({ value: ["stretch", "wrinkle-free"] });
    expect(convertCell(features, "Stretch|Bogus")).toEqual({ error: '"Bogus" not allowed for Features' });
  });

  it("reads booleans and numbers", () => {
    for (const [raw, value] of [["yes", true], ["No", false], ["TRUE", true], ["0", false]] as const) {
      expect(convertCell(bool, raw)).toEqual({ value });
    }
    expect(convertCell(bool, "maybe")).toEqual({ error: "Integrated graphics: use yes or no" });
    expect(convertCell(num, "1,200")).toEqual({ value: 1200 });
    expect(convertCell(num, "six")).toEqual({ error: "Core count must be a number" });
    expect(convertCell(num, "  ")).toEqual({});
  });
});

const SHIRT_HEADER =
  "handle,title,description,sku,price,stock,brand,material,features,quantity,quantity_unit,weight_g,model,country_of_origin,ingredients_materials,return_eligibility,warranty,size,colour";
const shirtRow = (handle: string, sku: string, size: string, colour: string, extra: Partial<Record<"title" | "price" | "brand", string>> = {}) =>
  `${handle},${extra.title ?? "Oxford shirt"},Cotton shirt,${sku},${extra.price ?? "1850"},5,${extra.brand ?? "Yellow"},Cotton,Stretch|Pocket,1,pcs,300,,Bangladesh,,eligible,,${size},${colour}`;

describe("csvToProducts", () => {
  it("groups rows by handle into one product with variants; an empty handle is its own product", () => {
    const csv = [SHIRT_HEADER, shirtRow("ox", "OX-M", "M", "Black"), shirtRow("ox", "OX-L", "L", "Black"), shirtRow("", "SOLO", "S", "White")].join("\n");
    const { products, errors } = csvToProducts(shirtSchema(), parseCsv(csv), TODAY);
    expect(errors).toEqual([]);
    expect(products).toHaveLength(2);
    expect(products[0].lines).toEqual([2, 3]);
    expect(products[0].input.variants.map((v) => v.optionKey)).toEqual(["colour=black;size=m", "colour=black;size=l"]);
    expect(products[0].input.attributes).toMatchObject({ brand: "yellow", features: ["stretch", "pocket"], quantity: 1 });
    expect(products[1].input.variants[0].sku).toBe("SOLO");
  });

  it("reads product columns from the handle's first row only", () => {
    const csv = [SHIRT_HEADER, shirtRow("ox", "OX-M", "M", "Black"), shirtRow("ox", "OX-L", "L", "Black", { title: "Ignored", brand: "Nope" })].join("\n");
    const { products, errors } = csvToProducts(shirtSchema(), parseCsv(csv), TODAY);
    expect(errors).toEqual([]);
    expect(products[0].input.title).toBe("Oxford shirt");
  });

  it("returns every error with its file line and column, and no products", () => {
    const csv = [
      SHIRT_HEADER,
      shirtRow("", "A1", "M", "Black", { brand: "Nike" }), // line 2: bad enum
      shirtRow("", "A2", "M", "Black", { price: "-3" }), // line 3: bad price
      shirtRow("dup", "A3", "M", "Black"), // line 4
      shirtRow("dup", "A4", "M", "Black"), // line 5: same options as line 4
      shirtRow("", "A1", "L", "Black"), // line 6: SKU used on line 2
    ].join("\n");
    const { products, errors } = csvToProducts(shirtSchema(), parseCsv(csv), TODAY);
    expect(products).toEqual([]);
    expect(errors).toEqual([
      { row: 2, column: "brand", message: '"Nike" is not an allowed Brand option' },
      { row: 3, column: "price", message: "Enter a price in Tk, e.g. 1250 or 1250.50" },
      { row: 5, message: "Same options as variant 1" },
      { row: 6, column: "sku", message: 'SKU "A1" is also used on line 2' },
    ]);
  });

  it("reports unknown and missing columns on the header line", () => {
    const { errors } = csvToProducts(processorSchema(), parseCsv("title,description,price,stock,isbn\nx,y,1,1,2"), TODAY);
    expect(errors).toContainEqual({ row: 1, column: "isbn", message: 'Unknown column "isbn": not a field of Processor' });
    expect(errors).toContainEqual({ row: 1, column: "socket", message: 'Missing required column "socket"' });
  });

  it("reports rows with the wrong number of cells and files without rows", () => {
    const header = templateColumns(processorSchema()).map((c) => c.key).join(",");
    expect(csvToProducts(processorSchema(), parseCsv(`${header}\na,b`), TODAY).errors).toEqual([
      { row: 2, message: `Expected ${header.split(",").length} columns, found 2` },
    ]);
    expect(csvToProducts(processorSchema(), parseCsv(header), TODAY).errors).toEqual([{ row: 1, message: "The file has no product rows" }]);
    expect(csvToProducts(processorSchema(), [], TODAY).errors).toEqual([{ row: 1, message: "The file is empty" }]);
  });
});
