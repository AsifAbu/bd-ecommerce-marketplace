import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonStyles } from "@/components/ui";
import { CatalogTabs } from "@/features/catalog/ui/catalog-tabs";
import { CategoryTree } from "@/features/catalog/ui/category-tree";
import { RoleGate } from "@/features/catalog/ui/role-gate";

export const metadata = { title: "Category tree: admin" };

export default function CategoryTreePage() {
  return (
    <>
      <AdminPageHeader
        title="Category tree"
        description="Every product sits in one leaf category. Each leaf asks sellers for its own attributes, so search filters stay correct."
        action={
          <a className={buttonStyles()} href="#new-category">
            New category
          </a>
        }
      />
      <CatalogTabs current="tree" />
      <Suspense fallback={<AdminLoading />}>
        <RoleGate role="admin">
          <CategoryTree />
        </RoleGate>
      </Suspense>
    </>
  );
}
