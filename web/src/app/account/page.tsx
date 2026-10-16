import { Suspense } from "react";
import { ProfilePage } from "@/features/accounts/ui/account-pages";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";

export const metadata = { title: "My account" };

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <PageShell title="My account">
      <Suspense fallback={<Loading />}>
        <ProfilePage searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
