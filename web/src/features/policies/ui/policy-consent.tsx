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
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          name={ACCEPT_FIELD}
          required
          className="mt-1 h-4 w-4"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <label htmlFor={id}>
          I have read and accept the{" "}
          {slugs.map((slug, i) => (
            <Fragment key={slug}>
              {i > 0 && (i === slugs.length - 1 ? " and the " : ", the ")}
              <Link className="underline" href={policyPath(slug)} target="_blank" rel="noopener">
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
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
