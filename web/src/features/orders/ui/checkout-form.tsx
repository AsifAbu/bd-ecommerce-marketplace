"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Badge, Button, cn, FormField, Input, Notice } from "@/components/ui";
import { AddressFields } from "@/features/accounts/ui/address-fields";
import { PolicyConsent, type PolicySlug } from "@/features/policies/client";
import type { DeliveryZone } from "@/lib/delivery";
import type { Review, ReviewShop } from "../review";

/**
 * The checkout page form (US-051 logged in, US-007 guest). Logged in: choose a saved address or
 * add one, verify the account mobile by OTP if needed. Guest: name, mobile (OTP), email and the
 * address. Both: every shop order with its items, delivery charge (zone of the address) and
 * total, the policy consent box, and Place order (cash on delivery). Talks to the JSON API.
 * Single column: contact, address, review, consent, place order.
 */

const tk = (n: number) => `Tk ${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const insideDhaka = (district: string) => district.trim().toLowerCase() === "dhaka";

type ApiError = { code: string; message: string; fields?: Record<string, string> };

async function post(url: string, body: unknown): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: ApiError }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: ApiError };
    if (!res.ok) return { ok: false, error: data.error ?? { code: "ERROR", message: "Something went wrong. Please try again." } };
    return { ok: true, data };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Could not reach the server. Check your connection and try again." } };
  }
}

export interface SavedAddress {
  id: string;
  label: string;
  zone: DeliveryZone;
  isDefault: boolean;
}

export interface CheckoutFormProps {
  mode: "user" | "guest";
  idempotencyKey: string;
  reviews: Record<DeliveryZone, Review>;
  policySlugs: readonly PolicySlug[];
  policyVersions: { slug: PolicySlug; version: number }[];
  /** Logged in only. */
  addresses?: SavedAddress[];
  /** Logged in only: the account mobile (01XXXXXXXXX) and whether it is verified. */
  phone?: { local: string | null; verified: boolean };
}

/** A small number in front of a section title: the page is one column, the numbers show where you are. */
function Heading({ n, as: Tag = "h2", id, children }: { n: number; as?: "h2" | "div"; id?: string; children: ReactNode }) {
  return (
    <Tag id={id} className="mb-4 flex items-center gap-3 p-0 text-xl font-semibold">
      <span aria-hidden="true" className="tabular inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-jade-soft text-sm font-semibold text-jade-hover">
        {n}
      </span>
      {children}
    </Tag>
  );
}

export function CheckoutForm(props: CheckoutFormProps) {
  const router = useRouter();
  const addresses = props.addresses ?? [];
  const [addressChoice, setAddressChoice] = useState<string>(
    props.mode === "user" ? (addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "new") : "new",
  );
  const [newDistrict, setNewDistrict] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(props.phone?.verified ?? false);
  const [error, setError] = useState<ApiError | null>(null);
  const [placing, setPlacing] = useState(false);

  const chosen = addresses.find((a) => a.id === addressChoice);
  const zone: DeliveryZone | null = chosen ? chosen.zone : newDistrict ? (insideDhaka(newDistrict) ? "inside_dhaka" : "outside_dhaka") : null;
  const review = props.reviews[zone ?? "inside_dhaka"];
  const fields = error?.fields ?? {};
  const addressErrors = Object.fromEntries(
    Object.entries(fields)
      .filter(([k]) => k.startsWith("address."))
      .map(([k, v]) => [k.slice("address.".length), v]),
  );

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");
    const address: Record<string, string> = {};
    for (const [k, v] of fd) if (k.startsWith("address.") && typeof v === "string") address[k.slice(8)] = v;
    const policyVersions: Record<string, number> = {};
    for (const v of props.policyVersions) {
      const raw = get(`policyVersion.${v.slug}`);
      if (/^\d+$/.test(raw)) policyVersions[v.slug] = Number(raw);
    }
    const body: Record<string, unknown> = {
      idempotencyKey: props.idempotencyKey,
      acceptPolicies: get("acceptPolicies") === "on",
      policyVersions,
    };
    if (props.mode === "user") {
      if (addressChoice === "new") body.address = address;
      else body.addressId = addressChoice;
    } else {
      body.contact = { name: get("contact.name"), phone: get("contact.phone"), email: get("contact.email") };
      body.address = address;
    }
    setPlacing(true);
    setError(null);
    const result = await post("/api/checkout", body);
    if (!result.ok) {
      setPlacing(false);
      setError(result.error);
      return;
    }
    router.push(`${String(result.data.url)}?placed=1`);
  }

  const canPlace = review.ready && phoneVerified && zone !== null;
  const radioRow =
    "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-line px-3 py-3 has-[:checked]:border-jade has-[:checked]:bg-jade-soft";

  return (
    <form onSubmit={submit} className="flex flex-col gap-10" noValidate aria-label="Checkout">
      {props.mode === "guest" ? (
        <GuestContact fields={fields} onVerified={() => setPhoneVerified(true)} verified={phoneVerified} />
      ) : (
        <AccountPhone phone={props.phone!} verified={phoneVerified} onVerified={() => setPhoneVerified(true)} />
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="p-0">
          <Heading n={2} as="div">
            Delivery address
          </Heading>
        </legend>
        {props.mode === "user" &&
          addresses.map((a) => (
            <label key={a.id} className={radioRow}>
              <input
                type="radio"
                name="addressChoice"
                value={a.id}
                checked={addressChoice === a.id}
                onChange={() => setAddressChoice(a.id)}
                className="mt-0.5 size-5 accent-jade"
              />
              <span className="min-w-0">
                {a.label}
                {a.isDefault && (
                  <Badge className="ml-2 align-middle">Default</Badge>
                )}
              </span>
            </label>
          ))}
        {props.mode === "user" && (
          <label className={radioRow}>
            <input
              type="radio"
              name="addressChoice"
              value="new"
              checked={addressChoice === "new"}
              onChange={() => setAddressChoice("new")}
              className="mt-0.5 size-5 accent-jade"
            />
            <span>Add a new address (saved to your address book)</span>
          </label>
        )}
        {addressChoice === "new" && (
          <div
            className="flex flex-col gap-4"
            onChange={(e) => {
              const t = e.target as unknown as HTMLSelectElement;
              if (t.name === "address.district") setNewDistrict(t.value);
              if (t.name === "address.division") setNewDistrict("");
            }}
          >
            <AddressFields
              prefix="address."
              withReceiver={props.mode === "user"}
              errors={addressErrors}
              defaults={{ name: "", phone: "", division: "", district: "", upazila: "", area: "", line1: "" }}
            />
          </div>
        )}
        {fields.addressId && <p className="text-sm text-vermilion">{fields.addressId}</p>}
      </fieldset>

      <section aria-labelledby="review-heading" className="flex flex-col gap-4">
        <Heading n={3} id="review-heading">
          Review your order
        </Heading>
        <p className="-mt-2 text-sm text-muted">
          {zone === null
            ? "Choose the district of your address to see the delivery charges."
            : `Delivery ${zone === "inside_dhaka" ? "inside Dhaka" : "outside Dhaka"}. Each shop sends its part separately with one delivery charge per shop order.`}
        </p>
        {review.shops.map((shop, i) => (
          <ShopOrderReview key={shop.shopId} shop={shop} index={i + 1} showDelivery={zone !== null} />
        ))}
        {review.leftOut.length > 0 && <Notice tone="warning">Not ordered (not available now): {review.leftOut.join(", ")}.</Notice>}
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-lg bg-surface p-5" aria-label="Checkout total">
          <dt className="text-muted">Items ({review.itemCount})</dt>
          <dd className="tabular text-right">{tk(review.subtotal)}</dd>
          <dt className="text-muted">
            Delivery charges ({review.shops.length} {review.shops.length === 1 ? "shop" : "shops"})
          </dt>
          <dd className="tabular text-right">{zone === null ? "Choose an address" : tk(review.deliveryTotal)}</dd>
          <dt className="text-lg font-semibold">Total to pay on delivery</dt>
          <dd className="tabular text-right text-lg font-semibold">{zone === null ? "–" : tk(review.grandTotal)}</dd>
          <dt className="text-muted">Payment</dt>
          <dd className="text-right">Cash on delivery</dd>
          <dd className="col-span-2 mt-1 text-sm text-muted">You pay in cash when your order arrives. Nothing is charged online.</dd>
        </dl>
        {!review.ready && (
          <Notice tone="warning" role="alert">
            <ul className="list-disc pl-4">
              {review.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <Link className="mt-1 inline-block py-1 font-medium underline underline-offset-2" href="/cart">
              Back to your cart
            </Link>
          </Notice>
        )}
      </section>

      <div className="flex flex-col gap-4">
        <PolicyConsent slugs={props.policySlugs} versions={props.policyVersions} error={fields.acceptPolicies} id="checkout-consent" />

        {error && (
          <Notice tone="error">
            <p className="font-medium">{error.message}</p>
            {Object.keys(fields).length > 0 && error.code !== "VALIDATION" && (
              <ul className="mt-1 list-disc pl-4">
                {[...new Set(Object.values(fields))].map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </Notice>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" loading={placing} disabled={!canPlace} className="sm:min-w-64">
            Place order (cash on delivery)
          </Button>
          <Link className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-jade underline-offset-4 hover:underline" href="/cart">
            Back to cart
          </Link>
        </div>
        {!phoneVerified && <p className="text-sm text-muted">Verify your mobile number above to place the order.</p>}
      </div>
    </form>
  );
}

function ShopOrderReview({ shop, index, showDelivery }: { shop: ReviewShop; index: number; showDelivery: boolean }) {
  const headingId = `review-shop-${shop.shopId}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-base">
        Shop order {index}: {shop.shopName}
      </h3>
      <ul className="flex flex-col divide-y divide-line">
        {shop.lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-4 py-2.5">
            <span className="min-w-0">
              {l.quantity} × {l.title}
              {l.variantLabel && <span className="text-muted"> ({l.variantLabel})</span>}
            </span>
            <span className="tabular shrink-0">{tk(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-line pt-3 text-sm">
        <dt className="text-muted">Items</dt>
        <dd className="tabular text-right">{tk(shop.subtotal)}</dd>
        <dt className="text-muted">Delivery charge</dt>
        <dd className="tabular text-right">{showDelivery ? shop.deliveryLabel : "Choose an address"}</dd>
        <dt className="font-semibold">Shop order total</dt>
        <dd className="tabular text-right font-semibold">{showDelivery ? tk(shop.total) : "–"}</dd>
      </dl>
    </section>
  );
}

/** OTP send + verify for one mobile, against POST /api/checkout/otp. */
function OtpStep({
  phone,
  onVerified,
  onAccountExists,
}: {
  phone: () => string;
  onVerified: () => void;
  onAccountExists?: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [code, setCode] = useState("");

  async function send() {
    setBusy(true);
    const r = await post("/api/checkout/otp", { action: "send", phone: phone() });
    setBusy(false);
    if (r.ok) setSent(true);
    setMessage(r.ok ? { text: String(r.data.message), error: false } : { text: r.error.fields?.phone ?? r.error.message, error: true });
  }

  async function verify() {
    setBusy(true);
    const r = await post("/api/checkout/otp", { action: "verify", phone: phone(), code });
    setBusy(false);
    if (!r.ok) {
      setMessage({ text: r.error.fields?.code ?? r.error.fields?.phone ?? r.error.message, error: true });
      return;
    }
    setMessage({ text: "Mobile number verified.", error: false });
    if (r.data.accountExists) onAccountExists?.();
    onVerified();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="secondary" onClick={send} disabled={busy}>
          {sent ? "Send a new code" : "Send code by SMS"}
        </Button>
        {sent && (
          <>
            <FormField label="6-digit code" className="w-36">
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void verify();
                    }
                  }}
                />
              )}
            </FormField>
            <Button variant="secondary" onClick={verify} disabled={busy || code.trim().length !== 6}>
              Verify
            </Button>
          </>
        )}
      </div>
      <p role="status" aria-live="polite" className={cn("text-sm", message?.error ? "font-medium text-vermilion" : "text-jade")}>
        {message?.text}
      </p>
    </div>
  );
}

