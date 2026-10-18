import { complaintsOfOrder } from "../server";
import { TicketList } from "./ticket-views";

/** The order page's complaints block (customer or guest with the order open). */
export async function OrderComplaints({ orderId, orderNo }: { orderId: string; orderNo: string }) {
  const tickets = await complaintsOfOrder(orderId);
  if (!tickets.length) return null;
  return (
    <section id="complaints" aria-labelledby="order-complaints-heading" className="flex flex-col gap-4">
      <h2 id="order-complaints-heading" className="text-xl">
        Complaints about order {orderNo}
      </h2>
      <p className="text-sm text-muted">Every complaint is answered and resolved within 72 hours. You get an SMS when its status changes.</p>
      <TicketList tickets={tickets} href={(t) => `/complaints/${t.id}`} />
    </section>
  );
}
