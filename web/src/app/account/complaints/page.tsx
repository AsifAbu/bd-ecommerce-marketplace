import Link from "next/link";
import { Suspense } from "react";
import { userOrLogin } from "@/features/accounts/page-guards";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";
import { complaintsOfUser } from "@/features/complaints/server";
import { TicketList } from "@/features/complaints/ui/ticket-views";

export const metadata = { title: "My complaints" };

/** US-072: the customer's complaints with status and the 72 h due time. */
export default function MyComplaintsPage() {
  return (
    <PageShell title="My complaints" wide>
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const user = await userOrLogin("/account/complaints");
  return (
    <>
      <p className="text-sm">
        Report a problem from the order page. Every complaint is resolved within 72 hours.{" "}
        <Link className="text-blue-800 underline" href="/account/orders">
          My orders
        </Link>{" "}
        ·{" "}
        <Link className="text-blue-800 underline" href="/account/returns">
          My returns
        </Link>
      </p>
      <TicketList tickets={await complaintsOfUser(user.id)} href={(t) => `/complaints/${t.id}`} empty="You have no complaints." />
    </>
  );
}
