import Link from "next/link";
import type { ShopRole } from "@/generated/prisma/client";
import { TIER_LIMITS } from "@/lib/shop-tiers";
import { storefrontPath } from "@/lib/storefront-link";
import { inviteStaff, removeStaff, requestUpgrade, updateProfile, uploadLicence } from "../actions";
import * as repo from "../repo";
import { REGISTRATION_TYPE_LABELS, REGISTRATION_TYPES, SHOP_TYPE_LABELS } from "../schemas";
import { ActionForm, Field } from "@/components/action-form";
import { ShareStorefront } from "./share-storefront";

const FILE_HINT = "PDF, JPG, PNG or WebP, up to 4 MB. In test mode any file is accepted.";
const date = (d: Date) => d.toISOString().slice(0, 10);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={title} className="flex flex-col gap-3 rounded border border-gray-300 p-4">
      <h2 id={title} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Seller home for one shop. `shopId` must come from requireShopRole(). */
export async function SellerDashboard({ shopId, role }: { shopId: string; role: ShopRole }) {
  const [shop, licences, members, invites] = await Promise.all([
    repo.getShop(shopId),
    repo.listLicences(shopId),
    repo.listMembers(shopId),
    repo.listPendingInvites(shopId),
  ]);
  if (!shop) return null;
  const isOwner = role === "owner";
  const limits = TIER_LIMITS[shop.tier];
  const hidden = <input type="hidden" name="shopId" value={shop.id} />;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{shop.name}</h1>
        <p>
          {SHOP_TYPE_LABELS[shop.type]} shop · storefront: {storefrontPath(shop.slug)} · your role: {role}
        </p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          <dt className="font-medium">Status</dt>
          <dd>
            {shop.status}
            {shop.statusReason && ` (reason: ${shop.statusReason})`}
          </dd>
          <dt className="font-medium">Seller tier</dt>
          <dd>
            {shop.tier === "verified" ? "Verified seller" : "Basic"} · open orders:{" "}
            {limits.maxOpenOrders ?? "no limit"} · live listings: {limits.maxLiveListings ?? "no limit"}
          </dd>
          {shop.type === "medicine" && (
            <>
              <dt className="font-medium">Medicine selling</dt>
              <dd>{shop.medicineSuspended ? "Suspended: the licence has expired" : "Allowed once the licence is verified"}</dd>
            </>
          )}
        </dl>
        <nav aria-label="Manage shop" className="flex flex-wrap gap-4">
          <Link className="text-blue-800 underline" href={`/seller/${shop.id}/products`}>
            Products
          </Link>
          <Link className="text-blue-800 underline" href={`/seller/${shop.id}/orders`}>
            Orders
          </Link>
          <Link className="text-blue-800 underline" href={`/seller/${shop.id}/reviews`}>
            Reviews
          </Link>
          {isOwner && (
            <Link className="text-blue-800 underline" href={`/seller/${shop.id}/payouts`}>
              Payouts
            </Link>
          )}
          <Link className="text-blue-800 underline" href={`/seller/${shop.id}/returns`}>
            Returns
          </Link>
          <Link className="text-blue-800 underline" href={`/seller/${shop.id}/complaints`}>
            Complaints
          </Link>
          {shop.status === "approved" && (
            <Link className="text-blue-800 underline" href={storefrontPath(shop.slug)}>
              View storefront
            </Link>
          )}
        </nav>
      </header>

      <ShareStorefront slug={shop.slug} status={shop.status} />

      {isOwner && shop.type === "medicine" && (
        <Section title="Drug licence">
          <ul className="flex flex-col gap-1">
            {licences.map((l) => (
              <li key={l.id}>
                {l.licenceNo}, expires {date(l.expiryDate)}: <strong>{l.status}</strong>
                {l.reason && ` (reason: ${l.reason})`}
              </li>
            ))}
          </ul>
          {licences.some((l) => l.status === "pending") ? (
            <p>Your licence is waiting for verification by the Platform Admin.</p>
          ) : (
            <ActionForm action={uploadLicence} submitLabel="Upload new licence">
              {hidden}
              <Field name="licenceNo" label="Licence number" required />
              <Field name="licenceExpiry" label="Expiry date" type="date" required />
              <Field name="licenceFile" label="Licence certificate" type="file" accept=".pdf,image/*" hint={FILE_HINT} required />
            </ActionForm>
          )}
        </Section>
      )}

      {isOwner && shop.tier === "basic" && (
        <Section title="Upgrade to Verified seller">
          {shop.upgradeStatus === "pending" ? (
            <p>Your upgrade request is waiting for review.</p>
          ) : (
            <>
              <p>Verified sellers have no order or listing limits and get a &quot;Verified seller&quot; badge.</p>
              {shop.upgradeStatus === "rejected" && (
                <p className="text-red-700">Your last request was rejected: {shop.upgradeReason}</p>
              )}
              <ActionForm action={requestUpgrade} submitLabel="Request upgrade">
                {hidden}
                <Field
                  as="select"
                  name="registrationType"
                  label="Registration type"
                  required
                  options={REGISTRATION_TYPES.map((t) => ({ value: t, label: REGISTRATION_TYPE_LABELS[t] }))}
                />
                <Field name="registrationNo" label="Registration number" required />
                <Field name="registrationDoc" label="Registration document" type="file" accept=".pdf,image/*" hint={FILE_HINT} required />
              </ActionForm>
            </>
          )}
        </Section>
      )}

      {isOwner && (
        <Section title="Shop profile">
          <ActionForm action={updateProfile} submitLabel="Save profile">
            {hidden}
            <Field name="logoUrl" label="Logo URL" type="url" defaultValue={shop.logoUrl ?? ""} />
            <Field name="bannerUrl" label="Banner URL" type="url" defaultValue={shop.bannerUrl ?? ""} />
            <Field as="textarea" name="description" label="Description" defaultValue={shop.description ?? ""} />
            <Field as="textarea" name="policies" label="Shop policies" rows={6} defaultValue={shop.policies ?? ""} />
            <Field
              name="freeDeliveryThreshold"
              label="Free delivery from (Tk)"
              hint="Orders from your shop of this amount or more get free delivery (your shop covers the delivery charge). Leave empty for none."
              defaultValue={shop.freeDeliveryThreshold?.toString() ?? ""}
            />
          </ActionForm>
        </Section>
      )}

      {isOwner && (
        <Section title="Staff">
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3">
                <span>
                  {m.user.name ?? m.user.email} ({m.user.email}) · {m.role}
                </span>
                {m.role === "staff" && (
                  <ActionForm action={removeStaff} submitLabel="Remove" variant="danger" className="flex items-center gap-2">
                    {hidden}
                    <input type="hidden" name="memberId" value={m.id} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
          {invites.length > 0 && (
            <p>Invites waiting: {invites.map((i) => `${i.email} (until ${date(i.expiresAt)})`).join(", ")}</p>
          )}
          <ActionForm action={inviteStaff} submitLabel="Send invite">
            {hidden}
            <Field name="email" label="Staff email" type="email" required />
          </ActionForm>
        </Section>
      )}
    </div>
  );
}
