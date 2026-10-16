import Link from "next/link";
import { PageShell } from "@/features/accounts/ui/page-shell";

export const metadata = { title: "Link not valid" };

export default function Page() {
  return (
    <PageShell title="This link is not valid">
      <p>The verification link is invalid, already used or expired. Links work for 24 hours.</p>
      <p>
        <Link className="underline" href="/account">
          Go to my account
        </Link>{" "}
        to send a new link.
      </p>
    </PageShell>
  );
}
