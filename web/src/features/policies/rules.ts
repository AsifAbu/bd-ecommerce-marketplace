import type { PolicyDocument } from "@/generated/prisma/client";
import { PolicyError } from "./errors";

/**
 * Versioning rules for policy pages (US-080), pure and unit-tested:
 * - a policy has at most one draft; a draft takes the next version number;
 * - published versions are immutable (never edited, never deleted);
 * - the current version is the highest published version whose effective date has passed,
 *   so publishing a new version supersedes the old one from its effective date;
 * - effective dates can't be in the past and never go backwards between versions.
 */
export type PolicyVersion = PolicyDocument;

export type VersionState = "draft" | "scheduled" | "current" | "superseded";

/** Small allowance for clock skew between the admin's form and the server. */
export const BACKDATE_TOLERANCE_MS = 5 * 60 * 1000;

const isLive = (v: PolicyVersion, now: Date) =>
  v.status === "published" && v.effectiveAt !== null && v.effectiveAt.getTime() <= now.getTime();

/** The version users see and accept now, or null if none has taken effect. */
export function currentVersion(versions: readonly PolicyVersion[], now: Date): PolicyVersion | null {
  let best: PolicyVersion | null = null;
  for (const v of versions) if (isLive(v, now) && (!best || v.version > best.version)) best = v;
  return best;
}

/** The next published version that is not effective yet, if any. */
export function scheduledVersion(versions: readonly PolicyVersion[], now: Date): PolicyVersion | null {
  let next: PolicyVersion | null = null;
  for (const v of versions) {
    if (v.status === "published" && !isLive(v, now) && (!next || v.version < next.version)) next = v;
  }
  return next;
}

export function draftOf(versions: readonly PolicyVersion[]): PolicyVersion | null {
  return versions.find((v) => v.status === "draft") ?? null;
}

export function nextVersionNumber(versions: readonly PolicyVersion[]): number {
  return versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
}

export function versionState(v: PolicyVersion, versions: readonly PolicyVersion[], now: Date): VersionState {
  if (v.status === "draft") return "draft";
  if (!isLive(v, now)) return "scheduled";
  return currentVersion(versions, now)?.id === v.id ? "current" : "superseded";
}

/** Only drafts can be edited or published. */
export function assertDraft(v: PolicyVersion): void {
  if (v.status !== "draft") {
    throw new PolicyError(409, "POLICY_PUBLISHED", "Published versions can't be changed. Draft a new version instead.");
  }
}

export function assertCanCreateDraft(versions: readonly PolicyVersion[]): void {
  if (draftOf(versions)) {
    throw new PolicyError(409, "DRAFT_EXISTS", "This policy already has a draft. Edit or publish it first.");
  }
}

/**
 * The effective date for a version being published: now when not given, never in the past
 * (beyond a small tolerance) and never before an already published version's effective date.
 */
export function resolveEffectiveAt(requested: Date | null, now: Date, versions: readonly PolicyVersion[]): Date {
  let at = requested ?? now;
  if (at.getTime() < now.getTime() - BACKDATE_TOLERANCE_MS) {
    throw new PolicyError(422, "VALIDATION", "Please check the form", { effectiveAt: "The effective date can't be in the past" });
  }
  if (at.getTime() < now.getTime()) at = now;
  for (const v of versions) {
    if (v.status === "published" && v.effectiveAt && v.effectiveAt.getTime() > at.getTime()) {
      throw new PolicyError(422, "VALIDATION", "Please check the form", {
        effectiveAt: `Must be on or after version ${v.version}'s effective date`,
      });
    }
  }
  return at;
}

export function assertPublishable(v: PolicyVersion): void {
  assertDraft(v);
  if (!v.title.trim() || !v.body.trim()) {
    throw new PolicyError(422, "VALIDATION", "A policy needs a title and text before it is published", {
      body: "Required",
    });
  }
}
