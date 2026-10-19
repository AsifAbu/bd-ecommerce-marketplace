import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminGate } from "@/features/policies/ui/admin-gate";
import { AdminPolicyDetail } from "@/features/policies/ui/admin-policies";

export default function AdminPolicyPage({ params, searchParams }: PageProps<"/admin/policies/[slug]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminGate callbackUrl="/admin/policies">
        <AdminPolicyDetail slug={params.then((p) => p.slug)} searchParams={searchParams} />
      </AdminGate>
    </Suspense>
  );
}
