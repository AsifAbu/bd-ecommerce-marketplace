import { Suspense } from "react";
import { VerifyPhonePage } from "@/features/accounts/ui/account-pages";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";

export const metadata = { title: "Verify your mobile number" };

export default function Page() {
  return (
    <PageShell title="Verify your mobile number">
      <Suspense fallback={<Loading />}>
        <VerifyPhonePage />
      </Suspense>
    </PageShell>
  );
}
