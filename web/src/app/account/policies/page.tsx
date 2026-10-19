import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { AccountPolicies } from "@/features/policies/ui/account-policies";

export const metadata = { title: "My policy acceptances" };

export default function AccountPoliciesPage() {
  return (
    <>
      <PageHeader title="Policies you accepted" />
      <Suspense fallback={<ListSkeleton />}>
        <AccountPolicies />
      </Suspense>
    </>
  );
}
