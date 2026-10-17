"use server";

import { AuthError } from "next-auth";
import { safePath } from "./safe-path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { parseLoginIdentifier } from "@/features/auth/identifier";
import { hashPassword } from "@/features/auth/password";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { formString as str, parseForm, runAction, ValidationError, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { USER_ACTIONS, type UserAction } from "./admin-users";
import { OTP_MESSAGES } from "./otp-service";
import { addressSchema, bdMobile, password as passwordSchema, profileSchema } from "./schemas";
import { addressRepo, adminUsers, clientIp, otpService, sendTokenEmail, signUpDeps, tokenService } from "./services";
import { signUp, TAKEN_MESSAGE } from "./signup";

/*
 * Form actions return the shared ActionResult (@/lib/actions): runAction() turns a thrown
 * ValidationError (per-field messages) or AppError (form-level message) into an error result and
 * passes `values` back so the form keeps what was typed. Passwords are never in `values`.
 */

/** A form-level error message (shown above the form). */
const formError = (message: string) => new AppError(400, "FORM", message);

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** Sending email must not break the account flow (Mailpit may be down locally). */
async function trySendTokenEmail(user: { id: string; email: string }, type: "email_verify" | "password_reset") {
  try {
    await sendTokenEmail(user, type);
  } catch (err) {
    console.error(`[accounts] could not send ${type} email`, err);
  }
}

// --- Sign-up, login, logout (US-001, US-003) ---------------------------------

export async function signUpAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const values = { name: str(fd, "name"), phone: str(fd, "phone"), email: str(fd, "email") };
  return runAction(async () => {
    const raw = { ...values, password: str(fd, "password") };
    let result;
    try {
      result = await signUp(raw, signUpDeps);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ValidationError({ phone: TAKEN_MESSAGE.phone, email: TAKEN_MESSAGE.email });
      throw err;
    }
    if (!result.ok) throw new ValidationError(result.fields);

    const { phone, email } = result.input;
    if (email) await trySendTokenEmail({ id: result.userId, email }, "email_verify");
    await signIn("credentials", {
      identifier: phone ?? email,
      password: raw.password,
      redirectTo: phone ? "/account/verify-phone" : "/account",
    });
    return ""; // signIn redirects
  }, { values });
}

const LOGIN_FAILED_MESSAGE =
  "Wrong mobile number, email or password, or the account is suspended. After 5 wrong tries, login is paused for 15 minutes.";

export async function loginAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    try {
      await signIn("credentials", {
        identifier: str(fd, "identifier"),
        password: str(fd, "password"),
        redirectTo: safePath(str(fd, "callbackUrl")),
      });
    } catch (err) {
      // One message for every failure, including a lockout, so it never reveals whether an account exists.
      if (err instanceof AuthError) throw formError(LOGIN_FAILED_MESSAGE);
      throw err; // the success redirect is thrown too
    }
    return "";
  }, { values: { identifier: str(fd, "identifier") } });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

// --- Password reset (US-003) -------------------------------------------------

export async function forgotPasswordAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const values = { identifier: str(fd, "identifier") };
  return runAction(async () => {
    const id = parseLoginIdentifier(values.identifier);
    if (!id) throw new ValidationError({ identifier: "Enter your mobile number or email" });

    if (id.kind === "email") {
      const user = await prisma.user.findUnique({ where: { email: id.value }, select: { id: true, status: true } });
      if (user?.status === "active") await trySendTokenEmail({ id: user.id, email: id.value }, "password_reset");
      return "If an account uses this email, we have sent a reset link. It works for 1 hour.";
    }

    const user = await prisma.user.findUnique({ where: { phone: id.value }, select: { status: true } });
    if (user?.status === "active") {
      const sent = await otpService.requestOtp(id.value, "password_reset", await clientIp());
      if (!sent.ok) throw formError(OTP_MESSAGES[sent.code]);
    }
    redirect(`/reset-password/sms?phone=${encodeURIComponent(id.value.replace("+88", ""))}`);
  }, { values });
}

export async function resetPasswordWithTokenAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const pw = passwordSchema.safeParse(str(fd, "password"));
    if (!pw.success) throw new ValidationError({ password: pw.error.issues[0].message });

    const ok = await resetWithToken(str(fd, "token"), pw.data);
    if (!ok) throw formError("This reset link is invalid or has expired. Ask for a new one.");
    redirect("/login?reset=1");
  });
}

async function resetWithToken(token: string, newPassword: string) {
  const res = await tokenService.consume(token, "password_reset");
  if (!res.ok) return false;
  const user = await prisma.user.findUnique({ where: { id: res.token.userId }, select: { email: true, emailVerifiedAt: true } });
  if (!user) return false;
  // The link proves the email, so it also counts as verifying it.
  const emailVerified = user.email === res.token.email && !user.emailVerifiedAt ? { emailVerifiedAt: new Date() } : {};
  await prisma.user.update({
    where: { id: res.token.userId },
    data: { passwordHash: await hashPassword(newPassword), ...emailVerified },
  });
  return true;
}

