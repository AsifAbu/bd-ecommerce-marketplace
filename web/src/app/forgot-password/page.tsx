import { ForgotPasswordForm } from "@/features/accounts/ui/auth-forms";
import { PageShell } from "@/features/accounts/ui/page-shell";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <PageShell title="Forgot password">
      <ForgotPasswordForm />
    </PageShell>
  );
}
