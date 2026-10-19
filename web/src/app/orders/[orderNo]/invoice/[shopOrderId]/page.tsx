import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { invoiceOrder } from "@/features/orders/server";
import { InvoiceView } from "@/features/orders/ui/invoice-view";
import { requireShopRole } from "@/lib/auth";
import { SITE_NAME } from "@/lib/brand";
import { getConfig } from "@/lib/config";

export const metadata = { title: "Invoice", robots: { index: false } };

/** Printable invoice per shop order (US-051): the customer (or guest with access) and that shop's members. */
export default function InvoicePage({ params }: PageProps<"/orders/[orderNo]/invoice/[shopOrderId]">) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
      <Suspense fallback={<p role="status" className="text-muted">Loading the invoice…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

const isMember = (shopId: string) =>
  requireShopRole(shopId, ["owner", "staff"]).then(
    () => true,
    () => false,
  );

async function Content({ params }: { params: Promise<{ orderNo: string; shopOrderId: string }> }) {
  await connection();
  const { orderNo, shopOrderId } = await params;
  const order = await invoiceOrder(decodeURIComponent(orderNo), shopOrderId, isMember);
  const shopOrder = order?.shopOrders.find((so) => so.id === shopOrderId);
  if (!order || !shopOrder) notFound();
  return <InvoiceView order={order} shopOrder={shopOrder} platform={{ name: SITE_NAME, dbid: getConfig().dbid ?? null }} />;
}
