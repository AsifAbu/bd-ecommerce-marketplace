import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { TrackForm } from "@/features/orders/ui/track-form";

export const metadata = { title: "Track your order" };

/** US-008: track an order with its number and a code sent to the order's mobile (no account needed). */
export default function TrackPage({ searchParams }: PageProps<"/track">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Track your order</h1>
        <p className="text-muted">No account needed. Enter your order number and we send a code to the mobile number you ordered with.</p>
      </div>
      <Suspense fallback={<Skeleton role="status" aria-label="Loading" aria-hidden={false} className="h-40 w-full" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { orderNo } = await searchParams;
  return <TrackForm initialOrderNo={typeof orderNo === "string" ? orderNo : ""} />;
}
