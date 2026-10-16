/*
 * Dates on policy pages are shown and entered in Bangladesh time (Asia/Dhaka, UTC+6, no DST),
 * whatever the server's time zone.
 */
const DHAKA_OFFSET = "+06:00";

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "16 October 2026" */
export const formatDate = (d: Date) => dateFmt.format(d);

/** "16 Oct 2026, 18:30 (Dhaka)" */
export const formatDateTime = (d: Date) => `${dateTimeFmt.format(d)} (Dhaka)`;

/**
 * Parses a `datetime-local` value ("2026-10-20T09:00") as Dhaka time. Empty means "not given"
 * (null); malformed input gives undefined.
 */
export function parseDhakaLocal(value: string): Date | null | undefined {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return undefined;
  const d = new Date(`${v.length === 16 ? `${v}:00` : v}${DHAKA_OFFSET}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
