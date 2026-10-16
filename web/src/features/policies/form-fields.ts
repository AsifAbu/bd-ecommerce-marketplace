import { isPolicySlug, type PolicySlug } from "./catalog";

/*
 * Form fields for accepting policies (sign-up, checkout, account). <PolicyConsent> renders them;
 * the server action reads them with readPolicyConsent(). Client-safe.
 */

/** The consent checkbox. */
export const ACCEPT_FIELD = "acceptPolicies";

/** Hidden field carrying the version the person was shown, e.g. "policyVersion.returns" = "2". */
export const shownVersionField = (slug: PolicySlug) => `policyVersion.${slug}`;

export interface PolicyConsent {
  accepted: boolean;
  /** Versions shown on the form; pass to recordAcceptance({ shownVersions }). */
  shownVersions: Partial<Record<PolicySlug, number>>;
}

export function readPolicyConsent(form: FormData | Record<string, unknown>, slugs: readonly PolicySlug[]): PolicyConsent {
  const get = (k: string) => (form instanceof FormData ? form.get(k) : form[k]);
  const box = get(ACCEPT_FIELD);
  const shownVersions: Partial<Record<PolicySlug, number>> = {};
  for (const slug of slugs) {
    if (!isPolicySlug(slug)) continue;
    const raw = get(shownVersionField(slug));
    if (typeof raw === "string" && /^\d{1,6}$/.test(raw)) shownVersions[slug] = Number(raw);
  }
  return { accepted: box === "on" || box === "true" || box === true, shownVersions };
}
