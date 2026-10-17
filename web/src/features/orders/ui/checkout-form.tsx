"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { buttonClass, inputClass } from "@/components/form-styles";
import { AddressFields } from "@/features/accounts/ui/address-fields";
import { PolicyConsent, type PolicySlug } from "@/features/policies/client";
import type { DeliveryZone } from "@/lib/delivery";
import type { Review, ReviewShop } from "../review";

/**
 * The checkout page form (US-051 logged in, US-007 guest). Logged in: choose a saved address or
 * add one, verify the account mobile by OTP if needed. Guest: name, mobile (OTP), email and the
 * address. Both: every shop order with its items, delivery charge (zone of the address) and
 * total, the policy consent box, and Place order (cash on delivery). Talks to the JSON API.
 */

const secondary =
  "rounded border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 disabled:opacity-60";

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

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate aria-label="Checkout">
      {props.mode === "guest" ? (
        <GuestContact fields={fields} onVerified={() => setPhoneVerified(true)} verified={phoneVerified} />
      ) : (
        <AccountPhone phone={props.phone!} verified={phoneVerified} onVerified={() => setPhoneVerified(true)} />
      )}

      <fieldset className="flex flex-col gap-3 rounded border border-gray-300 p-4">
        <legend className="px-1 text-lg font-semibold">Delivery address</legend>
        {props.mode === "user" &&
          addresses.map((a) => (
            <label key={a.id} className="flex items-start gap-2">
              <input
                type="radio"
                name="addressChoice"
                value={a.id}
                checked={addressChoice === a.id}
                onChange={() => setAddressChoice(a.id)}
                className="mt-1 accent-blue-700"
              />
              <span>
                {a.label}
                {a.isDefault && <span className="ml-2 rounded bg-gray-100 px-2 text-sm">Default</span>}
              </span>
            </label>
          ))}
        {props.mode === "user" && (
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="addressChoice"
              value="new"
              checked={addressChoice === "new"}
              onChange={() => setAddressChoice("new")}
              className="accent-blue-700"
            />
            Add a new address (saved to your address book)
          </label>
        )}
        {addressChoice === "new" && (
          <div
            className="flex flex-col gap-3"
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
        {fields.addressId && <p className="text-sm text-red-700">{fields.addressId}</p>}
      </fieldset>

      <section aria-labelledby="review-heading" className="flex flex-col gap-4">
        <h2 id="review-heading" className="text-xl font-semibold">
          Review your order
        </h2>
        {zone === null ? (
          <p className="text-sm text-gray-800">Choose the district of your address to see the delivery charges.</p>
        ) : (
          <p className="text-sm text-gray-800">
            Delivery {zone === "inside_dhaka" ? "inside Dhaka" : "outside Dhaka"}. Each shop sends its part separately with one delivery
            charge per shop order.
          </p>
        )}
        {review.shops.map((shop, i) => (
          <ShopOrderReview key={shop.shopId} shop={shop} index={i + 1} showDelivery={zone !== null} />
        ))}
        {review.leftOut.length > 0 && (
          <p className="text-sm text-amber-900">Not ordered (not available now): {review.leftOut.join(", ")}.</p>
        )}
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded border-2 border-gray-400 p-4" aria-label="Order total">
          <dt>Items ({review.itemCount})</dt>
          <dd className="text-right">{tk(review.subtotal)}</dd>
          <dt>Delivery charges ({review.shops.length} {review.shops.length === 1 ? "shop" : "shops"})</dt>
          <dd className="text-right">{zone === null ? "Choose an address" : tk(review.deliveryTotal)}</dd>
          <dt className="text-lg font-bold">Total to pay on delivery</dt>
          <dd className="text-right text-lg font-bold">{zone === null ? "–" : tk(review.grandTotal)}</dd>
          <dt>Payment</dt>
          <dd className="text-right">Cash on delivery</dd>
        </dl>
        {!review.ready && (
          <div role="alert" className="rounded border border-amber-700 bg-amber-50 p-3 text-amber-950">
            <ul className="list-disc pl-5">
              {review.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <Link className="font-semibold underline" href="/cart">
              Back to your cart
            </Link>
          </div>
        )}
      </section>

      <PolicyConsent slugs={props.policySlugs} versions={props.policyVersions} error={fields.acceptPolicies} id="checkout-consent" />

      {error && (
        <div role="alert" className="rounded border border-red-700 bg-red-50 p-3 text-red-800">
          <p className="font-semibold">{error.message}</p>
          {Object.keys(fields).length > 0 && error.code !== "VALIDATION" && (
            <ul className="list-disc pl-5 text-sm">
              {[...new Set(Object.values(fields))].map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass} disabled={placing || !canPlace}>
          {placing ? "Placing your order…" : "Place order (cash on delivery)"}
        </button>
        <Link className="text-blue-800 underline" href="/cart">
          Back to cart
        </Link>
      </div>
      {!phoneVerified && <p className="text-sm text-gray-800">Verify your mobile number above to place the order.</p>}
    </form>
  );
}

function ShopOrderReview({ shop, index, showDelivery }: { shop: ReviewShop; index: number; showDelivery: boolean }) {
  const headingId = `review-shop-${shop.shopId}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded border border-gray-300 p-4">
      <h3 id={headingId} className="font-semibold">
        Shop order {index}: {shop.shopName}
      </h3>
      <ul className="flex flex-col gap-1">
        {shop.lines.map((l) => (
          <li key={l.id} className="flex flex-wrap justify-between gap-2">
            <span>
              {l.quantity} × {l.title}
              {l.variantLabel && <span className="text-gray-700"> ({l.variantLabel})</span>}
            </span>
            <span>{tk(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-gray-200 pt-2">
        <dt>Items</dt>
        <dd className="text-right">{tk(shop.subtotal)}</dd>
        <dt>Delivery charge</dt>
        <dd className="text-right">{showDelivery ? shop.deliveryLabel : "Choose an address"}</dd>
        <dt className="font-semibold">Shop order total</dt>
        <dd className="text-right font-semibold">{showDelivery ? tk(shop.total) : "–"}</dd>
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
  const id = useId();
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <button type="button" className={secondary} onClick={send} disabled={busy}>
          {sent ? "Send a new code" : "Send code by SMS"}
        </button>
        {sent && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-code`} className="font-medium">
                6-digit code
              </label>
              <input
                id={`${id}-code`}
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
                className={`${inputClass} w-32`}
              />
            </div>
            <button type="button" className={secondary} onClick={verify} disabled={busy || code.trim().length !== 6}>
              Verify
            </button>
          </>
        )}
      </div>
      <p role="status" aria-live="polite" className={`text-sm ${message?.error ? "font-semibold text-red-800" : "text-green-900"}`}>
        {message?.text}
      </p>
    </div>
  );
}

function AccountPhone({ phone, verified, onVerified }: { phone: { local: string | null; verified: boolean }; verified: boolean; onVerified: () => void }) {
  if (!phone.local) {
    return (
      <p role="alert" className="rounded border border-amber-700 bg-amber-50 p-3">
        Cash on delivery needs a verified mobile number.{" "}
        <Link className="font-semibold underline" href="/account">
          Add your mobile number to your profile
        </Link>
        , then come back to checkout.
      </p>
    );
  }
  return (
    <section aria-labelledby="mobile-heading" className="flex flex-col gap-2 rounded border border-gray-300 p-4">
      <h2 id="mobile-heading" className="text-lg font-semibold">
        Your mobile number
      </h2>
      <p>
        {phone.local}{" "}
        <span className={`ml-2 rounded px-2 py-0.5 text-sm ${verified ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}>
          {verified ? "Verified" : "Not verified"}
        </span>
      </p>
      {!verified && (
        <>
          <p className="text-sm">Before your first cash-on-delivery order, verify this number with the code we send by SMS.</p>
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
  const field = (name: string, label: string, props: Record<string, unknown> = {}) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={inputClass}
        aria-invalid={fields[name] ? true : undefined}
        aria-describedby={fields[name] ? `${name}-error` : undefined}
        {...props}
      />
      {fields[name] && (
        <p id={`${name}-error`} className="text-sm text-red-700">
          {fields[name]}
        </p>
      )}
    </div>
  );

  return (
    <fieldset className="flex flex-col gap-3 rounded border border-gray-300 p-4">
      <legend className="px-1 text-lg font-semibold">Your details</legend>
      <p className="text-sm">
        No account needed. Have one?{" "}
        <Link className="font-semibold text-blue-800 underline" href="/login?callbackUrl=%2Fcheckout">
          Log in
        </Link>{" "}
        to use your saved addresses.
      </p>
      {field("contact.name", "Full name", { autoComplete: "name", required: true })}
      {field("contact.phone", "Mobile number", {
        type: "tel",
        inputMode: "numeric",
        placeholder: "01XXXXXXXXX",
        autoComplete: "tel-national",
        required: true,
        value: phone,
        onChange: (e: { target: HTMLInputElement }) => setPhone(e.target.value),
      })}
      {still ? (
        <p role="status" className="text-sm font-semibold text-green-900">
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
        <p className="rounded border border-blue-700 bg-blue-50 p-3 text-sm">
          This mobile number belongs to an account.{" "}
          <Link className="font-semibold underline" href="/login?callbackUrl=%2Fcheckout">
            Log in
          </Link>{" "}
          (or use Forgot password) to see all your orders. If you continue as a guest, this order is added to that account because you
          verified its mobile number.
        </p>
      )}
      {field("contact.email", "Email (for your invoice)", { type: "email", autoComplete: "email", required: true })}
    </fieldset>
  );
}
