import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PolicyError } from "./errors";
import type { PolicyRepo } from "./service";

/*
 * Prisma storage for policies. Published rows are only ever read; every write to policy_document
 * is guarded by `status: "draft"`. policy_acceptance is insert-only. Nothing here deletes.
 */

const audit = (tx: Prisma.TransactionClient, actorId: string, action: string, entityId: string, data: Prisma.InputJsonValue) =>
  tx.auditLog.create({ data: { actorId, action, entity: "policy_document", entityId, data } });

export const prismaPolicyRepo: PolicyRepo = {
  versionsOf: (slugs) => prisma.policyDocument.findMany({ where: { slug: { in: [...slugs] } }, orderBy: { version: "asc" } }),

  findById: (id) => prisma.policyDocument.findUnique({ where: { id } }),

  async createDraft(actorId, data) {
    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.policyDocument.create({ data: { ...data, status: "draft", createdById: actorId } });
        await audit(tx, actorId, "policy.draft_created", row.id, { slug: row.slug, version: row.version });
        return row;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new PolicyError(409, "DRAFT_EXISTS", "Another admin just started this version. Reload the page.");
      }
      throw err;
    }
  },

  async updateDraft(_actorId, id, data) {
    const { count } = await prisma.policyDocument.updateMany({ where: { id, status: "draft" }, data });
    return count === 1;
  },

  publishDraft: (actorId, id, at) =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.policyDocument.updateMany({
        where: { id, status: "draft" },
        data: { status: "published", effectiveAt: at.effectiveAt, publishedAt: at.publishedAt, publishedById: actorId },
      });
      if (count !== 1) return false;
      const row = await tx.policyDocument.findUniqueOrThrow({ where: { id }, select: { slug: true, version: true } });
      await audit(tx, actorId, "policy.published", id, {
        slug: row.slug,
        version: row.version,
        effectiveAt: at.effectiveAt.toISOString(),
      });
      return true;
    }),

  async acceptedPolicyIds(userId, policyIds) {
    const rows = await prisma.policyAcceptance.findMany({
      where: { userId, policyId: { in: [...policyIds] } },
      select: { policyId: true },
      distinct: ["policyId"],
    });
    return rows.map((r) => r.policyId);
  },

  async insertAcceptances(rows) {
    await prisma.policyAcceptance.createMany({ data: rows });
  },

  async acceptanceCounts(policyIds) {
    const groups = await prisma.policyAcceptance.groupBy({
      by: ["policyId"],
      where: { policyId: { in: [...policyIds] } },
      _count: { _all: true },
    });
    return Object.fromEntries(groups.map((g) => [g.policyId, g._count._all]));
  },
};
