import { describe, expect, it } from "vitest";
import { applicationSchema, fieldErrors, nidSchema, profileSchema, upgradeSchema, type SchemaContext } from "./schemas";

const now = new Date("2026-10-16T06:00:00Z");
const prod: SchemaContext = { testMode: false, now };
const test: SchemaContext = { testMode: true, now };

const pdf = () => new File(["%PDF-1.4"], "licence.pdf", { type: "application/pdf" });
const photo = () => new File(["img"], "me.jpg", { type: "image/jpeg" });
const empty = () => new File([], "", { type: "application/octet-stream" });

const base = { name: "Dhaka Books", slug: "dhaka-books", type: "books", ownerNid: "1234567890", ownerPhoto: photo() };

function errors(ctx: SchemaContext, input: Record<string, unknown>) {
  const r = applicationSchema(ctx).safeParse(input);
  return r.success ? {} : fieldErrors(r.error);
}

describe("NID", () => {
  it.each(["1234567890", "1234567890123", "12345678901234567"])("accepts %s", (nid) => {
    expect(nidSchema.safeParse(nid).success).toBe(true);
  });
  it.each(["", "123456789", "12345678901", "12345678901234", "12345abcde", "1234 567890"])("rejects %j", (nid) => {
    expect(nidSchema.safeParse(nid).success).toBe(false);
  });
});

describe("shop application", () => {
  it("accepts a general shop without licence fields (empty file inputs ignored)", () => {
    const r = applicationSchema(prod).safeParse({ ...base, licenceNo: "", licenceExpiry: "", licenceFile: empty() });
    expect(r.success).toBe(true);
  });

  it("requires a valid NID and the owner photo", () => {
    const e = errors(prod, { ...base, ownerNid: "12", ownerPhoto: empty() });
    expect(e.ownerNid).toMatch(/10, 13 or 17 digits/);
    expect(e.ownerPhoto).toBe("Owner photo is required");
  });

  it("rejects a bad slug", () => {
    expect(errors(prod, { ...base, slug: "Bad Slug!" }).slug).toBeDefined();
  });

  it("blocks a medicine shop without licence number, expiry date and certificate", () => {
    const e = errors(prod, { ...base, type: "medicine", licenceNo: "", licenceExpiry: "", licenceFile: empty() });
    expect(e).toMatchObject({
      licenceNo: "Licence number is required",
      licenceExpiry: "Expiry date is required",
      licenceFile: "Licence certificate is required",
    });
  });

  it("blocks a medicine shop with an expired licence", () => {
    const e = errors(prod, { ...base, type: "medicine", licenceNo: "DGDA-1", licenceExpiry: "2026-10-16", licenceFile: pdf() });
    expect(e.licenceExpiry).toMatch(/expired/);
  });

  it("accepts a complete medicine application", () => {
    const r = applicationSchema(prod).safeParse({
      ...base,
      type: "medicine",
      licenceNo: "DGDA-1",
      licenceExpiry: "2027-06-30",
      licenceFile: pdf(),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.licenceExpiry).toEqual(new Date("2027-06-30T00:00:00Z"));
  });

  it("production accepts only PDF or images; test mode accepts any file", () => {
    const odd = new File(["x"], "cert.docx", { type: "application/msword" });
    const input = { ...base, type: "medicine", licenceNo: "DGDA-1", licenceExpiry: "2027-06-30", licenceFile: odd };
    expect(errors(prod, input).licenceFile).toMatch(/PDF/);
    expect(applicationSchema(test).safeParse(input).success).toBe(true);
  });

  it("rejects files over 4 MB", () => {
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    expect(errors(test, { ...base, ownerPhoto: big }).ownerPhoto).toMatch(/4 MB/);
  });
});

describe("Verified upgrade", () => {
  it("requires registration type, number and document", () => {
    const r = upgradeSchema(prod).safeParse({ registrationType: "", registrationNo: "", registrationDoc: empty() });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error)).sort()).toEqual(["registrationDoc", "registrationNo", "registrationType"]);
  });

  it.each(["trade_licence", "vat", "tin", "ubid", "pra", "dbid"])("accepts registration type %s", (t) => {
    expect(upgradeSchema(prod).safeParse({ registrationType: t, registrationNo: "TL-1", registrationDoc: pdf() }).success).toBe(true);
  });
});

describe("shop profile: free-delivery threshold (US-058)", () => {
  const parse = (freeDeliveryThreshold: string) => profileSchema.safeParse({ freeDeliveryThreshold });

  it("empty means no free delivery", () => {
    expect(parse("")).toMatchObject({ success: true, data: { freeDeliveryThreshold: undefined } });
    expect(parse("  ")).toMatchObject({ success: true, data: { freeDeliveryThreshold: undefined } });
  });

  it("accepts a Tk amount, with commas or 2 decimals", () => {
    expect(parse("2000")).toMatchObject({ success: true, data: { freeDeliveryThreshold: 2000 } });
    expect(parse("1,500.50")).toMatchObject({ success: true, data: { freeDeliveryThreshold: 1500.5 } });
  });

  it("rejects text, zero, negatives, too many decimals and huge amounts", () => {
    for (const bad of ["free", "0", "-5", "10.123", "2000000"]) expect(parse(bad).success).toBe(false);
  });
});
