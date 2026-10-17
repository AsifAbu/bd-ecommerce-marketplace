import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getConfig } from "@/lib/config";
import { isPolicySlug, POLICIES, policyPath, policyTitle } from "../catalog";
import { formatDate } from "../dates";
import { policyService } from "../server";
import { PolicyMarkdown } from "./policy-markdown";

/**
 * /policies/[slug]: the current version with its effective date, or an earlier published
 * version with ?version=N (so anyone can see the exact text they accepted).
 */
export async function PublicPolicy({
  slug: slugPromise,
  searchParams,
}: {
  slug: Promise<string>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection(); // published versions and effective dates are read at request time
  const slug = await slugPromise;
  if (!isPolicySlug(slug)) notFound();
  const requested = (await searchParams).version;
  const versionNo = typeof requested === "string" && /^\d{1,6}$/.test(requested) ? Number(requested) : null;

  const history = (await policyService.history(slug)).filter((v) => v.state === "current" || v.state === "superseded");
  const current = history.find((v) => v.state === "current") ?? null;
  const shown = versionNo === null ? current : (history.find((v) => v.version === versionNo) ?? null);

  if (!shown) {
    return (
      <>
        <h1 className="text-3xl font-bold">{policyTitle(slug)}</h1>
        <p role="status">{versionNo === null ? "This policy is not published yet." : "This version does not exist."}</p>
      </>
    );
  }

  return (
    <article className="flex flex-col gap-4" aria-labelledby="policy-title">
      <header className="flex flex-col gap-1">
        <h1 id="policy-title" className="text-3xl font-bold">
          {shown.title}
        </h1>
        <p className="text-sm text-gray-700" data-testid="policy-version">
          Version {shown.version} · Effective from {formatDate(shown.effectiveAt!)}
        </p>
        {shown.state === "superseded" && current && (
          <p role="note" className="rounded border border-amber-600 bg-amber-50 px-3 py-2 text-sm">
            This is an earlier version. It was replaced by{" "}
            <Link className="underline" href={policyPath(slug)}>
              version {current.version}
            </Link>
            .
          </p>
        )}
      </header>
      <PolicyMarkdown body={shown.body} vars={{ DBID: getConfig().dbid ?? "pending registration" }} />
      {history.length > 1 && (
        <section aria-labelledby="versions-heading" className="mt-6 border-t border-gray-300 pt-4 text-sm">
          <h2 id="versions-heading" className="font-semibold">
            All versions
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {history.map((v) => (
              <li key={v.id}>
                <Link className="underline" href={`${policyPath(slug)}?version=${v.version}`} aria-current={v.id === shown.id ? "page" : undefined}>
                  Version {v.version}
                </Link>{" "}
                effective {formatDate(v.effectiveAt!)}
                {v.state === "current" ? " (current)" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/** /policies: list of all policy pages (static). */
export function PolicyIndex() {
  return (
    <ul className="flex flex-col gap-3">
      {POLICIES.map((p) => (
        <li key={p.slug}>
          <Link className="font-semibold underline" href={policyPath(p.slug)}>
            {p.title}
          </Link>
          <p className="text-sm text-gray-700">{p.summary}</p>
        </li>
      ))}
    </ul>
  );
}
