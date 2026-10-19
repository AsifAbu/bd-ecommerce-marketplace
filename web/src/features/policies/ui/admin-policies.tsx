import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status";
import { Badge, buttonStyles, Notice } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/admin/data-table";
import { getConfig } from "@/lib/config";
import { isPolicySlug, policyPath, policyTitle } from "../catalog";
import { formatDateTime } from "../dates";
import type { VersionState } from "../rules";
import { policyService } from "../server";
import { DraftEditor, NewDraftForm } from "./draft-editor";
import { PolicyMarkdown } from "./policy-markdown";

const link = "font-medium text-jade underline-offset-4 hover:underline";

/** /admin/policies: every policy with its current, scheduled and draft version. */
export async function AdminPolicyList() {
  const rows = await policyService.adminOverview();
  return (
    <Table caption="Policies and their versions" stack>
      <Thead>
        <tr>
          <Th>Policy</Th>
          <Th>Current version</Th>
          <Th>Scheduled</Th>
          <Th>Draft</Th>
        </tr>
      </Thead>
      <Tbody>
        {rows.map((r) => (
          <Tr key={r.slug}>
            <Th scope="row">
              <Link className={link} href={`/admin/policies/${r.slug}`}>
                {r.title}
              </Link>
            </Th>
            <Td label="Current version">
              {r.current ? (
                <>
                  Version {r.current.version}, effective {formatDateTime(r.current.effectiveAt!)}
                </>
              ) : (
                <Badge tone="sale">Not published</Badge>
              )}
            </Td>
            <Td label="Scheduled">{r.scheduled ? `Version ${r.scheduled.version} from ${formatDateTime(r.scheduled.effectiveAt!)}` : "—"}</Td>
            <Td label="Draft">{r.draft ? <StatusBadge status="draft">{`Version ${r.draft.version}`}</StatusBadge> : "—"}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
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
    <>
      <AdminPageHeader
        title={policyTitle(slug)}
        description="Published versions never change. Write the next version as a draft, then publish it."
        crumbs={[{ label: "Policies", href: "/admin/policies" }, { label: policyTitle(slug) }]}
        action={
          <Link className={buttonStyles({ variant: "secondary" })} href={policyPath(slug)}>
            View public page
          </Link>
        }
      />

      {justPublished && (
        <Notice tone="success" role="status">
          Version {justPublished.version} published, effective {formatDateTime(justPublished.effectiveAt!)}.
        </Notice>
      )}

      <section aria-labelledby="draft-heading" className="flex flex-col gap-4">
        <h2 id="draft-heading" className="text-xl font-semibold">
          {draft ? `Draft version ${draft.version}` : "New version"}
        </h2>
        {draft ? (
          <>
            <DraftEditor
              draft={{ id: draft.id, version: draft.version, title: draft.title, body: draft.body, changeSummary: draft.changeSummary }}
            />
            <details className="rounded-lg border border-line p-4">
              <summary className="cursor-pointer font-medium">Preview the saved draft</summary>
              <div className="mt-4 max-w-[70ch]">
                <PolicyMarkdown body={draft.body} vars={{ DBID: getConfig().dbid ?? "(DBID not set)" }} />
              </div>
            </details>
          </>
        ) : (
          <NewDraftForm slug={slug} nextVersion={nextVersion} />
        )}
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-4">
        <h2 id="history-heading" className="text-xl font-semibold">
          Version history
        </h2>
        {history.length === 0 ? (
          <p className="text-muted">No versions yet.</p>
        ) : (
          <Table caption={`Version history of ${policyTitle(slug)}`} stack>
            <Thead>
              <tr>
                <Th>Version</Th>
                <Th>State</Th>
                <Th>Effective from</Th>
                <Th>Published</Th>
                <Th align="right">Acceptances</Th>
                <Th>What changed</Th>
              </tr>
            </Thead>
            <Tbody>
              {history.map((v) => (
                <Tr key={v.id}>
                  <Th scope="row">
                    {v.state === "current" || v.state === "superseded" ? (
                      <Link className={link} href={`${policyPath(slug)}?version=${v.version}`}>
                        Version {v.version}
                      </Link>
                    ) : (
                      `Version ${v.version}`
                    )}
                  </Th>
                  <Td label="State">
                    <StatusBadge status={v.state}>{STATE_LABEL[v.state]}</StatusBadge>
                  </Td>
                  <Td label="Effective from">{v.effectiveAt ? formatDateTime(v.effectiveAt) : "—"}</Td>
                  <Td label="Published">{v.publishedAt ? formatDateTime(v.publishedAt) : "—"}</Td>
                  <Td label="Acceptances" align="right">
                    {v.acceptances}
                  </Td>
                  <Td label="What changed">{v.changeSummary ?? "—"}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </section>
    </>
  );
}
