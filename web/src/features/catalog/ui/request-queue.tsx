import { StatusBadge } from "@/components/admin/status";
import { EmptyState } from "@/components/ui";
import { decideCategoryRequestAction } from "../actions";
import { listCategoryRequests } from "../service";
import { ActionForm, SubmitButton } from "./action-form";
import { Badge } from "./category-tree";
import { cardClass, inputClass, labelClass } from "./styles";

const dhaka = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });

/** US-022: seller requests, oldest due first, each answered within 24 hours. */
export async function RequestQueue() {
  const requests = await listCategoryRequests();
  const now = new Date();
  if (requests.length === 0) {
    return <EmptyState title="No category requests yet" description="When a seller asks for a new category or a new attribute option, it appears here with a 24 hour deadline." />;
  }

  return (
    <ul className="flex flex-col gap-4">
      {requests.map((r) => {
        const overdue = r.status === "pending" && r.dueAt < now;
        return (
          <li key={r.id} className={`${cardClass} ${overdue ? "bg-vermilion-soft/40" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{r.kind === "category" ? "New category" : "New option"}</Badge>
              <strong className="text-base">{r.name}</strong>
              <span className="text-sm text-muted">
                {r.kind === "category" ? `under ${r.parent?.name ?? "(removed)"}` : `for ${r.attribute?.name ?? "(removed)"}`}
              </span>
              <StatusBadge status={r.status}>{r.status}</StatusBadge>
            </div>
            <p className="text-sm">
              From {r.requestedBy.name ?? r.requestedBy.email ?? r.requestedBy.phone}
              {r.reason ? `: "${r.reason}"` : ""}
            </p>
            {r.status === "pending" ? (
              <>
                <p className={`text-sm ${overdue ? "font-semibold text-vermilion" : "text-muted"}`}>
                  Due {dhaka.format(r.dueAt)} (Dhaka time){overdue ? ", overdue" : ""}
                </p>
                <ActionForm action={decideCategoryRequestAction} label={`Answer request ${r.name}`}>
                  <input type="hidden" name="requestId" value={r.id} />
                  <label className={labelClass}>
                    Note (optional)
                    <input name="note" maxLength={500} className={`${inputClass} sm:w-72`} />
                  </label>
                  <SubmitButton name="decision" value="approve">
                    Approve
                  </SubmitButton>
                  <SubmitButton name="decision" value="reject" variant="danger">
                    Reject
                  </SubmitButton>
                </ActionForm>
              </>
            ) : (
              <p className="text-sm text-muted">
                Answered {r.decidedAt ? dhaka.format(r.decidedAt) : ""}
                {r.decisionNote ? `: ${r.decisionNote}` : ""}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
