import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { linkStyles } from "@/components/ui";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { complaintDetail } from "@/features/complaints/server";
import { ShopReplyForm } from "@/features/complaints/ui/complaint-forms";
import { TicketThread } from "@/features/complaints/ui/ticket-views";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Complaint" };

/** US-072: one complaint about this shop's order (owner and staff reply; another shop's ticket is not found). */
export default function ShopComplaintPage({ params }: PageProps<"/seller/[shopId]/complaints/[ticketId]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string; ticketId: string }> }) {
  await connection();
  const { shopId, ticketId } = await params;
  const access = await guardPage(`/seller/${shopId}/complaints/${ticketId}`, () => requireShopRole(shopId, ["owner", "staff"]));
  const ticket = await complaintDetail({ kind: "shop", shopId: access.shopId }, ticketId);
  if (!ticket) notFound();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link className={`${linkStyles} -ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm`} href={`/seller/${access.shopId}/complaints`}>
        <ChevronLeft aria-hidden="true" size={16} />
        All complaints
      </Link>
      <h1 className="text-3xl font-semibold">{ticket.subject}</h1>
      <TicketThread ticket={ticket} />
      {ticket.active && <ShopReplyForm shopId={access.shopId} ticketId={ticket.id} />}
    </div>
  );
}
