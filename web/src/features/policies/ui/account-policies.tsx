import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { acceptPoliciesAction } from "../actions";
import { POLICY_SLUGS, policyPath, SIGNUP_POLICY_SLUGS } from "../catalog";
import { formatDate } from "../dates";
import { policyService } from "../server";
import { ActionForm, SubmitButton } from "./action-form";
import { PolicyConsent } from "./policy-consent";

/**
 * /account/policies: which current policy versions the user has accepted, and a form to accept
 * updated Terms and Privacy Policy versions.
 */
export async function AccountPolicies() {
  await connection();
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/login?callbackUrl=%2Faccount%2Fpolicies");
    throw err;
  }
  const status = await policyService.checkAcceptance(userId, POLICY_SLUGS);
  const current = await policyService.getCurrentVersions(POLICY_SLUGS);
  const pendingIds = new Set(status.pending.map((p) => p.id));
  const toAccept = status.pending.filter((p) => (SIGNUP_POLICY_SLUGS as readonly string[]).includes(p.slug));

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-2">
        {current.map((p) => (
          <li key={p.id}>
            <Link className="underline" href={policyPath(p.slug)}>
              {p.title}
            </Link>{" "}
            version {p.version} (effective {formatDate(p.effectiveAt)}):{" "}
            <strong>{pendingIds.has(p.id) ? "not accepted yet" : "accepted"}</strong>
          </li>
        ))}
      </ul>
      {toAccept.length > 0 ? (
        <ActionForm action={acceptPoliciesAction} label="Accept updated policies">
          <p>These policies were updated since you last accepted them:</p>
          {toAccept.map((p) => (
            <input key={p.slug} type="hidden" name="slug" value={p.slug} />
          ))}
          <PolicyConsent slugs={toAccept.map((p) => p.slug)} versions={toAccept} />
          <SubmitButton>Accept</SubmitButton>
        </ActionForm>
      ) : (
        <p role="status">You have accepted the current Terms and Conditions and Privacy Policy.</p>
      )}
      <p className="text-sm text-gray-700">
        The Return and Delivery policies are accepted when you place an order.
      </p>
    </div>
  );
}
