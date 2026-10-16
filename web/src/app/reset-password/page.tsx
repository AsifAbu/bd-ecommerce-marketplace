import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/accounts/ui/auth-forms";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <PageShell title="Choose a new password">
      <Suspense fallback={<Loading />}>
        <ResetPasswordForm />
      </Suspense>
    </PageShell>
  );
}
