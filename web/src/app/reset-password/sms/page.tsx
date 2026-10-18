import { Suspense } from "react";
import { ResetPasswordSmsForm } from "@/features/accounts/ui/auth-forms";
import { AuthShell, FormSkeleton } from "@/features/accounts/ui/auth-shell";

export const metadata = { title: "Reset password by SMS code" };

export default function ResetPasswordSmsPage() {
  return (
    <AuthShell title="Reset password by SMS code">
      <Suspense fallback={<FormSkeleton fields={3} />}>
        <ResetPasswordSmsForm />
      </Suspense>
    </AuthShell>
  );
}
