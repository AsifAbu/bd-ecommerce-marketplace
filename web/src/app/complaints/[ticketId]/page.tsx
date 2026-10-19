import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonStyles, Container, EmptyState, Notice, PageHeader, TextLink } from "@/components/ui";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { customerComplaint } from "@/features/complaints/server";
import { CustomerReplyForm } from "@/features/complaints/ui/complaint-forms";
import { TicketThread } from "@/features/complaints/ui/ticket-views";

export const metadata = { title: "Your complaint", robots: { index: false } };

/** US-072: the customer's complaint and its thread (account, or a guest with the order open). */
export default function CustomerComplaintPage({ params, searchParams }: PageProps<"/complaints/[ticketId]">) {
  return (
    <Container as="main" className="flex max-w-2xl flex-1 flex-col gap-6 py-6 sm:py-10">
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { ticketId } = await params;
  const { opened } = await searchParams;
  const found = await customerComplaint(ticketId);
  if (!found) {
    return (
      <>
        <PageHeader title="Complaint not found" />
        <EmptyState
          title="Log in to see this complaint"
          description="Or open your order with a code sent to your mobile."
          action={
            <div className="flex flex-wrap gap-3">
              <Link className={buttonStyles()} href="/login">
                Log in
              </Link>
              <Link className={buttonStyles({ variant: "secondary" })} href="/track">
                Track an order
              </Link>
            </div>
          }
        />
      </>
    );
  }
  const { ticket } = found;
  return (
    <>
      <PageHeader title={ticket.subject} />
      {opened === "1" && (
        <Notice tone="success">Complaint {ticket.ticketNo} received. We will resolve it within 72 hours and inform you at each step.</Notice>
      )}
      {ticket.orderNo && (
        <p className="text-sm">
          <TextLink href={`/orders/${ticket.orderNo}`}>Order {ticket.orderNo}</TextLink>
        </p>
      )}
      <TicketThread ticket={ticket} />
      {ticket.active && <CustomerReplyForm ticketId={ticket.id} />}
    </>
  );
}
