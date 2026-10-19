import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Container, Notice, PageHeader, TextLink } from "@/components/ui";
import { FormSkeleton } from "@/features/accounts/ui/auth-shell";
import { acceptInvite } from "@/features/shops/actions";
import { guardPage } from "@/features/shops/page-guard";
import { getAccountEmail } from "@/features/shops/repo";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Join a shop as staff" };

export default function InvitePage({ params }: PageProps<"/seller/invite/[token]">) {
  return (
    <Container as="main" id="main" className="flex max-w-xl flex-1 flex-col gap-6 py-6 sm:py-10">
      <PageHeader title="Join a shop as staff" />
      <Suspense fallback={<FormSkeleton fields={0} />}>
        <Accept params={params} />
      </Suspense>
    </Container>
  );
}

async function Accept({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const user = await guardPage(`/seller/invite/${token}`, requireUser);
  const account = await getAccountEmail(user.id);
  if (!account?.email || !account.emailVerifiedAt) {
    return (
      <Notice tone="error" role="alert" className="leading-6">
        {account?.email ? `Verify your email ${account.email} before accepting this invite.` : "Add your email to your profile and verify it before accepting this invite."}{" "}
        Open the link we emailed you, or send a new one from <TextLink href="/account">your account page</TextLink>. Then open this invite link again.
      </Notice>
    );
  }
  return (
    <>
      <p className="text-muted">You are logged in as {user.email ?? user.phone}. Accept the invite to help run this shop.</p>
      <ActionForm action={acceptInvite} submitLabel="Accept invite">
        <input type="hidden" name="token" value={token} />
      </ActionForm>
    </>
  );
}
