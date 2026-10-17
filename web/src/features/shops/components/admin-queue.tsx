import { getStorage } from "@/lib/storage";
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
const row = "flex flex-col gap-2 rounded border border-gray-300 p-3";
const actions = "flex flex-wrap items-start gap-4";

function DocLink({ url, label }: { url: string; label: string }) {
  return (
    <a className="text-blue-800 underline" href={url} target="_blank" rel="noreferrer">
      {label} (link valid 5 minutes)
    </a>
  );
}

function ReasonForm({
  action,
  label,
  idName,
  id,
}: {
  action: typeof rejectShop;
  label: string;
  idName: string;
  id: string;
}) {
  return (
    <ActionForm action={action} submitLabel={label} variant="danger">
      <input type="hidden" name={idName} value={id} />
      <Field name="reason" label="Reason" required />
    </ActionForm>
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

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="pending-shops" className="flex flex-col gap-3">
        <h2 id="pending-shops" className="text-xl font-semibold">
          Shop applications ({pendingShops.length})
        </h2>
        {pendingShops.map((s) => (
          <article key={s.id} className={row}>
            <h3 className="font-semibold">
              {s.name} · {SHOP_TYPE_LABELS[s.type]} · /{s.slug}
            </h3>
            <p>
              Owner: {s.owner.name} · {s.owner.email ?? "no email"} · {s.owner.phone ?? "no phone"} · NID {s.ownerNid} ·{" "}
              <DocLink url={signed(s.ownerPhotoKey)} label="Owner photo" />
            </p>
            {s.type === "medicine" && (
              <p>
                Licence:{" "}
                {s.licences.length === 0
                  ? "none"
                  : s.licences.map((l) => `${l.licenceNo} (${l.status}, expires ${date(l.expiryDate)})`).join(", ")}
                {!s.licences.some((l) => isLicenceValid(l, now)) && " · verify the licence before approving"}
              </p>
            )}
            <div className={actions}>
              <ActionForm action={approveShop} submitLabel="Approve">
                <input type="hidden" name="shopId" value={s.id} />
              </ActionForm>
              <ReasonForm action={rejectShop} label="Reject" idName="shopId" id={s.id} />
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="pending-licences" className="flex flex-col gap-3">
        <h2 id="pending-licences" className="text-xl font-semibold">
          Medicine licences to verify ({licences.length})
        </h2>
        <p className="text-sm">
          Check the licence number, issuer, expiry date and shop name against the certificate (and the drug
          administration records where available). Test mode accepts any file.
        </p>
        {licences.map((l) => (
          <article key={l.id} className={row}>
            <h3 className="font-semibold">
              {l.shop.name} · licence {l.licenceNo} · expires {date(l.expiryDate)}
            </h3>
            <DocLink url={signed(l.documentKey)} label="Certificate" />
            <div className={actions}>
              <ActionForm action={verifyLicence} submitLabel="Verify licence">
                <input type="hidden" name="licenceId" value={l.id} />
              </ActionForm>
              <ReasonForm action={rejectLicence} label="Reject licence" idName="licenceId" id={l.id} />
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="pending-upgrades" className="flex flex-col gap-3">
        <h2 id="pending-upgrades" className="text-xl font-semibold">
          Verified upgrades ({upgrades.length})
        </h2>
        {upgrades.map((s) => (
          <article key={s.id} className={row}>
            <h3 className="font-semibold">
              {s.name} · {s.registrationType && REGISTRATION_TYPE_LABELS[s.registrationType]} {s.registrationNo}
            </h3>
            {s.registrationDocKey && <DocLink url={signed(s.registrationDocKey)} label="Registration document" />}
            <div className={actions}>
              <ActionForm action={approveUpgrade} submitLabel="Approve upgrade">
                <input type="hidden" name="shopId" value={s.id} />
              </ActionForm>
              <ReasonForm action={rejectUpgrade} label="Reject upgrade" idName="shopId" id={s.id} />
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="active-shops" className="flex flex-col gap-3">
        <h2 id="active-shops" className="text-xl font-semibold">
          Approved and suspended shops ({approvedShops.length})
        </h2>
        {approvedShops.map((s) => (
          <article key={s.id} className={row}>
            <h3 className="font-semibold">
              {s.name} · {s.status} · {s.tier}
              {s.medicineSuspended && " · medicine suspended (licence expired)"}
            </h3>
            {s.status === "approved" ? (
              <ReasonForm action={suspendShop} label="Suspend" idName="shopId" id={s.id} />
            ) : (
              <ActionForm action={approveShop} submitLabel="Reinstate">
                <input type="hidden" name="shopId" value={s.id} />
              </ActionForm>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
