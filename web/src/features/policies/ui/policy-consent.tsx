import Link from "next/link";
import { Fragment } from "react";
import { policyPath, policyTitle, type PolicySlug } from "../catalog";
import { ACCEPT_FIELD, shownVersionField } from "../form-fields";

/**
 * Consent checkbox linking each policy (sign-up, checkout). Pass `versions` (from
 * getCurrentVersions) to send the versions shown, so a policy updated meanwhile is caught.
 * Works in server and client components.
 */
export function PolicyConsent({
  slugs,
  versions = [],
  error,
  id = "accept-policies",
}: {
  slugs: readonly PolicySlug[];
  versions?: readonly { slug: PolicySlug; version: number }[];
  error?: string;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3 py-1">
        <input
          id={id}
          type="checkbox"
          name={ACCEPT_FIELD}
          required
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-jade"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <label htmlFor={id} className="text-sm leading-6">
          I have read and accept the{" "}
          {slugs.map((slug, i) => (
            <Fragment key={slug}>
              {i > 0 && (i === slugs.length - 1 ? " and the " : ", the ")}
              <Link className="text-jade underline decoration-jade/40 underline-offset-4 hover:decoration-jade" href={policyPath(slug)} target="_blank" rel="noopener">
                {policyTitle(slug)}
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            </Fragment>
          ))}
          .
        </label>
      </div>
      {versions.map((v) => (
        <input key={v.slug} type="hidden" name={shownVersionField(v.slug)} value={v.version} />
      ))}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-vermilion">
          {error}
        </p>
      )}
    </div>
  );
}
