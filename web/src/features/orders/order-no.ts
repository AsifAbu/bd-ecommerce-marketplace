import { randomInt } from "node:crypto";

/**
 * Order numbers customers can read out on the phone: BD-YYMMDD-XXXXX, the Bangladesh date the
 * order was placed and 5 random characters without look-alikes (no 0/O, 1/I/L, U). 30^5 ≈ 24.3
 * million numbers per day; a clash is retried by the placement. Shop orders add their sequence:
 * BD-261017-7KQ2M-1.
 */

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6, no daylight saving
const PATTERN = /^BD-\d{6}-[2-9A-HJKMNP-TV-Z]{5}$/;

export function generateOrderNo(now: Date, random: (max: number) => number = randomInt): string {
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const yy = String(local.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(local.getUTCDate()).padStart(2, "0");
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += ALPHABET[random(ALPHABET.length)];
  return `BD-${yy}${mm}${dd}-${suffix}`;
}

/** Normalises what a customer typed ("bd-261017-7kq2m ") to an order number, or null. */
export function parseOrderNo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return PATTERN.test(v) ? v : null;
}

export const shopOrderNo = (orderNo: string, seq: number) => `${orderNo}-${seq}`;
