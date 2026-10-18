import { SignUpForm } from "@/features/accounts/ui/auth-forms";
import { AuthShell } from "@/features/accounts/ui/auth-shell";

export const metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <AuthShell title="Create an account" intro="Track orders, save addresses and keep a wishlist. You can also check out as a guest.">
      <SignUpForm />
    </AuthShell>
  );
}
