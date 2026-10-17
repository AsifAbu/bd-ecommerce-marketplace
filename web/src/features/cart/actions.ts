"use server";

import { cookies } from "next/headers";
import { ZONE_COOKIE } from "./guest-token";
import { parseZone } from "./model";

const YEAR = 365 * 24 * 60 * 60;

/** The cart page's delivery-area selector: remembered on this device (US-058). */
export async function setDeliveryZoneAction(zone: string): Promise<void> {
  const parsed = parseZone(zone);
  if (!parsed) return;
  (await cookies()).set(ZONE_COOKIE, parsed, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.AUTH_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: YEAR,
  });
}
