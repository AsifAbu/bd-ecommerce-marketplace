import { PolicyError } from "./errors";
import type { PolicyVersion } from "./rules";
import type { AcceptanceRow, PolicyRepo } from "./service";

/** In-memory PolicyRepo for unit tests (same draft-only write rules as repo.ts). */
export function createFakePolicyRepo(seed: PolicyVersion[] = []) {
  const versions: PolicyVersion[] = seed.map((v) => ({ ...v }));
  const acceptances: AcceptanceRow[] = [];
  const auditLog: { actorId: string; action: string; entityId: string }[] = [];
  let n = 0;

  const repo: PolicyRepo = {
    async versionsOf(slugs) {
      return versions.filter((v) => slugs.includes(v.slug)).map((v) => ({ ...v }));
    },
    async findById(id) {
      const v = versions.find((x) => x.id === id);
      return v ? { ...v } : null;
    },
    async createDraft(actorId, data) {
      if (versions.some((v) => v.slug === data.slug && v.version === data.version)) {
        throw new PolicyError(409, "DRAFT_EXISTS", "Another admin just started this version. Reload the page.");
      }
      const now = new Date();
      const row: PolicyVersion = {
        id: `pv${++n}`,
        ...data,
        status: "draft",
        effectiveAt: null,
        publishedAt: null,
        createdById: actorId,
        publishedById: null,
        createdAt: now,
        updatedAt: now,
      };
      versions.push(row);
      auditLog.push({ actorId, action: "policy.draft_created", entityId: row.id });
      return { ...row };
    },
    async updateDraft(_actorId, id, data) {
      const v = versions.find((x) => x.id === id && x.status === "draft");
      if (!v) return false;
      Object.assign(v, data, { updatedAt: new Date() });
      return true;
    },
    async publishDraft(actorId, id, at) {
      const v = versions.find((x) => x.id === id && x.status === "draft");
      if (!v) return false;
      Object.assign(v, { status: "published", ...at, publishedById: actorId });
      auditLog.push({ actorId, action: "policy.published", entityId: id });
      return true;
    },
    async acceptedPolicyIds(userId, policyIds) {
      return [...new Set(acceptances.filter((a) => a.userId === userId && policyIds.includes(a.policyId)).map((a) => a.policyId))];
    },
    async insertAcceptances(rows) {
      acceptances.push(...rows);
    },
    async acceptanceCounts(policyIds) {
      const out: Record<string, number> = {};
      for (const a of acceptances) if (policyIds.includes(a.policyId)) out[a.policyId] = (out[a.policyId] ?? 0) + 1;
      return out;
    },
  };
  return { repo, versions, acceptances, auditLog };
}

/** A published or draft version row for tests. */
export function policyVersion(over: Partial<PolicyVersion> & Pick<PolicyVersion, "id" | "slug" | "version">): PolicyVersion {
  const at = new Date("2026-01-01T00:00:00Z");
  return {
    title: `${over.slug} v${over.version}`,
    body: `Text of ${over.slug} v${over.version}`,
    changeSummary: null,
    status: "published",
    effectiveAt: at,
    publishedAt: at,
    createdById: null,
    publishedById: null,
    createdAt: at,
    updatedAt: at,
    ...over,
  };
}
