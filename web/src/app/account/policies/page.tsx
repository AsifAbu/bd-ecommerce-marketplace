import { Suspense } from "react";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";
import { AccountPolicies } from "@/features/policies/ui/account-policies";

export const metadata = { title: "My policy acceptances" };

export default function AccountPoliciesPage() {
  return (
    <PageShell title="Policies you accepted" wide>
      <Suspense fallback={<Loading />}>
        <AccountPolicies />
      </Suspense>
    </PageShell>
  );
}
