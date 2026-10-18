import { Notice } from "@/components/ui";
import { returnsOfOrder } from "../server";
import { ReturnCard } from "./return-card";
import { CustomerReturnActions } from "./return-forms";

/** The order page's returns block (customer or guest with the order open): requests and their status. */
export async function OrderReturns({ orderId, notice }: { orderId: string; notice?: "requested" | "requested-no-photos" }) {
  const returns = await returnsOfOrder(orderId);
  if (!returns.length && !notice) return null;
  return (
    <section id="returns" aria-labelledby="order-returns-heading" className="flex flex-col gap-4">
      <h2 id="order-returns-heading" className="text-xl">
        Returns
      </h2>
      {notice && (
        <Notice tone="success">
          Return requested. The shop answers within 48 hours; otherwise the marketplace admin decides. You get an SMS at each step.
          {notice === "requested-no-photos" && " Your photos could not be saved (photo storage is not available in this test setup); the request was sent without them."}
        </Notice>
      )}
      {returns.map((r) => (
        <ReturnCard key={r.id} view={r} audience="customer">
          <CustomerReturnActions view={r} />
        </ReturnCard>
      ))}
    </section>
  );
}
