import { connection } from "next/server";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { acceptInvite } from "@/features/shops/actions";
import { ActionForm } from "@/features/shops/components/action-form";
import { guardPage } from "@/features/shops/page-guard";

export default function InvitePage({ params }: PageProps<"/seller/invite/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">Join a shop as staff</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Accept params={params} />
      </Suspense>
    </main>
  );
}

async function Accept({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const user = await guardPage(`/seller/invite/${token}`, requireUser);
  return (
    <>
      <p>You are logged in as {user.email ?? user.phone}. Accept the invite to help run this shop.</p>
      <ActionForm action={acceptInvite} submitLabel="Accept invite">
        <input type="hidden" name="token" value={token} />
      </ActionForm>
    </>
  );
}
