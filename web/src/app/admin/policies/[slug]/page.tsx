import { Suspense } from "react";
import { AdminGate } from "@/features/policies/ui/admin-gate";
import { AdminPolicyDetail } from "@/features/policies/ui/admin-policies";

export default function AdminPolicyPage({ params, searchParams }: PageProps<"/admin/policies/[slug]">) {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <AdminGate callbackUrl="/admin/policies">
        <AdminPolicyDetail slug={params.then((p) => p.slug)} searchParams={searchParams} />
      </AdminGate>
    </Suspense>
  );
}
