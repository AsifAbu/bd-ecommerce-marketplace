import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState, FilterChips, Notice } from "@/components/ui";
import { RETURN_STATUS_LABELS, RETURN_STATUSES, type ReturnStatus } from "@/features/returns";
import { returnPhotoUrls, returnsForAdmin } from "@/features/returns/server";
import { ReturnCard } from "@/features/returns/ui/return-card";
import { AdminReturnActions } from "@/features/returns/ui/return-forms";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Returns: admin" };

/** US-071: escalated returns (no shop answer in 48 h, or a disputed rejection) for the admin to decide. */
export default function AdminReturnsPage({ searchParams }: PageProps<"/admin/returns">) {
  return (
    <>
      <AdminPageHeader title="Returns" description="Return requests the shop did not answer, or that the customer disputes, wait here for your decision." />
      <Suspense fallback={<AdminLoading />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  await guardPage("/admin/returns", requirePlatformAdmin);
  const { status: s } = await searchParams;
  const status: ReturnStatus = typeof s === "string" && (RETURN_STATUSES as readonly string[]).includes(s) ? (s as ReturnStatus) : "escalated";
  const returns = await returnsForAdmin(status);
  const photos = new Map(await Promise.all(returns.filter((r) => r.photoCount).map(async (r) => [r.id, await returnPhotoUrls({ kind: "admin" }, r.id)] as const)));
  return (
    <>
      <FilterChips
        label="Return status"
        items={RETURN_STATUSES.map((st) => ({ label: RETURN_STATUS_LABELS[st], href: `/admin/returns?status=${st}`, current: st === status }))}
      />
      {status === "escalated" && (
        <Notice>
          A request reaches you when the shop does not answer within 48 hours (checked every 15 minutes) or the customer disputes a rejection. Approve or deny
          with a note; the customer and the shop are informed.
        </Notice>
      )}
      {returns.length === 0 ? (
        <EmptyState title={`No returns with status “${RETURN_STATUS_LABELS[status]}”`} description="Choose another status above to see other requests." />
      ) : (
        <div className="flex flex-col gap-4">
          {returns.map((r) => (
            <ReturnCard key={r.id} view={r} audience="admin" photoUrls={photos.get(r.id)}>
              <AdminReturnActions view={r} />
            </ReturnCard>
          ))}
        </div>
      )}
    </>
  );
}
