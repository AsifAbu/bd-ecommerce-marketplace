import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/features/auth/password";
import { DIVISIONS, districtsOf, upazilasOf } from "./locations";

/** Bangladeshi mobile as typed: 11 digits starting 01 (spaces and dashes allowed). Output: +8801XXXXXXXXX. */
export const bdMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^01[3-9]\d{8}$/.test(v), "Enter an 11-digit mobile number starting with 01")
  .transform((v) => `+88${v}`);

export const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address"));

export const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(200, "Use at most 200 characters");

const name = z.string().trim().min(2, "Enter your name").max(100);

/** Empty form fields mean "not given". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

export const signUpSchema = z
  .object({ name, phone: optional(bdMobile), email: optional(email), password })
  .refine((v) => v.phone || v.email, { message: "Enter a mobile number or an email", path: ["phone"] });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const profileSchema = z
  .object({
    name,
    phone: optional(bdMobile),
    email: optional(email),
    avatarUrl: optional(z.url({ protocol: /^https$/, error: "Enter an https:// image URL" }).max(500)),
  })
  .refine((v) => v.phone || v.email, { message: "Keep a mobile number or an email", path: ["phone"] });
export type ProfileInput = z.infer<typeof profileSchema>;

export const addressSchema = z
  .object({
    name,
    phone: bdMobile,
    division: z.string().refine((d) => DIVISIONS.includes(d), "Choose a division"),
    district: z.string().min(1, "Choose a district"),
    upazila: z.string().trim().min(2, "Choose an upazila or thana").max(100),
    area: z.string().trim().min(2, "Enter the area").max(100),
    line1: z.string().trim().min(3, "Enter house, road or village").max(200),
    isDefault: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
  })
  .superRefine((v, ctx) => {
    if (!districtsOf(v.division).includes(v.district)) {
      ctx.addIssue({ code: "custom", path: ["district"], message: "Choose a district in this division" });
      return;
    }
    const known = upazilasOf(v.district);
    if (known.length > 0 && !known.includes(v.upazila)) {
      ctx.addIssue({ code: "custom", path: ["upazila"], message: "Choose an upazila or thana in this district" });
    }
  });
export type AddressInput = z.infer<typeof addressSchema>;
