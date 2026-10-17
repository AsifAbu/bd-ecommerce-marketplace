import Link from "next/link";
import { ActionForm, Field } from "@/components/action-form";
import { hideReview, unhideReview } from "../actions";
import type { ReviewStatus } from "../rules";
import type { AdminReview, Paged } from "../service";
import { cardClass, formatDay, linkClass, plural, Stars } from "./stars";

/**
 * Platform Admin moderation queue (/admin/reviews). Reviews are never deleted: the admin hides
 * one with a reason (audit log) and can show it again, also with a reason. Render only after
 * requirePlatformAdmin().
 */
export function AdminReviews({ status, data }: { status: ReviewStatus; data: Paged<AdminReview> }) {
  const tab = (s: ReviewStatus, label: string) => (
    <Link className={s === status ? "font-semibold" : linkClass} href={`/admin/reviews?status=${s}`} aria-current={s === status ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Review status" className="flex gap-4">
        {tab("visible", "Published")}
        {tab("hidden", "Hidden")}
      </nav>
      <p className="text-sm text-gray-800">
        {plural(data.total, status === "visible" ? "published review" : "hidden review")}, newest first.
      </p>
      {data.items.length === 0 && <p>No reviews here.</p>}
      {data.items.map((r) => (
        <article key={r.id} className={cardClass} data-testid="admin-review">
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={r.rating} />
            <h2 className="font-semibold">{r.title ?? "(no title)"}</h2>
          </div>
          <p className="text-sm text-gray-800">
            <Link className={linkClass} href={`/products/${encodeURIComponent(r.productId)}`}>
              {r.productTitle}
            </Link>{" "}
            · {r.shopName} · by {r.authorName}
            {r.authorEmail ? ` (${r.authorEmail})` : ""} · order {r.orderNo} · {formatDay(r.createdAt)}
            {r.editedAt && ` · edited ${formatDay(r.editedAt)}`}
          </p>
          {r.text ? <p className="whitespace-pre-line">{r.text}</p> : <p className="text-sm text-gray-700">(rating only)</p>}
          {r.status === "hidden" ? (
            <>
              <p className="text-sm text-red-800">
                Hidden {r.hiddenAt ? formatDay(r.hiddenAt) : ""}
                {r.hiddenBy ? ` by ${r.hiddenBy}` : ""}: {r.hiddenReason}
              </p>
              <ActionForm action={unhideReview} submitLabel="Show again" label={`Show the review of ${r.productTitle} again`}>
                <input type="hidden" name="reviewId" value={r.id} />
                <Field name="reason" label="Reason for showing it again" required />
              </ActionForm>
            </>
          ) : (
            <ActionForm action={hideReview} submitLabel="Hide review" variant="danger" label={`Hide the review of ${r.productTitle}`}>
              <input type="hidden" name="reviewId" value={r.id} />
              <Field name="reason" label="Reason for hiding" hint="Logged in the audit log and shown to the author." required />
            </ActionForm>
          )}
        </article>
      ))}
      {data.totalPages > 1 && (
        <nav aria-label="Pages" className="flex gap-4 text-sm">
          {data.page > 1 && (
            <Link className={linkClass} href={`/admin/reviews?status=${status}&page=${data.page - 1}`}>
              Newer
            </Link>
          )}
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          {data.page < data.totalPages && (
            <Link className={linkClass} href={`/admin/reviews?status=${status}&page=${data.page + 1}`}>
              Older
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
