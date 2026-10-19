import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Breadcrumbs, FilterChips, Notice } from "@/components/ui";
import { getConfig } from "@/lib/config";
import { isPolicySlug, POLICIES, policyPath, policyTitle } from "../catalog";
import { formatDate } from "../dates";
import { policyService } from "../server";
import { PolicyMarkdown } from "./policy-markdown";

/**
 * /policies/[slug]: the current version with its effective date, or an earlier published
 * version with ?version=N (so anyone can see the exact text they accepted). Long-form reading
 * layout: about 70 characters per line, one h1, the version switcher above the text.
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
  const crumbs = (
    <Breadcrumbs items={[{ label: "Policies", href: "/policies" }, { label: policyTitle(slug) }]} />
  );

  if (!shown) {
    return (
      <div className="flex max-w-[70ch] flex-col gap-4">
        {crumbs}
        <h1 className="text-3xl font-semibold sm:text-4xl">{policyTitle(slug)}</h1>
        <p role="status" className="text-muted">
          {versionNo === null ? "This policy is not published yet. Please check back soon." : "This version does not exist."}{" "}
          {versionNo !== null && (
            <Link className="font-medium text-jade underline-offset-4 hover:underline" href={policyPath(slug)}>
              Read the current version
            </Link>
          )}
        </p>
      </div>
    );
  }

  return (
    <article className="flex flex-col gap-8" aria-labelledby="policy-title">
      <header className="flex max-w-[70ch] flex-col gap-3">
        {crumbs}
        <h1 id="policy-title" className="text-3xl font-semibold sm:text-4xl">
          {shown.title}
        </h1>
        <p className="text-muted" data-testid="policy-version">
          Version {shown.version}, effective from {formatDate(shown.effectiveAt!)}
          {shown.state === "current" ? " (current)" : ""}
        </p>
        {shown.changeSummary && <p className="text-sm text-muted">What changed: {shown.changeSummary}</p>}
        {shown.state === "superseded" && current && (
          <Notice tone="warning" role="note">
            <p>
              This is an earlier version. It was replaced by{" "}
              <Link className="font-medium underline underline-offset-4" href={policyPath(slug)}>
                version {current.version}
              </Link>
              .
            </p>
          </Notice>
        )}
        {history.length > 1 && (
          <FilterChips
            label="Policy versions"
            className="pt-1"
            items={history.map((v) => ({
              label: `Version ${v.version}${v.state === "current" ? " (current)" : ""}`,
              href: v.state === "current" ? policyPath(slug) : `${policyPath(slug)}?version=${v.version}`,
              current: v.id === shown.id,
            }))}
          />
        )}
      </header>
      <div className="max-w-[70ch]">
        <PolicyMarkdown body={shown.body} vars={{ DBID: getConfig().dbid ?? "pending registration" }} />
      </div>
    </article>
  );
}

/** /policies: list of all policy pages (static). */
export function PolicyIndex() {
  return (
    <ul className="flex max-w-[70ch] flex-col">
      {POLICIES.map((p) => (
        <li key={p.slug} className="border-t border-line py-4 first:border-t-0 first:pt-0">
          <Link className="text-lg font-semibold text-jade underline-offset-4 hover:underline" href={policyPath(p.slug)}>
            {p.title}
          </Link>
          <p className="mt-1 text-muted">{p.summary}</p>
        </li>
      ))}
    </ul>
  );
}
