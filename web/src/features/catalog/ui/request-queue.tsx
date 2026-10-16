import { decideCategoryRequestAction } from "../actions";
import { listCategoryRequests } from "../service";
import { ActionForm, SubmitButton } from "./action-form";
import { Badge } from "./category-tree";
import { inputClass, labelClass } from "./styles";

const dhaka = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });

/** US-022: seller requests, oldest due first, each answered within 24 hours. */
export async function RequestQueue() {
  const requests = await listCategoryRequests();
  const now = new Date();
  if (requests.length === 0) return <p>No category requests yet.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((r) => {
        const overdue = r.status === "pending" && r.dueAt < now;
        return (
          <li key={r.id} className="flex flex-col gap-2 rounded border border-gray-300 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{r.kind === "category" ? "New category" : "New option"}</Badge>
              <strong>{r.name}</strong>
              <span className="text-sm">
                {r.kind === "category" ? `under ${r.parent?.name ?? "(removed)"}` : `for ${r.attribute?.name ?? "(removed)"}`}
              </span>
              <Badge>{r.status}</Badge>
            </div>
            <p className="text-sm">
              From {r.requestedBy.name ?? r.requestedBy.email ?? r.requestedBy.phone}
              {r.reason ? `: "${r.reason}"` : ""}
            </p>
            {r.status === "pending" ? (
              <>
                <p className={`text-sm ${overdue ? "font-semibold text-red-700" : ""}`}>
                  Due {dhaka.format(r.dueAt)} (Dhaka time){overdue ? ", overdue" : ""}
                </p>
                <ActionForm action={decideCategoryRequestAction} label={`Answer request ${r.name}`}>
                  <input type="hidden" name="requestId" value={r.id} />
                  <label className={labelClass}>
                    Note (optional)
                    <input name="note" maxLength={500} className={inputClass} />
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
              <p className="text-sm">
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
