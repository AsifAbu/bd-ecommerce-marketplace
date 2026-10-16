import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { guardPage } from "@/features/shops/page-guard";
import { listMyShops } from "@/features/shops/repo";

export default function SellerHome() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">My shops</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <MyShops />
      </Suspense>
      <p>
        <Link className="text-blue-800 underline" href="/shops/apply">
          Open a new shop
        </Link>
      </p>
    </main>
  );
}

async function MyShops() {
  await connection();
  const user = await guardPage("/seller", requireUser);
  const memberships = await listMyShops(user.id);
  if (memberships.length === 0) return <p>You don&apos;t run a shop yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {memberships.map((m) => (
        <li key={m.id}>
          <Link className="text-blue-800 underline" href={`/seller/${m.shop.id}`}>
            {m.shop.name}
          </Link>{" "}
          · {m.role} · {m.shop.status} · {m.shop.tier}
        </li>
      ))}
    </ul>
  );
}
