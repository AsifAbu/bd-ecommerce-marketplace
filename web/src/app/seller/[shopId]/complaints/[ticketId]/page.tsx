import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { complaintDetail } from "@/features/complaints/server";
import { ShopReplyForm } from "@/features/complaints/ui/complaint-forms";
import { TicketThread } from "@/features/complaints/ui/ticket-views";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Complaint" };

/** US-072: one complaint about this shop's order (owner and staff reply; another shop's ticket is not found). */
export default function ShopComplaintPage({ params }: PageProps<"/seller/[shopId]/complaints/[ticketId]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string; ticketId: string }> }) {
  await connection();
  const { shopId, ticketId } = await params;
  const access = await guardPage(`/seller/${shopId}/complaints/${ticketId}`, () => requireShopRole(shopId, ["owner", "staff"]));
  const ticket = await complaintDetail({ kind: "shop", shopId: access.shopId }, ticketId);
  if (!ticket) notFound();
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href={`/seller/${access.shopId}/complaints`}>
          All complaints
        </Link>
      </p>
      <h1 className="text-2xl font-bold">{ticket.subject}</h1>
      <TicketThread ticket={ticket} />
      {ticket.active && <ShopReplyForm shopId={access.shopId} ticketId={ticket.id} />}
    </>
  );
}
