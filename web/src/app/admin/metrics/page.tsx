import { connection } from "next/server";
import { Suspense } from "react";
import { MetricsDashboardView } from "@/features/metrics/ui/metrics-dashboard";
import { adminDashboard } from "@/features/metrics/server";
import { guardPage } from "@/features/shops/page-guard";

export const metadata = { title: "Marketplace metrics: admin" };

/** US-083: Platform Admin only. `?days=7|30|90`. */
export default function AdminMetricsPage({ searchParams }: PageProps<"/admin/metrics">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">Marketplace metrics</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const { days } = await searchParams;
  const data = await guardPage("/admin/metrics", () => adminDashboard(days));
  return <MetricsDashboardView data={data} />;
}
