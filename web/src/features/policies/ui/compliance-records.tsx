import { Badge, Notice, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";
import { getConfig, TEST_DBID_PLACEHOLDER } from "@/lib/config";
import { RETENTION_RULES, RETENTION_YEARS } from "@/lib/retention";

/** /admin/compliance: DBID status and the record-retention rules (US-081). */
export function ComplianceRecords() {
  const { dbid, appMode } = getConfig();
  const placeholder = dbid === TEST_DBID_PLACEHOLDER;
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="dbid-heading" className="flex flex-col gap-3">
        <h2 id="dbid-heading" className="text-xl font-semibold">
          Digital Business ID (DBID)
        </h2>
        <p>
          Shown in the footer of every page: <strong data-testid="admin-dbid">{dbid ?? "not set"}</strong>
        </p>
        {placeholder && (
          <Notice tone="warning" role="note" title="This is the test placeholder.">
            Before release, register the DBID and set the <code>DBID</code> environment variable (pre-release checklist). The app refuses to start in
            production without it.
          </Notice>
        )}
        {!dbid && appMode === "production" && (
          <Notice tone="danger" role="alert">
            DBID is missing. Set the DBID environment variable.
          </Notice>
        )}
      </section>

      <section aria-labelledby="retention-heading" className="flex flex-col gap-4">
        <h2 id="retention-heading" className="text-xl font-semibold">
          Record retention
        </h2>
        <p className="max-w-prose">
          Business records are kept for <strong>{RETENTION_YEARS} years</strong> (Digital Commerce Operation Guidelines 2021). They are never hard-deleted: shops
          are suspended, orders cancelled, complaints resolved and reviews hidden, and the rows stay. Accounts linked to these records are anonymised, not
          deleted. There is no automatic purge yet; any purge after the retention period will be added here first.
        </p>
        <Table caption="Retention period per record type" stack>
          <Thead>
            <tr>
              <Th>Records</Th>
              <Th>Kept for</Th>
              <Th>Counted from</Th>
              <Th>Rule</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {RETENTION_RULES.map((r) => (
              <Tr key={r.model}>
                <Th scope="row">{r.label}</Th>
                <Td label="Kept for">{r.years} years</Td>
                <Td label="Counted from">{r.from}</Td>
                <Td label="Rule">{r.source}</Td>
                <Td label="Status">{r.built ? <Badge tone="brand">In use</Badge> : <Badge>Applies when built</Badge>}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <p className="text-sm text-muted">The 6-year figure comes from news summaries of the guidelines; check it against the official text before release.</p>
      </section>
    </div>
  );
}
