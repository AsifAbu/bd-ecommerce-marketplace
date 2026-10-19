import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ProfilePage } from "@/features/accounts/ui/account-pages";
import { FormSkeleton } from "@/features/accounts/ui/auth-shell";

export const metadata = { title: "My account" };

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <>
      <PageHeader title="My account" />
      <Suspense fallback={<FormSkeleton fields={3} />}>
        <ProfilePage searchParams={searchParams} />
      </Suspense>
    </>
  );
}
