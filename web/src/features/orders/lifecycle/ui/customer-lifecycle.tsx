import { ActionForm, Field } from "@/components/action-form";
import { customerCancelAction } from "../actions";
import type { TimelineEntry } from "../timeline";
import { TimelineList } from "./timeline-list";

/**
 * Customer side of one shop order (US-052, US-053): its timeline, the courier and tracking number
 * once handed over, and Cancel while the shop has not confirmed yet (free cancellation).
 */
export function CustomerShopOrderLifecycle({
  orderNo,
  shopOrderId,
  shopOrderNo,
  status,
  timeline,
  courier,
}: {
  orderNo: string;
  shopOrderId: string;
  shopOrderNo: string;
  status: string;
  timeline: TimelineEntry[];
  courier: { name: string; trackingNo: string | null } | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {courier && (
        <p className="text-sm">
          With <strong>{courier.name}</strong>
          {courier.trackingNo && (
            <>
              , tracking number <strong>{courier.trackingNo}</strong>
            </>
          )}
        </p>
      )}
      <details className="text-sm" open={status !== "delivered"}>
        <summary className="cursor-pointer font-medium">Order timeline</summary>
        <div className="mt-2">
          <TimelineList entries={timeline} label={`Timeline of ${shopOrderNo}`} />
        </div>
      </details>
      {status === "placed" && (
        <details className="rounded border border-gray-300 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Cancel this shop order</summary>
          <ActionForm action={customerCancelAction} submitLabel="Cancel shop order" variant="danger" label={`Cancel ${shopOrderNo}`} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="orderNo" value={orderNo} />
            <input type="hidden" name="shopOrderId" value={shopOrderId} />
            <p>You can cancel free of charge until the shop confirms your order.</p>
            <Field name="reason" label="Reason (optional)" as="textarea" rows={2} />
          </ActionForm>
        </details>
      )}
    </div>
  );
}