function AccountPhone({ phone, verified, onVerified }: { phone: { local: string | null; verified: boolean }; verified: boolean; onVerified: () => void }) {
  if (!phone.local) {
    return (
      <Notice tone="warning" role="alert">
        Cash on delivery needs a verified mobile number.{" "}
        <Link className="font-medium underline underline-offset-2" href="/account">
          Add your mobile number to your profile
        </Link>
        , then come back to checkout.
      </Notice>
    );
  }
  return (
    <section aria-labelledby="mobile-heading" className="flex flex-col gap-3">
      <Heading n={1} id="mobile-heading">
        Your mobile number
      </Heading>
      <p className="-mt-2 flex items-center gap-2">
        <span className="tabular">{phone.local}</span>
        <Badge tone={verified ? "brand" : "warning"}>{verified ? "Verified" : "Not verified"}</Badge>
      </p>
      {!verified && (
        <>
          <p className="text-sm text-muted">Before your first cash-on-delivery order, verify this number with the code we send by SMS.</p>
          <OtpStep phone={() => phone.local!} onVerified={onVerified} />
        </>
      )}
    </section>
  );
}

function GuestContact({ fields, verified, onVerified }: { fields: Record<string, string>; verified: boolean; onVerified: () => void }) {
  const [phone, setPhone] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const still = verified && verifiedPhone === phone;
  const nameId = useId();

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="p-0">
        <Heading n={1} as="div">
          Your details
        </Heading>
      </legend>
      <p className="-mt-2 text-sm text-muted" id={nameId}>
        No account needed. Have one?{" "}
        <Link className="font-medium text-jade underline underline-offset-2" href="/login?callbackUrl=%2Fcheckout">
          Log in
        </Link>{" "}
        to use your saved addresses.
      </p>
      <FormField label="Full name" error={fields["contact.name"]}>
        {(p) => <Input {...p} aria-required="true" name="contact.name" autoComplete="name" />}
      </FormField>
      <FormField label="Mobile number" error={fields["contact.phone"]}>
        {(p) => (
          <Input
            {...p}
            aria-required="true"
            name="contact.phone"
            type="tel"
            inputMode="numeric"
            placeholder="01XXXXXXXXX"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
      </FormField>
      {still ? (
        <p role="status" className="text-sm font-medium text-jade">
          Mobile number verified.
        </p>
      ) : (
        <OtpStep
          phone={() => phone}
          onVerified={() => {
            setVerifiedPhone(phone);
            onVerified();
          }}
          onAccountExists={() => setAccountExists(true)}
        />
      )}
      {accountExists && still && (
        <Notice tone="info">
          This mobile number belongs to an account.{" "}
          <Link className="font-medium underline underline-offset-2" href="/login?callbackUrl=%2Fcheckout">
            Log in
          </Link>{" "}
          (or use Forgot password) to see all your orders. If you continue as a guest, this order is added to that account because you
          verified its mobile number.
        </Notice>
      )}
      <FormField label="Email (for your invoice)" error={fields["contact.email"]}>
        {(p) => <Input {...p} aria-required="true" name="contact.email" type="email" autoComplete="email" />}
      </FormField>
    </fieldset>
  );
}
