import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RequestQueue } from "@/features/catalog/ui/request-queue";
import { RoleGate } from "@/features/catalog/ui/role-gate";

export const metadata = { title: "Category requests: admin" };

export default function RequestsPage() {
  return (
    <>
      <AdminPageHeader title="Category requests" description="Sellers ask for a new category or a new attribute option. Answer each request within 24 hours." />
      <Suspense fallback={<AdminLoading />}>
        <RoleGate role="admin">
          <RequestQueue />
        </RoleGate>
      </Suspense>
    </>
  );
}
