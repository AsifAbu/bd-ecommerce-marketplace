import type { PolicyAcceptanceContext } from "@/generated/prisma/client";
import { isPolicySlug, POLICIES, policyTitle, type PolicySlug } from "./catalog";
import { PolicyError } from "./errors";
import {
  assertCanCreateDraft,
  assertDraft,
  assertPublishable,
  currentVersion,
  draftOf,
  nextVersionNumber,
  resolveEffectiveAt,
  scheduledVersion,
  versionState,
  type PolicyVersion,
  type VersionState,
} from "./rules";

/** Storage used by the service. Prisma implementation in repo.ts; in-memory fake in fake-repo.ts. */
export interface PolicyRepo {
  versionsOf(slugs: readonly string[]): Promise<PolicyVersion[]>;
  findById(id: string): Promise<PolicyVersion | null>;
  /** Inserts a draft and writes the audit entry. Throws PolicyError 409 if the version number is taken. */
  createDraft(actorId: string, data: DraftData & { slug: PolicySlug; version: number }): Promise<PolicyVersion>;
  /** Updates the row only while it is still a draft. Returns false if it was published meanwhile. */
  updateDraft(actorId: string, id: string, data: DraftData): Promise<boolean>;
  /** Publishes the row only while it is still a draft, and writes the audit entry. */
  publishDraft(actorId: string, id: string, at: { effectiveAt: Date; publishedAt: Date }): Promise<boolean>;
  /** Ids (of `policyIds`) this user has an acceptance row for. */
  acceptedPolicyIds(userId: string, policyIds: readonly string[]): Promise<string[]>;
  insertAcceptances(rows: AcceptanceRow[]): Promise<void>;
  acceptanceCounts(policyIds: readonly string[]): Promise<Record<string, number>>;
}

export interface DraftData {
  title: string;
  body: string;
  changeSummary: string | null;
}

export interface AcceptanceRow {
  userId: string | null;
  guestPhone: string | null;
  policyId: string;
  slug: PolicySlug;
  version: number;
  context: PolicyAcceptanceContext;
  ip: string | null;
  userAgent: string | null;
  acceptedAt: Date;
}

/** A policy version in force now. Checkout stores these (slug + version) on the order. */
export interface CurrentPolicy {
  id: string;
  slug: PolicySlug;
  version: number;
  title: string;
  effectiveAt: Date;
}

export interface AcceptanceStatus {
  /** True when every requested policy has a current version and the user accepted it. */
  accepted: boolean;
  /** Current versions the user still has to accept. */
  pending: CurrentPolicy[];
  /** Requested policies with no version in force yet (they can't be accepted; treated as not accepted). */
  unpublished: PolicySlug[];
}

export interface RecordAcceptanceInput {
  /** The account accepting. Give userId, or guestPhone (E.164) for a guest at checkout. */
  userId?: string | null;
  guestPhone?: string | null;
  slugs: readonly PolicySlug[];
  context: PolicyAcceptanceContext;
  /**
   * Versions the person was shown, e.g. from hidden form fields ({ returns: 2 }). If a newer
   * version took effect since, nothing is recorded and a 409 POLICY_CHANGED is thrown.
   */
  shownVersions?: Partial<Record<PolicySlug, number>>;
  ip?: string | null;
  userAgent?: string | null;
}

export interface PolicyOverview {
  slug: PolicySlug;
  title: string;
  current: PolicyVersion | null;
  scheduled: PolicyVersion | null;
  draft: PolicyVersion | null;
}

export type HistoryEntry = PolicyVersion & { state: VersionState; acceptances: number };

const toCurrent = (v: PolicyVersion): CurrentPolicy => ({
  id: v.id,
  slug: v.slug as PolicySlug,
  version: v.version,
  title: v.title,
  effectiveAt: v.effectiveAt!,
});

function assertSlug(slug: string): asserts slug is PolicySlug {
  if (!isPolicySlug(slug)) throw new PolicyError(404, "NOT_FOUND", "Policy not found");
}

const unique = <T>(xs: readonly T[]) => [...new Set(xs)];

