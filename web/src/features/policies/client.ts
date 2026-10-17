/** Client-safe part of the policies API (no database access). Server code can use "@/features/policies". */
export {
  CHECKOUT_POLICY_SLUGS,
  GUEST_CHECKOUT_POLICY_SLUGS,
  isPolicySlug,
  POLICIES,
  POLICY_SLUGS,
  policyPath,
  policyTitle,
  SIGNUP_POLICY_SLUGS,
  type PolicySlug,
} from "./catalog";
export { ACCEPT_FIELD, readPolicyConsent, shownVersionField } from "./form-fields";
export { PolicyConsent } from "./ui/policy-consent";
