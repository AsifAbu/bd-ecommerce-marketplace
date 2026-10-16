import { Suspense } from "react";
import { LoginForm } from "@/features/accounts/ui/auth-forms";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <PageShell title="Log in">
      <Suspense fallback={<Loading />}>
        <LoginForm />
      </Suspense>
    </PageShell>
  );
}
