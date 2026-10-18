import { ForgotPasswordForm } from "@/features/accounts/ui/auth-forms";
import { AuthShell } from "@/features/accounts/ui/auth-shell";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot password" intro="Tell us how to reach you and we will help you choose a new password.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
