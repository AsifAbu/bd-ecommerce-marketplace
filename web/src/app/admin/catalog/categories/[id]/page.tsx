import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { CategoryDetail } from "@/features/catalog/ui/category-detail";
import { RoleGate } from "@/features/catalog/ui/role-gate";

export const metadata = { title: "Category: admin" };

export default function CategoryPage({ params }: PageProps<"/admin/catalog/categories/[id]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <RoleGate role="admin">
        <CategoryDetail id={params.then((p) => p.id)} />
      </RoleGate>
    </Suspense>
  );
}
