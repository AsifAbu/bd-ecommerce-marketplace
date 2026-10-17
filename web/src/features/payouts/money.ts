/**
 * Money for the payout ledger: amounts are handled as whole paisa (integers), never as floating
 * Tk, so sums are exact. Database Decimals and strings are parsed digit by digit; anything past
 * the paisa is rounded half away from zero (Tk 10.005 -> 1001 paisa).
 */

export type MoneyLike = string | number | { toString(): string };

const PATTERN = /^([+-])?(\d+)(?:\.(\d*))?$/;

export function toPaisa(value: MoneyLike): number {
  const text = (typeof value === "number" ? String(value) : value.toString()).trim();
  const m = PATTERN.exec(text);
  if (!m) throw new Error(`Not an amount: ${JSON.stringify(text)}`);
  const [, sign, whole, frac = ""] = m;
  const digits = frac.padEnd(3, "0");
  let paisa = Number(whole) * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) paisa += 1;
  if (!Number.isSafeInteger(paisa)) throw new Error(`Amount out of range: ${text}`);
  return sign === "-" && paisa !== 0 ? -paisa : paisa;
}

/** Paisa to a Decimal string for the database: 123456 -> "1234.56". */
export function paisaToDecimal(paisa: number): string {
  if (!Number.isSafeInteger(paisa)) throw new Error(`Not a whole number of paisa: ${paisa}`);
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "Tk 1,234.50" / "Tk 70" for pages and emails. */
export function formatPaisa(paisa: number): string {
  const sign = paisa < 0 ? "−" : "";
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const frac = abs % 100;
  return `${sign}Tk ${whole}${frac ? `.${String(frac).padStart(2, "0")}` : ""}`;
}

export const sumPaisa = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
