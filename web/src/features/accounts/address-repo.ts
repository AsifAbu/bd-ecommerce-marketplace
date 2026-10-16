import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { AddressInput } from "./schemas";

type Tx = Pick<Prisma.TransactionClient, "address">;
export type AddressDb = Tx & { $transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> };

/** Address book. Every function takes the owner's userId first and filters by it. */
export function createAddressRepo(db: AddressDb) {
  const list = (userId: string) =>
    db.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });

  const get = (userId: string, id: string) => db.address.findFirst({ where: { id, userId } });

  const create = (userId: string, data: AddressInput) =>
    db.$transaction(async (tx) => {
      const isDefault = data.isDefault || (await tx.address.count({ where: { userId } })) === 0;
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...data, isDefault, userId } });
    });

  /** Returns false when the address is not this user's. */
  const update = (userId: string, id: string, data: AddressInput) =>
    db.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({ where: { id, userId } });
      if (!existing) return false;
      // Unticking "default" on the default address is ignored: a user with addresses always has one default.
      const isDefault = data.isDefault || existing.isDefault;
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      const { count } = await tx.address.updateMany({ where: { id, userId }, data: { ...data, isDefault } });
      return count === 1;
    });

  const setDefault = (userId: string, id: string) =>
    db.$transaction(async (tx) => {
      if (!(await tx.address.findFirst({ where: { id, userId } }))) return false;
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      await tx.address.updateMany({ where: { id, userId }, data: { isDefault: true } });
      return true;
    });

  const remove = (userId: string, id: string) =>
    db.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({ where: { id, userId } });
      if (!existing) return false;
      await tx.address.deleteMany({ where: { id, userId } });
      if (existing.isDefault) {
        const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
        if (next) await tx.address.updateMany({ where: { id: next.id, userId }, data: { isDefault: true } });
      }
      return true;
    });

  return { list, get, create, update, setDefault, remove };
}

export const addressRepoFor = (prisma: PrismaClient) => createAddressRepo(prisma as unknown as AddressDb);
