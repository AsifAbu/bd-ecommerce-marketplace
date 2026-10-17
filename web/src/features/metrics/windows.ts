/** Bangladesh has no daylight saving: Asia/Dhaka is always UTC+6. */
const DHAKA_OFFSET_MS = 6 * 3_600_000;
export const DAY_MS = 24 * 3_600_000;

/** Midnight (Dhaka) at the start of the day containing `d`, as an instant. */
export function startOfDhakaDay(d: Date): Date {
  return new Date(Math.floor((d.getTime() + DHAKA_OFFSET_MS) / DAY_MS) * DAY_MS - DHAKA_OFFSET_MS);
}

/** "2026-10-17" for the Dhaka calendar day of `d`. */
export function dhakaDayKey(d: Date): string {
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

export interface Window {
  from: Date;
  to: Date;
  days: number;
}

/** The last `days` Dhaka calendar days including today (so far): [midnight N-1 days ago, now). */
export function lastDays(now: Date, days: number): Window {
  return { from: new Date(startOfDhakaDay(now).getTime() - (days - 1) * DAY_MS), to: now, days };
}

/** Rolling window ending at `now` (not calendar aligned): for the 90-day score and 30-day activity. */
export function rolling(now: Date, days: number): Window {
  return { from: new Date(now.getTime() - days * DAY_MS), to: now, days };
}

/** The Dhaka day keys of a window, oldest first. */
export function dayKeys(w: Window): string[] {
  const keys: string[] = [];
  for (let t = startOfDhakaDay(w.from).getTime(); t < w.to.getTime(); t += DAY_MS) keys.push(dhakaDayKey(new Date(t)));
  return keys;
}

/** Window length from `?days=`: only the allowed choices; anything else falls back to the default. */
export function parseDays(raw: unknown, choices: readonly number[], fallback: number): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = typeof v === "string" ? Number(v) : NaN;
  return choices.includes(n) ? n : fallback;
}
