import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfig } from "@/lib/config";
import { isPolicySlug, policyPath, policyTitle } from "../catalog";
import { formatDateTime } from "../dates";
import type { VersionState } from "../rules";
import { policyService } from "../server";
import { DraftEditor, NewDraftForm } from "./draft-editor";
import { PolicyMarkdown } from "./policy-markdown";

const cell = "border-b border-gray-300 px-2 py-2 text-left align-top";

/** /admin/policies: every policy with its current, scheduled and draft version. */
export async function AdminPolicyList() {
  const rows = await policyService.adminOverview();
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Policies and their versions</caption>
      <thead>
        <tr>
          <th scope="col" className={cell}>Policy</th>
          <th scope="col" className={cell}>Current version</th>
          <th scope="col" className={cell}>Scheduled</th>
          <th scope="col" className={cell}>Draft</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.slug}>
            <th scope="row" className={cell}>
              <Link className="underline" href={`/admin/policies/${r.slug}`}>
                {r.title}
              </Link>
            </th>
            <td className={cell}>
              {r.current ? (
                <>
                  Version {r.current.version}, effective {formatDateTime(r.current.effectiveAt!)}
                </>
              ) : (
                <span className="font-semibold text-red-700">Not published</span>
              )}
            </td>
            <td className={cell}>
              {r.scheduled ? `Version ${r.scheduled.version} from ${formatDateTime(r.scheduled.effectiveAt!)}` : "—"}
            </td>
            <td className={cell}>{r.draft ? `Version ${r.draft.version}` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const STATE_LABEL: Record<VersionState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  current: "Current",
  superseded: "Superseded",
};

/** /admin/policies/[slug]: draft editor, publish form and the version history. */
export async function AdminPolicyDetail({
  slug: slugPromise,
  searchParams,
}: {
  slug: Promise<string>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = await slugPromise;
  if (!isPolicySlug(slug)) notFound();
  const history = await policyService.history(slug);
  const { published } = await searchParams;
  const justPublished = history.find((v) => String(v.version) === published && v.state !== "draft");
  const draft = history.find((v) => v.state === "draft");
  const nextVersion = (history[0]?.version ?? 0) + 1;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">{policyTitle(slug)}</h2>
        <p className="text-sm">
          Public page:{" "}
          <Link className="underline" href={policyPath(slug)}>
            {policyPath(slug)}
          </Link>
        </p>
      </div>

      {justPublished && (
        <p role="status" className="rounded border border-green-700 bg-green-50 px-3 py-2 text-green-900">
          Version {justPublished.version} published, effective {formatDateTime(justPublished.effectiveAt!)}.
        </p>
      )}

      <section aria-labelledby="draft-heading" className="flex flex-col gap-3">
        <h3 id="draft-heading" className="text-xl font-semibold">
          {draft ? `Draft version ${draft.version}` : "New version"}
        </h3>
        {draft ? (
          <>
            <DraftEditor
              draft={{ id: draft.id, version: draft.version, title: draft.title, body: draft.body, changeSummary: draft.changeSummary }}
            />
            <details className="rounded border border-gray-300 p-4">
              <summary className="cursor-pointer font-medium">Preview the saved draft</summary>
              <div className="mt-3">
                <PolicyMarkdown body={draft.body} vars={{ DBID: getConfig().dbid ?? "(DBID not set)" }} />
              </div>
            </details>
          </>
        ) : (
          <NewDraftForm slug={slug} nextVersion={nextVersion} />
        )}
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h3 id="history-heading" className="text-xl font-semibold">
          Version history
        </h3>
        {history.length === 0 ? (
          <p>No versions yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className={cell}>Version</th>
                <th scope="col" className={cell}>State</th>
                <th scope="col" className={cell}>Effective from</th>
                <th scope="col" className={cell}>Published</th>
                <th scope="col" className={cell}>Acceptances</th>
                <th scope="col" className={cell}>What changed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((v) => (
                <tr key={v.id}>
                  <th scope="row" className={cell}>
                    {v.state === "current" || v.state === "superseded" ? (
                      <Link className="underline" href={`${policyPath(slug)}?version=${v.version}`}>
                        Version {v.version}
                      </Link>
                    ) : (
                      `Version ${v.version}`
                    )}
                  </th>
                  <td className={cell}>{STATE_LABEL[v.state]}</td>
                  <td className={cell}>{v.effectiveAt ? formatDateTime(v.effectiveAt) : "—"}</td>
                  <td className={cell}>{v.publishedAt ? formatDateTime(v.publishedAt) : "—"}</td>
                  <td className={cell}>{v.acceptances}</td>
                  <td className={cell}>{v.changeSummary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
