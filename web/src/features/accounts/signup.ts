import { hashPassword } from "@/features/auth/password";
import { fieldErrors } from "@/lib/actions";
import { signUpSchema, type SignUpInput } from "./schemas";

export interface SignUpDeps {
  /** True if an account already uses this email or phone. */
  identifierTaken(kind: "email" | "phone", value: string): Promise<boolean>;
  createUser(data: { name: string; email: string | null; phone: string | null; passwordHash: string }): Promise<{ id: string }>;
  /** Records acceptance of the current Terms and Privacy Policy versions (US-080). */
  recordConsent(userId: string): Promise<void>;
}

export type SignUpResult =
  | { ok: true; userId: string; input: SignUpInput }
  | { ok: false; fields: Record<string, string> };

export const TAKEN_MESSAGE = {
  phone: "This mobile number already has an account. Log in instead.",
  email: "This email already has an account. Log in instead.",
};

/**
 * Creates an unverified account. Phone and email are unique; they count as
 * verified only after an OTP or email link, never at sign-up. The consent checkbox is required
 * and its acceptance of the current Terms and Privacy Policy is recorded.
 */
export async function signUp(raw: unknown, deps: SignUpDeps): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error) };
  const input = parsed.data;

  const fields: Record<string, string> = {};
  if (input.phone && (await deps.identifierTaken("phone", input.phone))) fields.phone = TAKEN_MESSAGE.phone;
  if (input.email && (await deps.identifierTaken("email", input.email))) fields.email = TAKEN_MESSAGE.email;
  if (Object.keys(fields).length > 0) return { ok: false, fields };

  const user = await deps.createUser({
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    passwordHash: await hashPassword(input.password),
  });
  await deps.recordConsent(user.id);
  return { ok: true, userId: user.id, input };
}