export function createPolicyService(repo: PolicyRepo, clock: () => Date = () => new Date()) {
  async function versionsBySlug(slugs: readonly PolicySlug[]): Promise<Map<PolicySlug, PolicyVersion[]>> {
    const map = new Map<PolicySlug, PolicyVersion[]>(slugs.map((s) => [s, []]));
    for (const v of await repo.versionsOf(slugs)) map.get(v.slug as PolicySlug)?.push(v);
    return map;
  }

  async function loadDraft(id: string): Promise<PolicyVersion> {
    const v = await repo.findById(id);
    if (!v) throw new PolicyError(404, "NOT_FOUND", "Policy version not found");
    return v;
  }

  /** Current versions of the given policies; slugs with no version in force are left out. */
  async function getCurrentVersions(slugs: readonly PolicySlug[]): Promise<CurrentPolicy[]> {
    const now = clock();
    const bySlug = await versionsBySlug(unique(slugs));
    return unique(slugs).flatMap((s) => {
      const v = currentVersion(bySlug.get(s) ?? [], now);
      return v ? [toCurrent(v)] : [];
    });
  }

  async function checkAcceptance(userId: string, slugs: readonly PolicySlug[]): Promise<AcceptanceStatus> {
    const wanted = unique(slugs);
    const current = await getCurrentVersions(wanted);
    const unpublished = wanted.filter((s) => !current.some((c) => c.slug === s));
    const accepted = new Set(current.length ? await repo.acceptedPolicyIds(userId, current.map((c) => c.id)) : []);
    const pending = current.filter((c) => !accepted.has(c.id));
    return { accepted: pending.length === 0 && unpublished.length === 0, pending, unpublished };
  }

  return {
    getCurrentVersions,
    checkAcceptance,

    /** The version in force now, or null. */
    async getCurrentPolicy(slug: PolicySlug): Promise<PolicyVersion | null> {
      return currentVersion((await versionsBySlug([slug])).get(slug) ?? [], clock());
    },

    /** A published version that has taken effect (current or superseded), for public viewing. Drafts and scheduled versions are hidden. */
    async getPublishedVersion(slug: PolicySlug, version: number): Promise<PolicyVersion | null> {
      const now = clock();
      const v = (await versionsBySlug([slug])).get(slug)?.find((x) => x.version === version);
      return v && v.status === "published" && v.effectiveAt && v.effectiveAt <= now ? v : null;
    },

    /** True if the user has accepted the current version of every given policy. */
    async hasAcceptedCurrent(userId: string, slugs: readonly PolicySlug[]): Promise<boolean> {
      return (await checkAcceptance(userId, slugs)).accepted;
    },

    /** Throws 422 POLICY_ACCEPTANCE_REQUIRED (fields per slug) unless every current version is accepted. */
    async assertAcceptedCurrent(userId: string, slugs: readonly PolicySlug[]): Promise<void> {
      const status = await checkAcceptance(userId, slugs);
      if (status.accepted) return;
      const fields: Record<string, string> = {};
      for (const p of status.pending) fields[p.slug] = `Accept the ${p.title} (version ${p.version})`;
      for (const s of status.unpublished) fields[s] = `The ${policyTitle(s)} is not published yet`;
      throw new PolicyError(422, "POLICY_ACCEPTANCE_REQUIRED", "Please accept the current policies to continue", fields);
    },

    /**
     * Records acceptance of the current version of each policy (append-only proof).
     * Returns the accepted versions, e.g. for the order's policy_versions snapshot.
     */
    async recordAcceptance(input: RecordAcceptanceInput): Promise<CurrentPolicy[]> {
      const userId = input.userId || null;
      const guestPhone = userId ? null : input.guestPhone || null;
      if (!userId && !guestPhone) {
        throw new PolicyError(422, "VALIDATION", "A user or a guest mobile number is required");
      }
      const slugs = unique(input.slugs);
      for (const s of slugs) assertSlug(s);
      if (slugs.length === 0) return [];

      const current = await getCurrentVersions(slugs);
      const changed: Record<string, string> = {};
      const unpublished: Record<string, string> = {};
      for (const s of slugs) {
        const c = current.find((x) => x.slug === s);
        const shown = input.shownVersions?.[s];
        if (!c) unpublished[s] = `The ${policyTitle(s)} is not published yet`;
        else if (shown !== undefined && shown !== c.version) {
          changed[s] = `The ${c.title} was updated to version ${c.version}. Please review it and accept again.`;
        }
      }
      if (Object.keys(changed).length > 0) {
        throw new PolicyError(409, "POLICY_CHANGED", "A policy was updated. Please review it and accept again.", {
          ...unpublished,
          ...changed,
        });
      }
      if (Object.keys(unpublished).length > 0) {
        throw new PolicyError(409, "POLICY_UNPUBLISHED", "A required policy is not published yet", unpublished);
      }

      const acceptedAt = clock();
      await repo.insertAcceptances(
        current.map((c) => ({
          userId,
          guestPhone,
          policyId: c.id,
          slug: c.slug,
          version: c.version,
          context: input.context,
          ip: input.ip?.slice(0, 64) ?? null,
          userAgent: input.userAgent?.slice(0, 500) ?? null,
          acceptedAt,
        })),
      );
      return current;
    },

    // ---------- Admin ----------

    async adminOverview(): Promise<PolicyOverview[]> {
      const now = clock();
      const bySlug = await versionsBySlug(POLICIES.map((p) => p.slug));
      return POLICIES.map(({ slug, title }) => {
        const versions = bySlug.get(slug) ?? [];
        return {
          slug,
          title,
          current: currentVersion(versions, now),
          scheduled: scheduledVersion(versions, now),
          draft: draftOf(versions),
        };
      });
    },

    /** All versions of a policy, newest first, with their state and acceptance counts. */
    async history(slug: string): Promise<HistoryEntry[]> {
      assertSlug(slug);
      const now = clock();
      const versions = (await versionsBySlug([slug])).get(slug) ?? [];
      const counts = await repo.acceptanceCounts(versions.map((v) => v.id));
      return versions
        .map((v) => ({ ...v, state: versionState(v, versions, now), acceptances: counts[v.id] ?? 0 }))
        .sort((a, b) => b.version - a.version);
    },

    /** Starts the next version as a draft, copying the latest published text. */
    async createDraft(actorId: string, slug: string): Promise<PolicyVersion> {
      assertSlug(slug);
      const versions = (await versionsBySlug([slug])).get(slug) ?? [];
      assertCanCreateDraft(versions);
      const latest = versions.filter((v) => v.status === "published").sort((a, b) => b.version - a.version)[0];
      return repo.createDraft(actorId, {
        slug,
        version: nextVersionNumber(versions),
        title: latest?.title ?? policyTitle(slug),
        body: latest?.body ?? "",
        changeSummary: null,
      });
    },

    async updateDraft(actorId: string, id: string, data: DraftData): Promise<void> {
      assertDraft(await loadDraft(id));
      if (!(await repo.updateDraft(actorId, id, data))) {
        throw new PolicyError(409, "POLICY_PUBLISHED", "This version was published meanwhile and can't be changed.");
      }
    },

    /** Publishes a draft. It becomes current at `effectiveAt` (default now) and supersedes the previous version. */
    async publish(actorId: string, id: string, effectiveAt: Date | null): Promise<PolicyVersion> {
      const draft = await loadDraft(id);
      assertPublishable(draft);
      const now = clock();
      const versions = (await versionsBySlug([draft.slug as PolicySlug])).get(draft.slug as PolicySlug) ?? [];
      const at = resolveEffectiveAt(effectiveAt, now, versions);
      if (!(await repo.publishDraft(actorId, id, { effectiveAt: at, publishedAt: now }))) {
        throw new PolicyError(409, "POLICY_PUBLISHED", "This version was already published.");
      }
      return { ...draft, status: "published", effectiveAt: at, publishedAt: now, publishedById: actorId };
    },
  };
}

export type PolicyService = ReturnType<typeof createPolicyService>;
