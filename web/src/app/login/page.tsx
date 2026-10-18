import { Suspense } from "react";
import { LoginForm } from "@/features/accounts/ui/auth-forms";
import { AuthShell, FormSkeleton } from "@/features/accounts/ui/auth-shell";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell title="Log in" intro="Use the mobile number or email you signed up with.">
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
