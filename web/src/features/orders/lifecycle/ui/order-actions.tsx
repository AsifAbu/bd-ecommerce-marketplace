import { ActionForm, Field } from "@/components/action-form";
import { adminOrderAction, shopOrderAction } from "../actions";
import { ACTION_LABELS, type LifecycleAction } from "../machine";

export type ActionScope = { kind: "shop"; shopId: string } | { kind: "admin" };

/**
 * The buttons for what this viewer may do now (from availableActions). Hand over asks for the
 * courier and tracking number; cancel asks for a reason; refuse takes an optional note.
 */
export function OrderActions({ scope, shopOrderId, shopOrderNo, actions }: { scope: ActionScope; shopOrderId: string; shopOrderNo: string; actions: LifecycleAction[] }) {
  if (actions.length === 0) return <p className="text-sm text-muted">No actions left for this order.</p>;
  const action = scope.kind === "shop" ? shopOrderAction : adminOrderAction;
  const hidden = (name: LifecycleAction) => (
    <>
      {scope.kind === "shop" && <input type="hidden" name="shopId" value={scope.shopId} />}
      <input type="hidden" name="shopOrderId" value={shopOrderId} />
      <input type="hidden" name="action" value={name} />
    </>
  );
  const simple = actions.filter((a) => a === "confirm" || a === "pack" || a === "deliver" || a === "mark_returned");
  return (
    <div className="flex flex-col gap-4">
      {simple.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {simple.map((a) => (
            <ActionForm key={a} action={action} submitLabel={a === "mark_returned" ? "Mark returned (parcel back at the shop)" : ACTION_LABELS[a]} label={`${ACTION_LABELS[a]} ${shopOrderNo}`} className="flex flex-col gap-2">
              {hidden(a)}
            </ActionForm>
          ))}
        </div>
      )}
      {actions.includes("hand_over") && (
        <ActionForm action={action} submitLabel="Hand over to courier" label={`Hand over ${shopOrderNo}`} className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-4">
          {hidden("hand_over")}
          <p className="text-sm text-muted">Record the courier and its tracking number. The customer gets them by SMS.</p>
          <Field name="courierName" label="Courier" required hint="For example RedX, Paperfly, Pathao, Steadfast or eCourier" />
          <Field name="trackingNo" label="Tracking number" required />
        </ActionForm>
      )}
      {actions.includes("refuse") && (
        <details className="rounded-lg border border-line bg-paper p-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">The customer refused the delivery</summary>
          <ActionForm action={action} submitLabel="Mark refused" variant="danger" label={`Mark ${shopOrderNo} refused`} className="mt-3 flex flex-col gap-3">
            {hidden("refuse")}
            <p className="text-sm text-muted">The items go back into stock only when you mark the parcel returned.</p>
            <Field name="reason" label="Note (optional)" as="textarea" rows={2} />
          </ActionForm>
        </details>
      )}
      {actions.includes("cancel") && (
        <details className="rounded-lg border border-line bg-paper p-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">Cancel this order</summary>
          <ActionForm action={action} submitLabel="Cancel order" variant="danger" label={`Cancel ${shopOrderNo}`} className="mt-3 flex flex-col gap-3">
            {hidden("cancel")}
            <p className="text-sm text-muted">The customer is told by SMS and the items go back into stock.</p>
            <Field name="reason" label="Reason" as="textarea" rows={2} required />
          </ActionForm>
        </details>
      )}
    </div>
  );
}
