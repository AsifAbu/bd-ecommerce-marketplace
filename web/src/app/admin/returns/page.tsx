import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">Returns: admin</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
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
      <nav aria-label="Return status" className="flex flex-wrap gap-3 text-sm">
        {RETURN_STATUSES.map((st) => (
          <Link key={st} className={`underline ${st === status ? "font-bold" : ""}`} aria-current={st === status ? "page" : undefined} href={`/admin/returns?status=${st}`}>
            {RETURN_STATUS_LABELS[st]}
          </Link>
        ))}
        <Link className="underline" href="/admin/complaints">
          Complaints queue
        </Link>
      </nav>
      <p className="text-sm">
        Escalated requests reach you when the shop does not answer within 48 hours (checked every 15 minutes) or the customer disputes a
        rejection. Approve or deny with a note; the customer and the shop are informed.
      </p>
      {returns.length === 0 ? (
        <p>No returns with status “{RETURN_STATUS_LABELS[status]}”.</p>
      ) : (
        returns.map((r) => (
          <ReturnCard key={r.id} view={r} audience="admin" photoUrls={photos.get(r.id)}>
            <AdminReturnActions view={r} />
          </ReturnCard>
        ))
      )}
    </>
  );
}
