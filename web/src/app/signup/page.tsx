import { SignUpForm } from "@/features/accounts/ui/auth-forms";
import { PageShell } from "@/features/accounts/ui/page-shell";

export const metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <PageShell title="Create an account">
      <SignUpForm />
    </PageShell>
  );
}
