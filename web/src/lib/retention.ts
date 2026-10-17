/**
 * Record retention (US-081). The Digital Commerce Operation Guidelines 2021 require business
 * records to be kept for 6 years (figure from news summaries; check against the official text
 * before release). Rule for all code: retained records are never hard-deleted. Close them with a
 * status (`suspended`, `cancelled`, `resolved`, `hidden`…) instead. User accounts linked to
 * retained records are anonymised, not deleted (foreign keys use onDelete: Restrict / SetNull).
 *
 * There is no purge job yet. When one is built it must only remove rows older than
 * `retainUntil(...)` and must be listed in this file. A test (retention.test.ts) scans the code
 * for `.delete(` / `.deleteMany(` on these models.
 */

export const RETENTION_YEARS = 6;

export interface RetentionRule {
  /** Prisma model name (the client accessor is the camelCase form). */
  model: string;
  /** What the records are, for the admin page. */
  label: string;
  years: number;
  /** Which date starts the clock. */
  from: string;
  source: string;
  /** False when the model is planned but not built yet (e.g. orders in Sprint 6). */
  built: boolean;
}

const GUIDELINES = "Digital Commerce Operation Guidelines 2021 (6-year records)";
const PDPO = "Personal Data Protection Ordinance 2025 (consent records); kept with the business records";

export const RETENTION_RULES: readonly RetentionRule[] = [
  { model: "Order", label: "Orders (customer, contact, address snapshot, policy versions)", years: RETENTION_YEARS, from: "order placed", source: GUIDELINES, built: true },
  { model: "ShopOrder", label: "Shop orders (per-shop split, handover, cancellation)", years: RETENTION_YEARS, from: "order placed", source: GUIDELINES, built: true },
  { model: "OrderItem", label: "Order items (price and title snapshot)", years: RETENTION_YEARS, from: "order placed", source: GUIDELINES, built: true },
  { model: "ShopOrderEvent", label: "Shop order status history (who confirmed, handed over, cancelled…)", years: RETENTION_YEARS, from: "order placed", source: GUIDELINES, built: true },
  { model: "CodCollection", label: "Cash-on-delivery collections", years: RETENTION_YEARS, from: "payout", source: GUIDELINES, built: true },
  { model: "Payout", label: "Shop payouts (amounts, method, reference)", years: RETENTION_YEARS, from: "payout paid", source: GUIDELINES, built: true },
  { model: "ReturnRequest", label: "Returns and refunds", years: RETENTION_YEARS, from: "refund or closure", source: GUIDELINES, built: false },
  { model: "Shop", label: "Shops (owner identity, NID, registration number, status history)", years: RETENTION_YEARS, from: "shop closed or suspended", source: GUIDELINES, built: true },
  { model: "ShopLicence", label: "Medicine licences and their review", years: RETENTION_YEARS, from: "licence expiry", source: GUIDELINES, built: true },
  { model: "ComplaintTicket", label: "Complaints", years: RETENTION_YEARS, from: "complaint resolved", source: GUIDELINES, built: false },
  { model: "Review", label: "Ratings and reviews (hidden with a logged reason, never deleted)", years: RETENTION_YEARS, from: "review written", source: GUIDELINES, built: true },
  { model: "AuditLog", label: "Audit log (admin and shop actions)", years: RETENTION_YEARS, from: "entry written", source: GUIDELINES, built: true },
  { model: "PolicyDocument", label: "Policy versions (published text)", years: RETENTION_YEARS, from: "superseded", source: GUIDELINES, built: true },
  { model: "PolicyAcceptance", label: "Policy acceptances (consent records)", years: RETENTION_YEARS, from: "accepted", source: PDPO, built: true },
];

/** The date until which a record must be kept, counted from `from` (calendar years, UTC). */
export function retainUntil(from: Date, years: number = RETENTION_YEARS): Date {
  const d = new Date(from.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

/** True while the record is inside its retention period (it must not be removed). */
export function isRetained(from: Date, now: Date = new Date(), years: number = RETENTION_YEARS): boolean {
  return now.getTime() < retainUntil(from, years).getTime();
}

/** Prisma client accessor names (camelCase) of the retained models, e.g. "auditLog". */
export function retainedModelAccessors(): string[] {
  return RETENTION_RULES.map((r) => r.model.charAt(0).toLowerCase() + r.model.slice(1));
}
