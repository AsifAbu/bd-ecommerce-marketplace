/**
 * Public API of the policies feature (US-080). Server-only: import from server components,
 * server actions and route handlers. Client components use "@/features/policies/client".
 *
 * Checkout (US-051) example:
 *   const policies = await getCurrentVersions(CHECKOUT_POLICY_SLUGS);   // show links + versions
 *   <PolicyConsent slugs={CHECKOUT_POLICY_SLUGS} versions={policies} /> // in the form
 *   // on submit, logged in:
 *   const consent = readPolicyConsent(formData, CHECKOUT_POLICY_SLUGS);
 *   if (consent.accepted) await recordAcceptance({ userId, slugs: CHECKOUT_POLICY_SLUGS, context: "checkout",
 *     shownVersions: consent.shownVersions, ...(await requestMeta()) });
 *   await assertAcceptedCurrent(userId, CHECKOUT_POLICY_SLUGS); // 422 POLICY_ACCEPTANCE_REQUIRED
 *   // guests: recordAcceptance({ guestPhone, slugs: GUEST_CHECKOUT_POLICY_SLUGS, ... }) and store the
 *   // returned [{ slug, version }] on order.policy_versions.
 */
import type { PolicySlug } from "./catalog";
import { policyService } from "./server";
import type { AcceptanceStatus, CurrentPolicy, RecordAcceptanceInput } from "./service";

export {
  CHECKOUT_POLICY_SLUGS,
  COOKIE_POLICY_SLUG,
  GUEST_CHECKOUT_POLICY_SLUGS,
  isPolicySlug,
  POLICIES,
  POLICY_SLUGS,
  policyPath,
  policyTitle,
  SIGNUP_POLICY_SLUGS,
  type PolicySlug,
} from "./catalog";
export { PolicyError } from "./errors";
export { ACCEPT_FIELD, readPolicyConsent, shownVersionField, type PolicyConsent as PolicyConsentInput } from "./form-fields";
export { requestMeta } from "./server";
export type { AcceptanceStatus, CurrentPolicy, RecordAcceptanceInput } from "./service";
export { PolicyConsent } from "./ui/policy-consent";

/** Current (in force) versions of the given policies; unpublished ones are left out. */
export const getCurrentVersions = (slugs: readonly PolicySlug[]): Promise<CurrentPolicy[]> =>
  policyService.getCurrentVersions(slugs);

/** True if the user has accepted the current version of every given policy. */
export const hasAcceptedCurrent = (userId: string, slugs: readonly PolicySlug[]): Promise<boolean> =>
  policyService.hasAcceptedCurrent(userId, slugs);

/** Which current versions the user still has to accept. */
export const checkAcceptance = (userId: string, slugs: readonly PolicySlug[]): Promise<AcceptanceStatus> =>
  policyService.checkAcceptance(userId, slugs);

/** Throws PolicyError 422 POLICY_ACCEPTANCE_REQUIRED (fields per slug) unless all are accepted. */
export const assertAcceptedCurrent = (userId: string, slugs: readonly PolicySlug[]): Promise<void> =>
  policyService.assertAcceptedCurrent(userId, slugs);

/**
 * Records acceptance of the current versions (append-only). Throws PolicyError 409
 * POLICY_CHANGED if `shownVersions` is stale, 409 POLICY_UNPUBLISHED if a policy has no version.
 */
export const recordAcceptance = (input: RecordAcceptanceInput): Promise<CurrentPolicy[]> =>
  policyService.recordAcceptance(input);
