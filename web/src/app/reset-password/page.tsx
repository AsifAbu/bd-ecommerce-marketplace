import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/accounts/ui/auth-forms";
import { AuthShell, FormSkeleton } from "@/features/accounts/ui/auth-shell";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      <Suspense fallback={<FormSkeleton fields={1} />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
