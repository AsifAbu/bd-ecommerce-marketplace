import { randomBytes } from "node:crypto";
import Link from "next/link";
import { connection } from "next/server";
import { buttonStyles, EmptyState, Notice } from "@/components/ui";
import { addressRepo } from "@/features/accounts/server";
import { isInsideDhaka } from "@/features/cart";
import { cartService, currentUserOrNull, resolveCartOwner } from "@/features/cart/server";
import { CHECKOUT_POLICY_SLUGS, getCurrentVersions, GUEST_CHECKOUT_POLICY_SLUGS } from "@/features/policies";
import { prisma } from "@/lib/db";
import { getOrderConfig } from "../config";
import { assertCodAllowed } from "../limits";
import { codHistory } from "../repo";
import { toReview } from "../review";
import { CheckoutForm } from "./checkout-form";

/** The /checkout page body (US-051 logged in, US-007 guest). Request-time: session, cookies, cart. */
export async function CheckoutContent() {
  await connection();
  const user = await currentUserOrNull();
  const owner = await resolveCartOwner({ writable: false });
  const [inside, outside] = owner
    ? [await cartService.getCart(owner, "inside_dhaka"), await cartService.getCart(owner, "outside_dhaka")]
    : [null, null];

  if (!inside || !outside || inside.groups.length === 0) {
    return (
      <EmptyState
        title="Your cart has no items that can be ordered"
        description="Check your cart, or find something to add."
        action={
          <Link className={buttonStyles({ variant: "secondary" })} href="/cart">
            Go to your cart
          </Link>
        }
      />
    );
  }

  const reviews = { inside_dhaka: toReview(inside), outside_dhaka: toReview(outside) };
  const idempotencyKey = randomBytes(18).toString("base64url");

  if (!user) {
    const versions = await getCurrentVersions(GUEST_CHECKOUT_POLICY_SLUGS);
    return (
      <CheckoutForm
        mode="guest"
        idempotencyKey={idempotencyKey}
        reviews={reviews}
        policySlugs={GUEST_CHECKOUT_POLICY_SLUGS}
        policyVersions={versions.map((v) => ({ slug: v.slug, version: v.version }))}
      />
    );
  }

  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, phoneVerifiedAt: true } });
  // D8: say it before the customer fills the form (the placement checks again).
  let blocked: string | null = null;
  if (account.phone) {
    try {
      assertCodAllowed(await codHistory(account.phone, user.id), getOrderConfig());
    } catch (err) {
      blocked = err instanceof Error ? err.message : "Cash on delivery is not available.";
    }
  }
  const addresses = (await addressRepo.list(user.id)).map((a) => ({
    id: a.id,
    label: `${a.name}, ${a.phone.replace(/^\+88/, "")}: ${[a.line1, a.area, a.upazila, a.district, a.division].join(", ")}`,
    zone: isInsideDhaka(a) ? ("inside_dhaka" as const) : ("outside_dhaka" as const),
    isDefault: a.isDefault,
  }));
  const versions = await getCurrentVersions(CHECKOUT_POLICY_SLUGS);

  return (
    <div className="flex flex-col gap-4">
      {blocked && (
        <Notice tone="error">
          <p className="font-medium">{blocked}</p>
        </Notice>
      )}
      <CheckoutForm
        mode="user"
        idempotencyKey={idempotencyKey}
        reviews={reviews}
        policySlugs={CHECKOUT_POLICY_SLUGS}
        policyVersions={versions.map((v) => ({ slug: v.slug, version: v.version }))}
        addresses={addresses}
        phone={{ local: account.phone?.replace(/^\+88/, "") ?? null, verified: !!account.phoneVerifiedAt }}
      />
    </div>
  );
}
