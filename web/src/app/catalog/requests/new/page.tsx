import { Suspense } from "react";
import { RequestForms } from "@/features/catalog/ui/request-form";
import { RoleGate } from "@/features/catalog/ui/role-gate";

export default function NewCategoryRequestPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Request a category or option</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <RoleGate role="user">
          <RequestForms />
        </RoleGate>
      </Suspense>
    </main>
  );
}
