import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, buttonStyles, Notice, Section, statusTone } from "@/components/ui";
import type { ShopRole } from "@/generated/prisma/client";
import { TIER_LIMITS } from "@/lib/shop-tiers";
import { storefrontPath } from "@/lib/storefront-link";
import { inviteStaff, removeStaff, requestUpgrade, updateProfile, uploadLicence } from "../actions";
import * as repo from "../repo";
import { REGISTRATION_TYPE_LABELS, REGISTRATION_TYPES, SHOP_TYPE_LABELS } from "../schemas";
import { ActionForm, Field } from "@/components/action-form";
import { ShopStatusBadge, TierBadge } from "./shop-badges";
import { ShareStorefront } from "./share-storefront";

const FILE_HINT = "PDF, JPG, PNG or WebP, up to 4 MB. In test mode any file is accepted.";
const date = (d: Date) => d.toISOString().slice(0, 10);

/** A seller dashboard section: title, then content at a readable width. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title} className="max-w-2xl">
      {children}
    </Section>
  );
}

const LICENCE_TEXT = { pending: "Waiting for verification", verified: "Verified", rejected: "Rejected", expired: "Expired" } as const;

/**
 * Seller home for one shop: status header, then (`attention`) what needs action, the storefront
 * link and the owner's licence, upgrade, profile and staff sections. `shopId` must come from requireShopRole().
 */
export async function SellerDashboard({ shopId, role, attention }: { shopId: string; role: ShopRole; attention?: ReactNode }) {
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
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold sm:text-4xl">{shop.name}</h1>
          <p className="text-muted">
            {SHOP_TYPE_LABELS[shop.type]} shop, your role: {role}
          </p>
        </div>
        <dl className="grid max-w-3xl gap-x-8 gap-y-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <dt className="text-sm text-muted">Status</dt>
            <dd className="flex flex-col items-start gap-1">
              <ShopStatusBadge status={shop.status} />
              {shop.statusReason && <span className="text-sm text-muted">Reason: {shop.statusReason}</span>}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="text-sm text-muted">Seller tier</dt>
            <dd className="flex flex-col items-start gap-1">
              <TierBadge tier={shop.tier} />
              <span className="text-sm text-muted">
                Open orders: {limits.maxOpenOrders ?? "no limit"}. Live listings: {limits.maxLiveListings ?? "no limit"}.
              </span>
            </dd>
          </div>
          {shop.type === "medicine" && (
            <div className="flex flex-col gap-1.5">
              <dt className="text-sm text-muted">Medicine selling</dt>
              <dd className="flex flex-col items-start gap-1">
                <Badge tone={shop.medicineSuspended ? "sale" : "warning"}>{shop.medicineSuspended ? "Suspended" : "Needs a verified licence"}</Badge>
                <span className="text-sm text-muted">{shop.medicineSuspended ? "Suspended: the licence has expired" : "Allowed once the licence is verified"}</span>
              </dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap gap-3">
          <Link className={buttonStyles()} href={`/seller/${shop.id}/products/new`}>
            Add a product
          </Link>
          {shop.status === "approved" && (
            <Link className={buttonStyles({ variant: "secondary" })} href={storefrontPath(shop.slug)}>
              View storefront
            </Link>
          )}
        </div>
      </header>

      {attention}

      <ShareStorefront slug={shop.slug} status={shop.status} />

      {isOwner && shop.type === "medicine" && (
        <Block title="Drug licence">
          <ul className="divide-y divide-line border-y border-line">
            {licences.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {l.licenceNo}, expires {date(l.expiryDate)}
                  {l.reason && <span className="block text-sm text-muted">Reason: {l.reason}</span>}
                </span>
                <Badge tone={statusTone(l.status)}>{LICENCE_TEXT[l.status]}</Badge>
              </li>
            ))}
          </ul>
          {licences.some((l) => l.status === "pending") ? (
            <Notice tone="info">Your licence is waiting for verification by the Platform Admin.</Notice>
          ) : (
            <ActionForm action={uploadLicence} submitLabel="Upload new licence" label="Upload a drug licence">
              {hidden}
              <Field name="licenceNo" label="Licence number" required />
              <Field name="licenceExpiry" label="Expiry date" type="date" required />
              <Field name="licenceFile" label="Licence certificate" type="file" accept=".pdf,image/*" hint={FILE_HINT} required />
            </ActionForm>
          )}
        </Block>
      )}

      {isOwner && shop.tier === "basic" && (
        <Block title="Upgrade to Verified seller">
          {shop.upgradeStatus === "pending" ? (
            <Notice tone="info">Your upgrade request is waiting for review.</Notice>
          ) : (
            <>
              <p className="text-muted">Verified sellers have no order or listing limits and get a &quot;Verified seller&quot; badge.</p>
              {shop.upgradeStatus === "rejected" && <Notice tone="error">Your last request was rejected: {shop.upgradeReason}</Notice>}
              <ActionForm action={requestUpgrade} submitLabel="Request upgrade" label="Request an upgrade">
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
        </Block>
      )}

      {isOwner && (
        <Block title="Shop profile">
          <ActionForm action={updateProfile} submitLabel="Save profile" label="Shop profile">
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
        </Block>
      )}

      {isOwner && (
        <Block title="Staff">
          <ul className="divide-y divide-line border-y border-line">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                <span className="min-w-0">
                  <span className="block break-words font-medium">{m.user.name ?? m.user.email}</span>
                  <span className="block break-all text-sm text-muted">{m.user.email}</span>
                </span>
                <span className="flex items-center gap-3">
                  <Badge>{m.role === "owner" ? "Owner" : "Staff"}</Badge>
                  {m.role === "staff" && (
                    <ActionForm action={removeStaff} submitLabel="Remove" variant="danger-outline" label={`Remove ${m.user.name ?? m.user.email}`} className="flex items-center gap-2">
                      {hidden}
                      <input type="hidden" name="memberId" value={m.id} />
                    </ActionForm>
                  )}
                </span>
              </li>
            ))}
            {invites.map((i) => (
              <li key={`${i.email}-${i.expiresAt.toISOString()}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <span className="break-all">{i.email}</span>
                <Badge tone="warning">Invited until {date(i.expiresAt)}</Badge>
              </li>
            ))}
          </ul>
          <ActionForm action={inviteStaff} submitLabel="Send invite" label="Invite staff">
            {hidden}
            <Field name="email" label="Staff email" type="email" required />
          </ActionForm>
        </Block>
      )}
    </div>
  );
}
