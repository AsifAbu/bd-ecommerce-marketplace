import Link from "next/link";
import { ActionForm, Field } from "@/components/action-form";
import { EmptyState, FilterChips, Pagination, Rating } from "@/components/ui";
import { StatusBadge } from "@/components/admin/status";
import { hideReview, unhideReview } from "../actions";
import type { ReviewStatus } from "../rules";
import type { AdminReview, Paged } from "../service";
import { formatDay, plural } from "./stars";

/**
 * Platform Admin moderation queue (/admin/reviews). Reviews are never deleted: the admin hides
 * one with a reason (audit log) and can show it again, also with a reason. Render only after
 * requirePlatformAdmin().
 */
export function AdminReviews({ status, data }: { status: ReviewStatus; data: Paged<AdminReview> }) {
  return (
    <div className="flex flex-col gap-5">
      <FilterChips
        label="Review status"
        items={[
          { label: "Published", href: "/admin/reviews?status=visible", current: status === "visible" },
          { label: "Hidden", href: "/admin/reviews?status=hidden", current: status === "hidden" },
        ]}
      />
      <p className="text-sm text-muted">{plural(data.total, status === "visible" ? "published review" : "hidden review")}, newest first.</p>
      {data.items.length === 0 && (
        <EmptyState
          title={status === "visible" ? "No published reviews yet" : "No hidden reviews"}
          description={status === "visible" ? "Reviews appear here as customers write them." : "Reviews you hide are listed here, with your reason."}
        />
      )}
      <div className="flex flex-col gap-4">
        {data.items.map((r) => (
          <article key={r.id} className="flash-result flex flex-col gap-3 rounded-lg border border-line p-4 sm:p-5" data-testid="admin-review">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Rating value={r.rating} />
              <h2 className="text-base font-semibold">{r.title ?? "(no title)"}</h2>
              {r.status === "hidden" && <StatusBadge status="hidden">Hidden</StatusBadge>}
            </div>
            <p className="text-sm text-muted">
              <Link className="font-medium text-jade underline-offset-4 hover:underline" href={`/products/${encodeURIComponent(r.productId)}`}>
                {r.productTitle}
              </Link>
              , {r.shopName}. By {r.authorName}
              {r.authorEmail ? ` (${r.authorEmail})` : ""}, order {r.orderNo}, {formatDay(r.createdAt)}
              {r.editedAt && `, edited ${formatDay(r.editedAt)}`}.
            </p>
            {r.text ? <p className="max-w-prose whitespace-pre-line">{r.text}</p> : <p className="text-sm text-muted">(rating only)</p>}
            {r.status === "hidden" ? (
              <>
                <p className="text-sm text-vermilion">
                  Hidden {r.hiddenAt ? formatDay(r.hiddenAt) : ""}
                  {r.hiddenBy ? ` by ${r.hiddenBy}` : ""}: {r.hiddenReason}
                </p>
                <div className="rounded-md bg-surface p-4 md:max-w-md">
                  <ActionForm action={unhideReview} submitLabel="Show again" label={`Show the review of ${r.productTitle} again`}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <Field name="reason" label="Reason for showing it again" required />
                  </ActionForm>
                </div>
              </>
            ) : (
              <div className="rounded-md bg-surface p-4 md:max-w-md">
                <ActionForm action={hideReview} submitLabel="Hide review" variant="danger" label={`Hide the review of ${r.productTitle}`}>
                  <input type="hidden" name="reviewId" value={r.id} />
                  <Field name="reason" label="Reason for hiding" hint="Logged in the audit log and shown to the author." required />
                </ActionForm>
              </div>
            )}
          </article>
        ))}
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(p) => `/admin/reviews?status=${status}&page=${p}`} />
    </div>
  );
}
