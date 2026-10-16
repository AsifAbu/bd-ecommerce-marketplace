import { Suspense } from "react";
import { AdminUsersPage } from "@/features/accounts/ui/account-pages";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";

export const metadata = { title: "Users" };

export default function Page({ searchParams }: PageProps<"/admin/users">) {
  return (
    <PageShell title="Users" wide>
      <Suspense fallback={<Loading />}>
        <AdminUsersPage searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
