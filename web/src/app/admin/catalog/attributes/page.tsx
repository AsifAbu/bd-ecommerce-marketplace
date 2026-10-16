import { Suspense } from "react";
import { AttributeList } from "@/features/catalog/ui/attribute-list";
import { RoleGate } from "@/features/catalog/ui/role-gate";

export default function AttributesPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <RoleGate role="admin">
        <AttributeList />
      </RoleGate>
    </Suspense>
  );
}
