import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { POLICIES, policyPath } from "@/features/policies/client";
import { getConfig } from "@/lib/config";

const link = "inline-flex min-h-11 items-center lg:min-h-8 text-muted hover:text-ink hover:underline";
const heading = "mb-1 text-sm font-semibold text-ink";

/** Site footer on every page: a few real links, the policies, and the DBID (US-080, US-081). */
export function SiteFooter() {
  return (
    <footer className="mt-auto bg-surface px-4 py-10 text-sm sm:px-6">
      <div className="mx-auto flex w-full max-w-[var(--container-page)] flex-col gap-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <p className="text-lg font-semibold tracking-tight">Marketplace</p>
            <p className="max-w-xs text-muted">All online products in one place, from shops across Bangladesh. Pay in cash on delivery.</p>
          </div>
          <nav aria-label="Explore">
            <h2 className={heading}>Shop</h2>
            <ul>
              <li>
                <Link className={link} href="/categories">
                  All categories
                </Link>
              </li>
              <li>
                <Link className={link} href="/search?sort=newest">
                  New arrivals
                </Link>
              </li>
              <li>
                <Link className={link} href="/track">
                  Track an order
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="For sellers">
            <h2 className={heading}>Sell</h2>
            <ul>
              <li>
                <Link className={link} href="/shops/apply">
                  Open a shop
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Policies">
            <h2 className={heading}>Policies</h2>
            <ul>
              {POLICIES.map((p) => (
                <li key={p.slug}>
                  <Link className={link} href={policyPath(p.slug)}>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <Suspense fallback={<p className="text-muted">Digital Business ID (DBID): …</p>}>
          <Dbid />
        </Suspense>
      </div>
    </footer>
  );
}

async function Dbid() {
  await connection(); // read the configured DBID at request time, not build time
  const dbid = getConfig().dbid;
  return (
    <p data-testid="footer-dbid" className="tabular text-muted">
      Digital Business ID (DBID): {dbid ?? "pending registration"}
    </p>
  );
}
