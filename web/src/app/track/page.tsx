import { Suspense } from "react";
import { TrackForm } from "@/features/orders/ui/track-form";

export const metadata = { title: "Track your order" };

/** US-008: track an order with its number and a code sent to the order's mobile (no account needed). */
export default function TrackPage({ searchParams }: PageProps<"/track">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Track your order</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { orderNo } = await searchParams;
  return <TrackForm initialOrderNo={typeof orderNo === "string" ? orderNo : ""} />;
}
