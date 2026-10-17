import { prisma } from "@/lib/db";
import type { LoginFailureStore } from "./login-throttle";

/** Postgres-backed failure log for the login lockout, shared by every app instance. */
export const prismaLoginFailureStore: LoginFailureStore = {
  failuresSince: async (identifier, since) =>
    (
      await prisma.loginFailure.findMany({
        where: { identifier, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    ).map((r) => r.createdAt),
  countIpFailuresSince: (ip, since) => prisma.loginFailure.count({ where: { ip, createdAt: { gte: since } } }),
  async record(identifier, ip, at) {
    await prisma.loginFailure.create({ data: { identifier, ip, createdAt: at } });
  },
  async clear(identifier, before) {
    await prisma.loginFailure.deleteMany({ where: { identifier, ...(before ? { createdAt: { lt: before } } : {}) } });
  },
};
