import { getConfig, TEST_DBID_PLACEHOLDER } from "@/lib/config";
import { RETENTION_RULES, RETENTION_YEARS } from "@/lib/retention";

const cell = "border-b border-gray-300 px-2 py-2 text-left align-top";

/** /admin/compliance: DBID status and the record-retention rules (US-081). */
export function ComplianceRecords() {
  const { dbid, appMode } = getConfig();
  const placeholder = dbid === TEST_DBID_PLACEHOLDER;
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="dbid-heading" className="flex flex-col gap-2">
        <h2 id="dbid-heading" className="text-xl font-semibold">
          Digital Business ID (DBID)
        </h2>
        <p>
          Shown in the footer of every page: <strong data-testid="admin-dbid">{dbid ?? "not set"}</strong>
        </p>
        {placeholder && (
          <p role="note" className="rounded border border-amber-600 bg-amber-50 px-3 py-2 text-sm">
            This is the test placeholder. Before release, register the DBID and set the <code>DBID</code> environment variable
            (pre-release checklist). The app refuses to start in production without it.
          </p>
        )}
        {!dbid && appMode === "production" && (
          <p role="alert" className="text-red-700">
            DBID is missing. Set the DBID environment variable.
          </p>
        )}
      </section>

      <section aria-labelledby="retention-heading" className="flex flex-col gap-3">
        <h2 id="retention-heading" className="text-xl font-semibold">
          Record retention
        </h2>
        <p>
          Business records are kept for <strong>{RETENTION_YEARS} years</strong> (Digital Commerce Operation Guidelines 2021).
          They are never hard-deleted: shops are suspended, orders cancelled, complaints resolved and reviews hidden, and the
          rows stay. Accounts linked to these records are anonymised, not deleted. There is no automatic purge yet; any purge
          after the retention period will be added here first.
        </p>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Retention period per record type</caption>
          <thead>
            <tr>
              <th scope="col" className={cell}>Records</th>
              <th scope="col" className={cell}>Kept for</th>
              <th scope="col" className={cell}>Counted from</th>
              <th scope="col" className={cell}>Rule</th>
              <th scope="col" className={cell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION_RULES.map((r) => (
              <tr key={r.model}>
                <th scope="row" className={cell}>
                  {r.label}
                </th>
                <td className={cell}>{r.years} years</td>
                <td className={cell}>{r.from}</td>
                <td className={cell}>{r.source}</td>
                <td className={cell}>{r.built ? "In use" : "Applies when built"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-gray-700">
          The 6-year figure comes from news summaries of the guidelines; check it against the official text before release.
        </p>
      </section>
    </div>
  );
}
