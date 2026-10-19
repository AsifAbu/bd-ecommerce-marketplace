import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { userOrLogin } from "@/features/accounts/page-guards";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { complaintsOfUser } from "@/features/complaints/server";
import { TicketList } from "@/features/complaints/ui/ticket-views";

export const metadata = { title: "My complaints" };

/** US-072: the customer's complaints with status and the 72 h due time. */
export default function MyComplaintsPage() {
  return (
    <>
      <PageHeader title="My complaints" description="Report a problem from the order page. Every complaint is resolved within 72 hours." />
      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const user = await userOrLogin("/account/complaints");
  return (
    <div className="max-w-3xl">
      <TicketList tickets={await complaintsOfUser(user.id)} href={(t) => `/complaints/${t.id}`} empty="You have no complaints." />
    </div>
  );
}
