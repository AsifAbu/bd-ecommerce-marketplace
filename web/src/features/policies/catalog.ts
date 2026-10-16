/**
 * The fixed set of platform policies (plan v2.4, "Policy pages"). The admin publishes versions of
 * these; new kinds of policy are added here, not from the admin UI, because other features refer
 * to them by slug (checkout requires "returns" and "delivery"). Safe to import from client code.
 */
export const POLICIES = [
  { slug: "terms", title: "Terms and Conditions", summary: "Our role as a marketplace, shop and account rules, DBID, governing law." },
  { slug: "privacy", title: "Privacy Policy", summary: "What we collect, why, how long we keep it, who sees it and how to delete it." },
  { slug: "returns", title: "Return and Refund Policy", summary: "7-day returns, eligible reasons, exclusions and refund timing." },
  { slug: "delivery", title: "Delivery and Cash on Delivery Policy", summary: "Delivery charges, 48-hour handover, cancellation and refused deliveries." },
  { slug: "seller", title: "Seller Policy", summary: "Shop approval, required documents, listing rules, prohibited items, payouts." },
  { slug: "cookies", title: "Cookie Policy", summary: "Which cookies we use and why." },
] as const;

export type PolicySlug = (typeof POLICIES)[number]["slug"];

export const POLICY_SLUGS: readonly PolicySlug[] = POLICIES.map((p) => p.slug);

/** Accepted when an account is created (plan: "accept the current Terms and Privacy Policy at sign-up"). */
export const SIGNUP_POLICY_SLUGS = ["terms", "privacy"] as const satisfies readonly PolicySlug[];

/** Accepted when an order is placed by a logged-in customer (US-051). */
export const CHECKOUT_POLICY_SLUGS = ["returns", "delivery"] as const satisfies readonly PolicySlug[];

/** Guests also consent to the Privacy Policy at checkout (they never signed up). */
export const GUEST_CHECKOUT_POLICY_SLUGS = ["returns", "delivery", "privacy"] as const satisfies readonly PolicySlug[];

export const COOKIE_POLICY_SLUG = "cookies" satisfies PolicySlug;

export function isPolicySlug(value: unknown): value is PolicySlug {
  return typeof value === "string" && (POLICY_SLUGS as readonly string[]).includes(value);
}

export function policyTitle(slug: PolicySlug): string {
  return POLICIES.find((p) => p.slug === slug)!.title;
}

export const policyPath = (slug: PolicySlug) => `/policies/${slug}`;
