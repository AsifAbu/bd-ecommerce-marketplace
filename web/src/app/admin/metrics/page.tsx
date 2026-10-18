import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MetricsDashboardView } from "@/features/metrics/ui/metrics-dashboard";
import { adminDashboard } from "@/features/metrics/server";
import { guardPage } from "@/features/shops/page-guard";

export const metadata = { title: "Marketplace metrics: admin" };

/** US-083: Platform Admin only. `?days=7|30|90`. */
export default function AdminMetricsPage({ searchParams }: PageProps<"/admin/metrics">) {
  return (
    <>
      <AdminPageHeader title="Marketplace metrics" description="How the marketplace is doing against the targets in the plan, and what needs a look first." />
      <Suspense fallback={<AdminLoading />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const { days } = await searchParams;
  const data = await guardPage("/admin/metrics", () => adminDashboard(days));
  return <MetricsDashboardView data={data} />;
}
