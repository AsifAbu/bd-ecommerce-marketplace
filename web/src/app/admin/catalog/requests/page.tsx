import { Suspense } from "react";
import { RequestQueue } from "@/features/catalog/ui/request-queue";
import { RoleGate } from "@/features/catalog/ui/role-gate";

export default function RequestsPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <RoleGate role="admin">
        <RequestQueue />
      </RoleGate>
    </Suspense>
  );
}
