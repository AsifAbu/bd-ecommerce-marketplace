import { ChevronDown } from "lucide-react";
import { ActionForm, Field } from "@/components/action-form";
import { customerCancelAction } from "../actions";
import type { TimelineEntry } from "../timeline";
import { StatusTimeline } from "../../ui/status-timeline";

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
    <div className="flex flex-col gap-2">
      {courier && (
        <p className="text-sm">
          With <strong className="font-semibold">{courier.name}</strong>
          {courier.trackingNo && (
            <>
              , tracking number <strong className="font-semibold">{courier.trackingNo}</strong>
            </>
          )}
        </p>
      )}
      <details className="disclosure text-sm" open={status !== "delivered"}>
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 font-medium text-jade">
          Order timeline
          <ChevronDown aria-hidden="true" size={16} className="disclosure-chevron" />
        </summary>
        <div className="pb-2 pt-1">
          <StatusTimeline entries={timeline} label={`Timeline of ${shopOrderNo}`} />
        </div>
      </details>
      {status === "placed" && (
        <details className="disclosure text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 font-medium text-muted hover:text-ink">
            Cancel this shop order
            <ChevronDown aria-hidden="true" size={16} className="disclosure-chevron" />
          </summary>
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
