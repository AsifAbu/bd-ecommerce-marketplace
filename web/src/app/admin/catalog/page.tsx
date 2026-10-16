import { Suspense } from "react";
import { CategoryTree } from "@/features/catalog/ui/category-tree";
import { RoleGate } from "@/features/catalog/ui/role-gate";

export default function CategoryTreePage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <RoleGate role="admin">
        <CategoryTree />
      </RoleGate>
    </Suspense>
  );
}
