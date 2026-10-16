import { connection } from "next/server";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { ApplyForm } from "@/features/shops/components/apply-form";
import { guardPage } from "@/features/shops/page-guard";

export default function ApplyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">Open a shop</h1>
      <p>
        You start as a Basic seller (up to 20 open orders and 100 live listings). You can upgrade to Verified later
        with a trade licence, VAT, TIN, UBID, PRA or DBID registration. Your shop goes live after admin approval.
      </p>
      <Suspense fallback={<p>Loading…</p>}>
        <Gate />
      </Suspense>
    </main>
  );
}

async function Gate() {
  await connection();
  await guardPage("/shops/apply", requireUser);
  return <ApplyForm />;
}
