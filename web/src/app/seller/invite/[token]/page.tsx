import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { acceptInvite } from "@/features/shops/actions";
import { ActionForm } from "@/features/shops/components/action-form";
import { guardPage } from "@/features/shops/page-guard";
import { getAccountEmail } from "@/features/shops/repo";

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
  const account = await getAccountEmail(user.id);
  if (!account?.email || !account.emailVerifiedAt) {
    return (
      <p role="alert" className="rounded border border-red-700 bg-red-50 px-3 py-2 text-red-800">
        {account?.email ? `Verify your email ${account.email} before accepting this invite.` : "Add your email to your profile and verify it before accepting this invite."}{" "}
        Open the link we emailed you, or send a new one from{" "}
        <Link className="underline" href="/account">
          your account page
        </Link>
        . Then open this invite link again.
      </p>
    );
  }
  return (
    <>
      <p>You are logged in as {user.email ?? user.phone}. Accept the invite to help run this shop.</p>
      <ActionForm action={acceptInvite} submitLabel="Accept invite">
        <input type="hidden" name="token" value={token} />
      </ActionForm>
    </>
  );
}
