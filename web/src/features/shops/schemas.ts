import { z } from "zod";
import { dhakaToday } from "./rules";
import { SHOP_TYPES } from "./shop-types";

export { SHOP_TYPE_LABELS, SHOP_TYPES } from "./shop-types";

export const REGISTRATION_TYPES = ["trade_licence", "vat", "tin", "ubid", "pra", "dbid"] as const;

export const REGISTRATION_TYPE_LABELS: Record<(typeof REGISTRATION_TYPES)[number], string> = {
  trade_licence: "Trade licence",
  vat: "VAT registration",
  tin: "TIN",
  ubid: "UBID",
  pra: "PRA",
  dbid: "DBID",
};

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const PRODUCTION_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export interface SchemaContext {
  /** Test mode accepts any uploaded file (plan: "Testing mode and seed data"). */
  testMode: boolean;
  now: Date;
}

const emptyToUndefined = (v: unknown) =>
  v === "" || v === null || (v instanceof File && v.size === 0) ? undefined : v;

/** An uploaded file. In production only PDF and images are accepted. */
function upload(ctx: SchemaContext, label: string) {
  return z
    .instanceof(File, { message: `${label} is required` })
    .refine((f) => f.size > 0, `${label} is required`)
    .refine((f) => f.size <= MAX_UPLOAD_BYTES, "File must be 4 MB or smaller")
    .refine((f) => ctx.testMode || PRODUCTION_FILE_TYPES.includes(f.type), "Upload a PDF, JPG, PNG or WebP file");
}

/** Bangladesh NID: 10 (smart card), 13 or 17 digits (old format). */
export const nidSchema = z
  .string({ message: "NID number is required" })
  .trim()
  .regex(/^(\d{10}|\d{13}|\d{17})$/, "NID number must be 10, 13 or 17 digits");

/** YYYY-MM-DD, stored as a UTC date. Must be after today (Dhaka time). */
function futureDate(ctx: SchemaContext) {
  return z
    .string({ message: "Expiry date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD")
    .transform((s) => new Date(`${s}T00:00:00.000Z`))
    .refine((d) => !Number.isNaN(d.getTime()), "Enter a valid date")
    .refine((d) => d > dhakaToday(ctx.now), "The licence must not be expired");
}

const licenceFields = (ctx: SchemaContext) => ({
  licenceNo: z.string({ message: "Licence number is required" }).trim().min(3, "Licence number is required").max(60),
  licenceExpiry: futureDate(ctx),
  licenceFile: upload(ctx, "Licence certificate"),
});

export function licenceSchema(ctx: SchemaContext) {
  return z.object(licenceFields(ctx));
}

/** US-010 / US-015: shop application. Medicine shops must add licence number, expiry and certificate. */
export function applicationSchema(ctx: SchemaContext) {
  const lic = licenceFields(ctx);
  return z
    .object({
      name: z.string().trim().min(3, "Shop name must be at least 3 characters").max(80),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .min(3, "Shop link must be at least 3 characters")
        .max(60)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens"),
      type: z.enum(SHOP_TYPES, { message: "Choose a shop type" }),
      ownerNid: nidSchema,
      ownerPhoto: upload(ctx, "Owner photo"),
      licenceNo: z.preprocess(emptyToUndefined, lic.licenceNo.optional()),
      licenceExpiry: z.preprocess(emptyToUndefined, lic.licenceExpiry.optional()),
      licenceFile: z.preprocess(emptyToUndefined, lic.licenceFile.optional()),
    })
    .superRefine((v, c) => {
      if (v.type !== "medicine") return;
      if (!v.licenceNo) c.addIssue({ code: "custom", path: ["licenceNo"], message: "Licence number is required" });
      if (!v.licenceExpiry) c.addIssue({ code: "custom", path: ["licenceExpiry"], message: "Expiry date is required" });
      if (!v.licenceFile)
        c.addIssue({ code: "custom", path: ["licenceFile"], message: "Licence certificate is required" });
    });
}

/** US-017: upgrade from Basic to Verified. */
export function upgradeSchema(ctx: SchemaContext) {
  return z.object({
    registrationType: z.enum(REGISTRATION_TYPES, { message: "Choose a registration type" }),
    registrationNo: z.string().trim().min(3, "Registration number is required").max(60),
    registrationDoc: upload(ctx, "Registration document"),
  });
}

const optionalHttpsUrl = z.preprocess(
  emptyToUndefined,
  z
    .url({ protocol: /^https?$/, message: "Enter a full http(s) link" })
    .max(500)
    .optional(),
);
const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

/** Tk amount with at most 2 decimals; empty = none. */
const optionalTk = z.preprocess(
  (v) => (typeof v === "string" ? emptyToUndefined(v.trim().replace(/,/g, "")) : emptyToUndefined(v)),
  z.coerce
    .number({ message: "Enter an amount in Tk" })
    .min(1, "Enter at least Tk 1, or leave it empty for no free delivery")
    .max(1_000_000, "Enter at most Tk 1,000,000")
    .refine((n) => Math.round(n * 100) === n * 100, "Use at most 2 decimals")
    .optional(),
);

/** US-012: shop profile; US-058: the free-delivery threshold shown in the cart. */
export const profileSchema = z.object({
  logoUrl: optionalHttpsUrl,
  bannerUrl: optionalHttpsUrl,
  description: optionalText(2000),
  policies: optionalText(5000),
  freeDeliveryThreshold: optionalTk,
});

export const inviteSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase().max(254),
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason (at least 3 characters)").max(500),
});
