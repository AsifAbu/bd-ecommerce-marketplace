import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/admin/status";
import { Badge, FilterChips, Notice } from "@/components/ui";
import { getStorage } from "@/lib/storage";
import { storefrontPath, storefrontUrl } from "@/lib/storefront-link";
import {
  approveShop,
  approveUpgrade,
  rejectLicence,
  rejectShop,
  rejectUpgrade,
  suspendShop,
  verifyLicence,
} from "../actions";
import * as repo from "../repo";
import { isLicenceValid } from "../rules";
import { REGISTRATION_TYPE_LABELS, SHOP_TYPE_LABELS } from "../schemas";
import { ActionForm, Field } from "@/components/action-form";

const date = (d: Date) => d.toISOString().slice(0, 10);
const DAY_MS = 24 * 3_600_000;

/** "today", "1 day ago", "5 days ago". */
function ago(d: Date, now: Date): string {
  const days = Math.floor((now.getTime() - d.getTime()) / DAY_MS);
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function DocLink({ url, label }: { url: string; label: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <a className="inline-flex items-center gap-1 font-medium text-jade underline-offset-4 hover:underline" href={url} target="_blank" rel="noreferrer">
        {label}
        <ExternalLink aria-hidden="true" size={14} />
      </a>
      <span className="text-muted">(link valid 5 minutes)</span>
    </span>
  );
}

/** Reject / suspend: the reason is required and the button says what it does. */
function ReasonForm({
  action,
  label,
  idName,
  id,
  hint,
}: {
  action: typeof rejectShop;
  label: string;
  idName: string;
  id: string;
  hint?: string;
}) {
  return (
    <ActionForm action={action} submitLabel={label} variant="danger" className="flex flex-col gap-2">
      <input type="hidden" name={idName} value={id} />
      <Field name="reason" label="Reason" hint={hint} required />
    </ActionForm>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-1.5 text-sm [&_dt]:text-muted [&_dd]:min-w-0 [&_dd]:break-words">{children}</dl>;
}

/** Decision area of a queue item: the main (approve) action on the left, the refusal with its reason beside it. */
function Decision({ approve, reject }: { approve: ReactNode; reject: ReactNode }) {
  return (
    <div className="grid gap-5 rounded-md bg-surface p-4 md:grid-cols-[auto_minmax(0,24rem)] md:gap-10">
      <div>{approve}</div>
      <div>{reject}</div>
    </div>
  );
}

const queueItem = "flex flex-col gap-4 rounded-lg border border-line p-4 sm:p-5";

function QueueSection({ id, title, count, intro, empty, children }: { id: string; title: string; count: number; intro?: string; empty: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="flex items-center gap-3 text-xl font-semibold">
          {title} ({count})
          {count > 0 && <Badge tone="warning">Waiting for you</Badge>}
        </h2>
        {intro && <p className="max-w-prose text-sm text-muted">{intro}</p>}
      </div>
      {count === 0 ? <p className="text-muted">{empty}</p> : <div className="flex flex-col gap-4">{children}</div>}
    </section>
  );
}

/** US-011 / US-016 / US-017 Platform Admin queue. Only render after requirePlatformAdmin(). */
export async function AdminQueue() {
  const { pendingShops, upgrades, licences, approvedShops } = await repo.adminListQueue();
  const storage = getStorage();
  const keys = [
    ...pendingShops.map((s) => s.ownerPhotoKey),
    ...licences.map((l) => l.documentKey),
    ...upgrades.flatMap((s) => (s.registrationDocKey ? [s.registrationDocKey] : [])),
  ];
  const urls = new Map(await Promise.all(keys.map(async (k) => [k, await storage.getSignedUrl(k)] as const)));
  const signed = (key: string) => urls.get(key) ?? "#";
  const now = new Date();
  const waiting = pendingShops.length + licences.length + upgrades.length;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        {waiting === 0 ? (
          <Notice tone="success">
            <p className="font-semibold">Nothing is waiting for review.</p>
            New applications, licences and upgrade requests will appear here.
          </Notice>
        ) : (
          <Notice tone="warning">
            <p className="font-semibold">{`${waiting} ${waiting === 1 ? "item is" : "items are"} waiting for your decision.`}</p>
            Applicants cannot sell until a shop is approved. Oldest first.
          </Notice>
        )}
        <FilterChips
          label="Queue sections"
          items={[
            { label: "Applications", href: "#pending-shops", count: pendingShops.length },
            { label: "Licences", href: "#pending-licences", count: licences.length },
            { label: "Upgrades", href: "#pending-upgrades", count: upgrades.length },
            { label: "Live shops", href: "#active-shops", count: approvedShops.length },
          ]}
        />
      </div>

      <QueueSection id="pending-shops" title="Shop applications" count={pendingShops.length} empty="No applications are waiting.">
        {pendingShops.map((s) => {
          const licenceMissing = s.type === "medicine" && !s.licences.some((l) => isLicenceValid(l, now));
          return (
            <article key={s.id} className={`${queueItem} flash-result`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h3 className="text-lg font-semibold">{s.name}</h3>
                  <p className="text-sm text-muted">
                    {SHOP_TYPE_LABELS[s.type]}, storefront /{s.slug}
                  </p>
                </div>
                <StatusBadge status="pending">Applied {ago(s.createdAt, now)}</StatusBadge>
              </div>
              <Facts>
                <dt>Owner</dt>
                <dd>{s.owner.name}</dd>
                <dt>Contact</dt>
                <dd>
                  {s.owner.email ?? "No email"}, {s.owner.phone ?? "no phone"}
                </dd>
                <dt>NID</dt>
                <dd className="tabular">{s.ownerNid}</dd>
                <dt>Documents</dt>
                <dd>
                  <DocLink url={signed(s.ownerPhotoKey)} label="Owner photo" />
                </dd>
                {s.type === "medicine" && (
                  <>
                    <dt>Licence</dt>
                    <dd>
                      {s.licences.length === 0 ? (
                        "None uploaded"
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {s.licences.map((l) => (
                            <li key={l.id} className="flex flex-wrap items-center gap-2">
                              <span className="tabular">
                                {l.licenceNo} ({l.status}, expires {date(l.expiryDate)})
                              </span>
                              <StatusBadge status={l.status}>{l.status === "verified" ? "Verified" : l.status === "rejected" ? "Rejected" : "Pending"}</StatusBadge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </dd>
                  </>
                )}
              </Facts>
              {licenceMissing && (
                <Notice tone="warning">Verify the licence before approving. A medicine shop cannot be approved without a verified licence.</Notice>
              )}
              <Decision
                approve={
                  <ActionForm action={approveShop} submitLabel="Approve">
                    <input type="hidden" name="shopId" value={s.id} />
                  </ActionForm>
                }
                reject={<ReasonForm action={rejectShop} label="Reject" idName="shopId" id={s.id} hint="Sent to the applicant." />}
              />
            </article>
          );
        })}
      </QueueSection>

      <QueueSection
        id="pending-licences"
        title="Medicine licences to verify"
        count={licences.length}
        intro="Check the licence number, issuer, expiry date and shop name against the certificate, and against the drug administration records where available. Test mode accepts any file."
        empty="No licences are waiting."
      >
        {licences.map((l) => (
          <article key={l.id} className={`${queueItem} flash-result`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="text-lg font-semibold">{l.shop.name}</h3>
                <p className="text-sm text-muted">Licence {l.licenceNo}</p>
              </div>
              <StatusBadge status="pending">Submitted {ago(l.createdAt, now)}</StatusBadge>
            </div>
            <Facts>
              <dt>Licence number</dt>
              <dd className="tabular">{l.licenceNo}</dd>
              <dt>Expires</dt>
              <dd className="tabular">{date(l.expiryDate)}</dd>
              <dt>Certificate</dt>
              <dd>
                <DocLink url={signed(l.documentKey)} label="Open certificate" />
              </dd>
            </Facts>
            <Decision
              approve={
                <ActionForm action={verifyLicence} submitLabel="Verify licence">
                  <input type="hidden" name="licenceId" value={l.id} />
                </ActionForm>
              }
              reject={<ReasonForm action={rejectLicence} label="Reject licence" idName="licenceId" id={l.id} hint="Sent to the shop owner." />}
            />
          </article>
        ))}
      </QueueSection>

      <QueueSection
        id="pending-upgrades"
        title="Verified upgrades"
        count={upgrades.length}
        intro="Basic shops that asked to become Verified by sending a business registration."
        empty="No upgrade requests are waiting."
      >
        {upgrades.map((s) => (
          <article key={s.id} className={`${queueItem} flash-result`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{s.name}</h3>
              <StatusBadge status="pending">Upgrade requested</StatusBadge>
            </div>
            <Facts>
              <dt>Registration</dt>
              <dd>
                {s.registrationType && REGISTRATION_TYPE_LABELS[s.registrationType]} <span className="tabular">{s.registrationNo}</span>
              </dd>
              {s.registrationDocKey && (
                <>
                  <dt>Document</dt>
                  <dd>
                    <DocLink url={signed(s.registrationDocKey)} label="Registration document" />
                  </dd>
                </>
              )}
            </Facts>
            <Decision
              approve={
                <ActionForm action={approveUpgrade} submitLabel="Approve upgrade">
                  <input type="hidden" name="shopId" value={s.id} />
                </ActionForm>
              }
              reject={<ReasonForm action={rejectUpgrade} label="Reject upgrade" idName="shopId" id={s.id} hint="Sent to the shop owner." />}
            />
          </article>
        ))}
      </QueueSection>

      <section aria-labelledby="active-shops" className="flex scroll-mt-24 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="active-shops" className="text-xl font-semibold">
            Approved and suspended shops ({approvedShops.length})
          </h2>
          <p className="max-w-prose text-sm text-muted">Suspending hides the shop and its listings from buyers until you reinstate it. The reason is shown to the owner.</p>
        </div>
        {approvedShops.length === 0 ? (
          <p className="text-muted">No shops are live yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {approvedShops.map((s) => (
              <article key={s.id} className="flash-result flex flex-col gap-3 rounded-lg border border-line p-4 md:flex-row md:items-start md:justify-between md:gap-8">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{s.name}</h3>
                    <StatusBadge status={s.status}>{s.status === "approved" ? "Approved" : "Suspended"}</StatusBadge>
                    <Badge>{s.tier === "verified" ? "Verified seller" : "Basic seller"}</Badge>
                    {s.medicineSuspended && <Badge tone="sale">Medicine suspended, licence expired</Badge>}
                  </div>
                  {s.status === "approved" && (
                    <p className="break-all text-sm">
                      <span className="text-muted">Storefront: </span>
                      <a className="font-medium text-jade underline-offset-4 hover:underline" href={storefrontPath(s.slug)} target="_blank" rel="noreferrer">
                        {storefrontUrl(s.slug)}
                      </a>
                    </p>
                  )}
                </div>
                <div className="md:w-full md:max-w-sm md:shrink-0">
                  {s.status === "approved" ? (
                    <ReasonForm action={suspendShop} label="Suspend" idName="shopId" id={s.id} />
                  ) : (
                    <ActionForm action={approveShop} submitLabel="Reinstate">
                      <input type="hidden" name="shopId" value={s.id} />
                    </ActionForm>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
