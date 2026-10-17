import { Suspense } from "react";
import { AdminGate } from "@/features/policies/ui/admin-gate";
import { AdminPolicyList } from "@/features/policies/ui/admin-policies";

export const metadata = { title: "Policies admin" };

export default function AdminPoliciesPage() {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <AdminGate callbackUrl="/admin/policies">
        <AdminPolicyList />
      </AdminGate>
    </Suspense>
  );
}
