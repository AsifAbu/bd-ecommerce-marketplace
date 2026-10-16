import type { CategorySchema, FieldDef } from "@/features/catalog";
import { ProductError, type ImportRowError } from "./errors";
import { formFields, validateProductInput, type ProductInput } from "./validation";

/**
 * CSV bulk import (US-034): an RFC 4180 parser, the per-category template, and the conversion of
 * rows into validated products. Rows sharing a handle form one product (product columns are
 * read from the handle's first row); a row with an empty handle is a product of its own.
 */

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 1024 * 1024;

// ---- Parser -------------------------------------------------------------------

export interface CsvRecord {
  /** File line number where the record starts (1-based). */
  line: number;
  cells: string[];
}

export class CsvSyntaxError extends Error {
  constructor(
    readonly line: number,
    message: string,
  ) {
    super(message);
    this.name = "CsvSyntaxError";
  }
}

/**
 * RFC 4180: comma-separated, fields optionally in double quotes, "" for a quote inside quotes,
 * commas and line breaks allowed inside quotes, CRLF or LF line ends. A leading UTF-8 BOM is
 * ignored and blank lines are skipped.
 */
export function parseCsv(text: string): CsvRecord[] {
  const src = text.startsWith("﻿") ? text.slice(1) : text;
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false; // inside a quoted field
  let wasQuoted = false; // current field was quoted (and is now closed)
  let line = 1;
  let recordLine = 1;

  const endField = () => {
    cells.push(field);
    field = "";
    wasQuoted = false;
  };
  const endRecord = () => {
    endField();
    if (!(cells.length === 1 && cells[0] === "")) records.push({ line: recordLine, cells });
    cells = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          wasQuoted = true;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === ",") {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else if (wasQuoted) {
      throw new CsvSyntaxError(line, `Line ${line}: unexpected text after a closing quote`);
    } else if (ch === '"') {
      if (field !== "") throw new CsvSyntaxError(line, `Line ${line}: a quote inside an unquoted field (wrap the whole field in quotes)`);
      quoted = true;
    } else {
      field += ch;
    }
  }
  if (quoted) throw new CsvSyntaxError(recordLine, `Line ${recordLine}: a quoted field is not closed`);
  if (field !== "" || wasQuoted || cells.length > 0) endRecord();
  return records;
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsvLine(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

// ---- Template -----------------------------------------------------------------

export interface TemplateColumn {
  key: string;
  name: string;
  level: "product" | "variant";
  required: boolean;
  /** What to enter, including the allowed options. */
  help: string;
  field?: FieldDef;
}

function fieldHelp(f: FieldDef): string {
  const options = f.options.map((o) => o.label).join(", ");
  switch (f.type) {
    case "enum":
      return `One of: ${options}`;
    case "multi_enum":
      return `One or more of: ${options} (separate with |)`;
    case "number":
      return f.unit ? `Number, in ${f.unit}` : "Number";
    case "boolean":
      return "yes or no";
    case "date":
      return "Date as YYYY-MM-DD (not in the past)";
    case "text":
      return "Text";
  }
}

/** Columns of the import template for a leaf category, in order. */
export function templateColumns(schema: CategorySchema): TemplateColumn[] {
  const { productFields, variantFields } = formFields(schema);
  const hasAxes = variantFields.length > 0;
  return [
    {
      key: "handle",
      name: "Handle",
      level: "product",
      required: false,
      help: hasAxes
        ? "Rows with the same handle are one product with several variants. Empty: the row is a product of its own"
        : "Leave empty (each row is one product)",
    },
    { key: "title", name: "Title", level: "product", required: true, help: "3 to 200 characters" },
    { key: "description", name: "Description", level: "product", required: true, help: "Up to 5000 characters" },
    { key: "sku", name: "SKU", level: "variant", required: false, help: "Your own stock code, unique in your shop" },
    { key: "price", name: "Price (Tk)", level: "variant", required: true, help: "More than 0, at most 2 decimals, e.g. 1250.50" },
    { key: "stock", name: "Stock", level: "variant", required: true, help: "Whole number, 0 or more" },
    ...productFields.map((f) => ({ key: f.key, name: f.name, level: "product" as const, required: f.required, help: fieldHelp(f), field: f })),
    ...variantFields.map((f) => ({ key: f.key, name: f.name, level: "variant" as const, required: f.required, help: fieldHelp(f), field: f })),
  ];
}

/** The template file: a UTF-8 BOM (so Excel reads Bengali text) and the header row. */
export function csvTemplate(schema: CategorySchema): string {
  return `﻿${toCsvLine(templateColumns(schema).map((c) => c.key))}\r\n`;
}

// ---- Rows to products ---------------------------------------------------------

const BOOLEANS: Record<string, boolean> = { yes: true, no: false, true: true, false: false, "1": true, "0": false };

function matchOption(f: FieldDef, raw: string): string | null {
  const v = raw.trim().toLowerCase();
  return f.options.find((o) => o.value.toLowerCase() === v || o.label.toLowerCase() === v)?.value ?? null;
}

/** Converts one cell to the field's JSON value. "" = not given. */
export function convertCell(f: FieldDef, raw: string): { value?: unknown } | { error: string } {
  const s = raw.trim();
  if (s === "") return {};
  switch (f.type) {
    case "text":
    case "date":
      return { value: s };
    case "number": {
      const n = s.replace(/,/g, "");
      return /^-?\d+(\.\d+)?$/.test(n) ? { value: Number(n) } : { error: `${f.name} must be a number` };
    }
    case "boolean": {
      const b = BOOLEANS[s.toLowerCase()];
      return b === undefined ? { error: `${f.name}: use yes or no` } : { value: b };
    }
    case "enum": {
      const v = matchOption(f, s);
      return v ? { value: v } : { error: `"${s}" is not an allowed ${f.name} option` };
    }
    case "multi_enum": {
      const parts = s.split("|").map((p) => p.trim()).filter(Boolean);
      const bad = parts.filter((p) => !matchOption(f, p));
      if (bad.length) return { error: `${bad.map((b) => `"${b}"`).join(", ")} not allowed for ${f.name}` };
      return { value: [...new Set(parts.map((p) => matchOption(f, p)!))] };
    }
  }
}

export interface ImportedProduct {
  /** File line of each variant row (the first is where the product columns were read). */
  lines: number[];
  input: ProductInput;
}

/**
 * Turns parsed records (header first) into validated products. Returns every problem found as
 * { row, column?, message }; the caller imports nothing if there is any.
 */
export function csvToProducts(
  schema: CategorySchema,
  records: CsvRecord[],
  today: Date,
): { products: ImportedProduct[]; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  if (records.length === 0) return { products: [], errors: [{ row: 1, message: "The file is empty" }] };

  const columns = templateColumns(schema);
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const [header, ...rows] = records;
  const keys = header.cells.map((h) => h.trim().toLowerCase());
  const seen = new Set<string>();
  keys.forEach((k, i) => {
    if (!byKey.has(k)) {
      const label = k || `column ${i + 1}`;
      errors.push({ row: header.line, column: label, message: `Unknown column "${label}": not a field of ${schema.name}` });
    } else if (seen.has(k)) errors.push({ row: header.line, column: k, message: `Column "${k}" appears twice` });
    seen.add(k);
  });
  for (const c of columns) {
    if (c.required && !seen.has(c.key)) errors.push({ row: header.line, column: c.key, message: `Missing required column "${c.key}"` });
  }
  if (errors.length) return { products: [], errors };
  if (rows.length === 0) return { products: [], errors: [{ row: header.line, message: "The file has no product rows" }] };

  // Group rows into products by handle.
  const groups: CsvRecord[][] = [];
  const byHandle = new Map<string, CsvRecord[]>();
  for (const r of rows) {
    if (r.cells.length !== keys.length) {
      errors.push({ row: r.line, message: `Expected ${keys.length} columns, found ${r.cells.length}` });
      continue;
    }
    const handle = r.cells[keys.indexOf("handle")]?.trim() ?? "";
    if (!handle) groups.push([r]);
    else if (byHandle.has(handle)) byHandle.get(handle)!.push(r);
    else {
      const g = [r];
      byHandle.set(handle, g);
      groups.push(g);
    }
  }

  const cell = (r: CsvRecord, key: string) => {
    const i = keys.indexOf(key);
    return i === -1 ? "" : r.cells[i];
  };
  const productColumns = columns.filter((c) => c.level === "product" && c.field);
  const variantColumns = columns.filter((c) => c.level === "variant" && c.field);
  const products: ImportedProduct[] = [];
  const skuLines = new Map<string, number>();

  for (const group of groups) {
    const first = group[0];
    const failed = new Set<string>(); // "line:column" with a conversion error
    const convert = (r: CsvRecord, cols: TemplateColumn[]) => {
      const out: Record<string, unknown> = {};
      for (const c of cols) {
        const result = convertCell(c.field!, cell(r, c.key));
        if ("error" in result) {
          errors.push({ row: r.line, column: c.key, message: result.error });
          failed.add(`${r.line}:${c.key}`);
        } else if (result.value !== undefined) out[c.key] = result.value;
      }
      return out;
    };
    const body = {
      title: cell(first, "title"),
      description: cell(first, "description"),
      attributes: convert(first, productColumns),
      variants: group.map((r) => ({
        sku: cell(r, "sku"),
        price: cell(r, "price"),
        stock: cell(r, "stock"),
        options: convert(r, variantColumns),
      })),
    };

    for (const r of group) {
      const sku = cell(r, "sku").trim();
      if (!sku) continue;
      const other = skuLines.get(sku);
      if (other !== undefined && !group.some((g) => g.line === other)) {
        errors.push({ row: r.line, column: "sku", message: `SKU "${sku}" is also used on line ${other}` });
      } else if (other === undefined) skuLines.set(sku, r.line);
    }

    try {
      products.push({ lines: group.map((r) => r.line), input: validateProductInput(schema, body, today) });
    } catch (err) {
      if (!(err instanceof ProductError) || !err.fields) throw err;
      for (const [key, message] of Object.entries(err.fields)) {
        const located = locate(key, group);
        if (located.column && failed.has(`${located.row}:${located.column}`)) continue;
        errors.push({ ...located, message });
      }
    }
  }

  errors.sort((a, b) => a.row - b.row);
  return { products: errors.length ? [] : products, errors };
}

/** Field-error key ("attributes.socket", "variants.1.price"...) to its file line and column. */
function locate(key: string, group: CsvRecord[]): { row: number; column?: string } {
  const parts = key.split(".");
  if (parts[0] === "variants" && parts.length > 1) {
    const row = group[Number(parts[1])]?.line ?? group[0].line;
    if (parts[2] === "options") return parts[3] ? { row, column: parts[3] } : { row };
    return parts[2] ? { row, column: parts[2] } : { row };
  }
  if (parts[0] === "attributes" && parts[1]) return { row: group[0].line, column: parts[1] };
  if (parts[0] === "title" || parts[0] === "description") return { row: group[0].line, column: parts[0] };
  return { row: group[0].line };
}
