import { Suspense } from "react";
import { CategoryDetail } from "@/features/catalog/ui/category-detail";
import { RoleGate } from "@/features/catalog/ui/role-gate";

export default function CategoryPage({ params }: PageProps<"/admin/catalog/categories/[id]">) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <RoleGate role="admin">
        <CategoryDetail id={params.then((p) => p.id)} />
      </RoleGate>
    </Suspense>
  );
}
