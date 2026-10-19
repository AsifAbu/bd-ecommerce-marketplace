import Link from "next/link";
import { buttonStyles } from "@/components/ui";
import { AuthShell } from "@/features/accounts/ui/auth-shell";

export const metadata = { title: "Link not valid" };

export default function Page() {
  return (
    <AuthShell title="This link is not valid" intro="The verification link is invalid, already used or expired. Links work for 24 hours.">
      <div>
        <Link className={buttonStyles({ size: "lg", block: true })} href="/account">
          Go to my account to send a new link
        </Link>
      </div>
    </AuthShell>
  );
}
