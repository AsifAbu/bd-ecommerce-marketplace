/**
 * Login identifiers: a Bangladeshi mobile number or an email address.
 * Mobiles are normalised to E.164 (+8801XXXXXXXXX); emails to lower case.
 */
export type LoginIdentifier = { kind: "phone"; value: string } | { kind: "email"; value: string };

const BD_MOBILE = /^(?:\+?880|0)?(1[3-9]\d{8})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeBdPhone(input: string): string | null {
  const compact = input.replace(/[\s-]/g, "");
  const match = BD_MOBILE.exec(compact);
  return match ? `+880${match[1]}` : null;
}

export function parseLoginIdentifier(input: string): LoginIdentifier | null {
  const trimmed = input.trim();
  if (trimmed.includes("@")) {
    return EMAIL.test(trimmed) ? { kind: "email", value: trimmed.toLowerCase() } : null;
  }
  const phone = normalizeBdPhone(trimmed);
  return phone ? { kind: "phone", value: phone } : null;
}
