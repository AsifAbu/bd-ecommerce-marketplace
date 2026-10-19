import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { VerifyPhonePage } from "@/features/accounts/ui/account-pages";
import { FormSkeleton } from "@/features/accounts/ui/auth-shell";

export const metadata = { title: "Verify your mobile number" };

export default function Page() {
  return (
    <>
      <PageHeader title="Verify your mobile number" />
      <Suspense fallback={<FormSkeleton fields={1} />}>
        <VerifyPhonePage />
      </Suspense>
    </>
  );
}
