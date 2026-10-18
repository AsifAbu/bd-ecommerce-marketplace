import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AttributeList } from "@/features/catalog/ui/attribute-list";
import { CatalogTabs } from "@/features/catalog/ui/catalog-tabs";
import { RoleGate } from "@/features/catalog/ui/role-gate";

export const metadata = { title: "Attributes: admin" };

export default function AttributesPage() {
  return (
    <>
      <AdminPageHeader
        title="Attributes"
        description="An attribute is defined once and assigned to the leaf categories that need it. Archived attributes stay readable."
      />
      <CatalogTabs current="attributes" />
      <Suspense fallback={<AdminLoading />}>
        <RoleGate role="admin">
          <AttributeList />
        </RoleGate>
      </Suspense>
    </>
  );
}