export async function resetPasswordWithOtpAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const phone = bdMobile.safeParse(str(fd, "phone"));
    if (!phone.success) throw new ValidationError({ phone: phone.error.issues[0].message });
    const pw = passwordSchema.safeParse(str(fd, "password"));
    if (!pw.success) throw new ValidationError({ password: pw.error.issues[0].message });

    const check = await otpService.verifyOtp(phone.data, "password_reset", str(fd, "code"));
    if (!check.ok) throw new ValidationError({ code: OTP_MESSAGES[check.code] });

    const user = await prisma.user.findUnique({ where: { phone: phone.data }, select: { id: true, phoneVerifiedAt: true } });
    if (!user) throw new ValidationError({ code: OTP_MESSAGES.INVALID });
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(pw.data), phoneVerifiedAt: user.phoneVerifiedAt ?? new Date() },
    });
    redirect("/login?reset=1");
  });
}

// --- Phone OTP (US-005) ------------------------------------------------------

async function currentPhone() {
  const { id } = await requireUser();
  return prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, phone: true, phoneVerifiedAt: true } });
}

export async function sendPhoneOtpAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await currentPhone();
    if (!user.phone) throw formError("Add a mobile number to your profile first.");
    if (user.phoneVerifiedAt) return "Your mobile number is already verified.";
    const res = await otpService.requestOtp(user.phone, "phone_verify", await clientIp());
    if (!res.ok) throw formError(OTP_MESSAGES[res.code]);
    return "We sent a 6-digit code by SMS. It works for 5 minutes.";
  });
}

export async function verifyPhoneAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await currentPhone();
    if (!user.phone) throw formError("Add a mobile number to your profile first.");
    const res = await otpService.verifyOtp(user.phone, "phone_verify", str(fd, "code"));
    if (!res.ok) throw new ValidationError({ code: OTP_MESSAGES[res.code] });
    // Only if the phone has not changed meanwhile.
    await prisma.user.updateMany({ where: { id: user.id, phone: user.phone }, data: { phoneVerifiedAt: new Date() } });
    redirect("/account?phoneVerified=1");
  });
}

// --- Profile (US-002) --------------------------------------------------------

export async function updateProfileAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const values = { name: str(fd, "name"), phone: str(fd, "phone"), email: str(fd, "email"), avatarUrl: str(fd, "avatarUrl") };
  return runAction(() => updateProfile(values), { values });
}

async function updateProfile(values: Record<string, string>): Promise<string> {
  const { id } = await requireUser();
  const input = parseForm(profileSchema, values);
  const current = await prisma.user.findUniqueOrThrow({ where: { id }, select: { phone: true, email: true } });

  const phone = input.phone ?? null;
  const email = input.email ?? null;
  const phoneChanged = phone !== current.phone;
  const emailChanged = email !== current.email;

  const fields: Record<string, string> = {};
  if (phoneChanged && phone && (await prisma.user.count({ where: { phone, NOT: { id } } }))) fields.phone = "This mobile number is used by another account.";
  if (emailChanged && email && (await prisma.user.count({ where: { email, NOT: { id } } }))) fields.email = "This email is used by another account.";
  if (Object.keys(fields).length) throw new ValidationError(fields);

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        avatarUrl: input.avatarUrl ?? null,
        phone,
        email,
        // A changed identifier must be verified again (OTP or email link).
        ...(phoneChanged ? { phoneVerifiedAt: null } : {}),
        ...(emailChanged ? { emailVerifiedAt: null } : {}),
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw formError("That mobile number or email is used by another account.");
    throw err;
  }
  if (emailChanged && email) await trySendTokenEmail({ id, email }, "email_verify");
  revalidatePath("/account");

  const notes = ["Profile saved."];
  if (phoneChanged && phone) notes.push("Verify your new mobile number.");
  if (emailChanged && email) notes.push("We sent a verification link to your new email.");
  return notes.join(" ");
}

export async function resendEmailVerificationAction(): Promise<ActionResult> {
  return runAction(async () => {
    const { id } = await requireUser();
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { email: true, emailVerifiedAt: true } });
    if (!user.email) throw formError("Add an email to your profile first.");
    if (user.emailVerifiedAt) return "Your email is already verified.";
    await trySendTokenEmail({ id, email: user.email }, "email_verify");
    return "We sent a verification link. It works for 24 hours.";
  });
}

// --- Address book (US-006) ---------------------------------------------------

export async function saveAddressAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const values = Object.fromEntries([...fd].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<string, string>;
  return runAction(async () => {
    const { id: userId } = await requireUser();
    const input = parseForm(addressSchema, values);

    const addressId = str(fd, "id");
    if (addressId) {
      if (!(await addressRepo.update(userId, addressId, input))) throw formError("Address not found.");
    } else {
      await addressRepo.create(userId, input);
    }
    revalidatePath("/account/addresses");
    redirect("/account/addresses");
  }, { values });
}

export async function deleteAddressAction(fd: FormData) {
  const { id: userId } = await requireUser();
  await addressRepo.remove(userId, str(fd, "id"));
  revalidatePath("/account/addresses");
}

export async function setDefaultAddressAction(fd: FormData) {
  const { id: userId } = await requireUser();
  await addressRepo.setDefault(userId, str(fd, "id"));
  revalidatePath("/account/addresses");
}

// --- Admin user management (US-004) ------------------------------------------

export async function adminUserAction(fd: FormData) {
  const action = str(fd, "action");
  if (!Object.hasOwn(USER_ACTIONS, action)) return;
  await adminUsers.apply(str(fd, "userId"), action as UserAction);
  revalidatePath("/admin/users");
}
