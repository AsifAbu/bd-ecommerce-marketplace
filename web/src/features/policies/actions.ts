"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin, requireUser, type GuardUser } from "@/lib/auth";
import { toActionError, type ActionState } from "./action-state";
import { isPolicySlug } from "./catalog";
import { COOKIE_NOTICE_COOKIE, cookieNoticeOptions, cookieNoticeValue } from "./cookie-notice";
import { parseDhakaLocal } from "./dates";
import { PolicyError } from "./errors";
import { readPolicyConsent } from "./form-fields";
import { policyService, requestMeta } from "./server";

/*
 * Every admin action calls requirePlatformAdmin() before reading the form (401 guest, 403 others).
 * Ids from the form are checked by the service (draft-only writes).
 */

type Form = Record<string, FormDataEntryValue>;

function adminAction(handler: (admin: GuardUser, form: Form) => Promise<string>) {
  return async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
    try {
      const admin = await requirePlatformAdmin();
      const ok = await handler(admin, Object.fromEntries(formData));
      revalidatePath("/", "layout");
      return { ok };
    } catch (err) {
      return toActionError(err);
    }
  };
}

function parse<T extends z.ZodType>(schema: T, form: Form): z.infer<T> {
  const result = schema.safeParse(form);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
  throw new PolicyError(422, "VALIDATION", "Please check the form", fields);
}

const slug = z.string().refine(isPolicySlug, "Unknown policy");
const id = z.string().min(1).max(64);

export const createDraftAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ slug }), form);
  const draft = await policyService.createDraft(admin.id, input.slug);
  return `Draft version ${draft.version} created`;
});

export const saveDraftAction = adminAction(async (admin, form) => {
  const input = parse(
    z.object({
      id,
      title: z.string().trim().min(3, "Enter a title").max(120),
      body: z.string().trim().min(20, "Enter the policy text").max(50_000, "Keep the text under 50,000 characters"),
      changeSummary: z
        .string()
        .trim()
        .max(500)
        .optional()
        .transform((v) => v || null),
    }),
    form,
  );
  await policyService.updateDraft(admin.id, input.id, input);
  return "Draft saved";
});

export const publishAction = adminAction(async (admin, form) => {
  const input = parse(z.object({ id, effectiveAt: z.string().max(40).optional() }), form);
  const effectiveAt = parseDhakaLocal(input.effectiveAt ?? "");
  if (effectiveAt === undefined) {
    throw new PolicyError(422, "VALIDATION", "Please check the form", { effectiveAt: "Enter a valid date and time" });
  }
  const published = await policyService.publish(admin.id, input.id, effectiveAt);
  // The draft editor disappears once published; show the result on the reloaded page.
  revalidatePath("/", "layout");
  redirect(`/admin/policies/${published.slug}?published=${published.version}`);
});

/** A logged-in user accepts the current version of policies they have not accepted yet. */
export async function acceptPoliciesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const slugs = formData.getAll("slug").filter(isPolicySlug);
    if (slugs.length === 0) throw new PolicyError(422, "VALIDATION", "Nothing to accept");
    const consent = readPolicyConsent(formData, slugs);
    if (!consent.accepted) {
      throw new PolicyError(422, "VALIDATION", "Tick the box to accept", { acceptPolicies: "Tick the box to accept" });
    }
    const accepted = await policyService.recordAcceptance({
      userId: user.id,
      slugs,
      context: "account",
      shownVersions: consent.shownVersions,
      ...(await requestMeta()),
    });
    revalidatePath("/account/policies");
    return { ok: `Accepted: ${accepted.map((p) => `${p.title} v${p.version}`).join(", ")}` };
  } catch (err) {
    return toActionError(err);
  }
}

/** Hides the cookie notice for this Cookie Policy version (no account needed). */
export async function dismissCookieNoticeAction(formData: FormData): Promise<void> {
  const raw = formData.get("version");
  const version = typeof raw === "string" && /^\d{1,6}$/.test(raw) ? Number(raw) : null;
  (await cookies()).set(
    COOKIE_NOTICE_COOKIE,
    cookieNoticeValue(version),
    cookieNoticeOptions(process.env.NODE_ENV === "production"),
  );
}
