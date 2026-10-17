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

export async function DemoHint() {
  await connection(); // APP_MODE is read at request time
  if (getConfig().appMode !== "test") return null;
  return (
    <section aria-labelledby="demo-hint" data-testid="demo-hint" className="rounded-lg border border-amber-500 bg-amber-50 p-4 text-sm">
      <h2 id="demo-hint" className="text-base font-semibold">
        Try the demo
      </h2>
      <p className="mt-1">
        This site runs in test mode with dummy data. Log in at{" "}
        <Link className="font-medium text-blue-800 underline" href="/login">
          /login
        </Link>{" "}
        with password <code className="rounded bg-white px-1">{DEMO_PASSWORD}</code> (OTP code <code className="rounded bg-white px-1">123456</code>):
      </p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {DEMO_LOGINS.map((l) => (
          <li key={l.email} className="rounded border border-amber-300 bg-white p-2">
            <span className="font-semibold">{l.role}</span>
            <br />
            <code>{l.email}</code>
            <br />
            <span className="text-gray-700">{l.tryThis}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
