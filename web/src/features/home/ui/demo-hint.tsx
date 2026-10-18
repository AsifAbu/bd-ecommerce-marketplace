import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { getConfig } from "@/lib/config";

/** Seeded demo logins, shown on the home page in test mode only. */
export const DEMO_LOGINS = [
  { email: "admin@ecom.test", role: "Platform Admin", tryThis: "Review shops at /admin/shops and policies at /admin/policies." },
  { email: "customer.verified@ecom.test", role: "Customer", tryThis: "Open the cart and wishlist, place a cash-on-delivery order." },
  { email: "owner.tech@ecom.test", role: "Shop owner (Test Tech Shop)", tryThis: "Open /seller to manage products and orders." },
  { email: "staff.tech@ecom.test", role: "Shop staff (Test Tech Shop)", tryThis: "Same shop as a staff member (no owner-only settings)." },
] as const;

export const DEMO_PASSWORD = "Test@12345";

const code = "rounded-sm bg-paper px-1 font-mono text-[0.9em]";

/** Collapsed by default: one quiet line, the logins one tap away. */
export async function DemoHint() {
  await connection(); // APP_MODE is read at request time
  if (getConfig().appMode !== "test") return null;
  return (
    <details data-testid="demo-hint" className="group rounded-lg bg-surface text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 font-medium [&::-webkit-details-marker]:hidden">
        Try the demo
        <ChevronDown aria-hidden="true" size={18} className="text-muted transition-transform duration-[var(--duration-base)] group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p>
          This site runs in test mode with dummy data. Log in at{" "}
          <Link className="font-medium text-jade underline underline-offset-4" href="/login">
            /login
          </Link>{" "}
          with password <code className={code}>{DEMO_PASSWORD}</code> (OTP code <code className={code}>123456</code>).
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {DEMO_LOGINS.map((l) => (
            <li key={l.email} className="flex flex-col gap-0.5 rounded-md bg-paper p-3">
              <span className="font-semibold">{l.role}</span>
              <code className="break-all font-mono text-[0.9em]">{l.email}</code>
              <span className="text-muted">{l.tryThis}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
