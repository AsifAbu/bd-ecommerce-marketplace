import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminUsersContent } from "@/features/accounts/ui/admin-users-page";

export const metadata = { title: "Users" };

export default function Page({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <AdminPageHeader title="Users" description="Find an account, suspend or reactivate it, and choose who is a Platform Admin." />
      <Suspense fallback={<AdminLoading />}>
        <AdminUsersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
