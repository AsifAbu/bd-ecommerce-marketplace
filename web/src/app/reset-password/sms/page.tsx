import { Suspense } from "react";
import { ResetPasswordSmsForm } from "@/features/accounts/ui/auth-forms";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";

export const metadata = { title: "Reset password by SMS code" };

export default function ResetPasswordSmsPage() {
  return (
    <PageShell title="Reset password by SMS code">
      <Suspense fallback={<Loading />}>
        <ResetPasswordSmsForm />
      </Suspense>
    </PageShell>
  );
}
