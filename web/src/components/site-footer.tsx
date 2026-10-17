import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { POLICIES, policyPath } from "@/features/policies/client";
import { getConfig } from "@/lib/config";

/** Site footer on every page: policy links and the DBID (US-080, US-081). */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-300 bg-gray-50 px-4 py-6 text-sm">
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <nav aria-label="Policies">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {POLICIES.map((p) => (
              <li key={p.slug}>
                <Link className="underline" href={policyPath(p.slug)}>
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Suspense fallback={<p>Digital Business ID (DBID): …</p>}>
          <Dbid />
        </Suspense>
      </div>
    </footer>
  );
}

async function Dbid() {
  await connection(); // read the configured DBID at request time, not build time
  const dbid = getConfig().dbid;
  return <p data-testid="footer-dbid">Digital Business ID (DBID): {dbid ?? "pending registration"}</p>;
}
